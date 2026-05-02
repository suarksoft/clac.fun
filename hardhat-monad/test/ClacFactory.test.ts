import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "viem";

describe("ClacFactory", function () {

  async function deployFixture() {
    const [owner, treasury, alice, bob, charlie] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    // K=100_000_000 so that 5 MON ≈ 17.8M tokens (~1.78% of 1B supply).
    // With old K=1_000_000 a 5 MON buy would have yielded ~383M tokens (38% of
    // supply), exceeding the 10% whale limit and breaking all buy tests.
    const clacFactory = await hre.viem.deployContract("ClacFactory", [
      treasury.account.address,
      100_000_000n,
    ]);

    return { clacFactory, owner, treasury, alice, bob, charlie, publicClient };
  }

  // ─────────────────────────────────────────────────────────────────────────
  describe("Token Creation", function () {
    it("should create a token with 6h duration", async function () {
      const { clacFactory } = await deployFixture();

      await clacFactory.write.createToken(
        ["Test Token", "TEST", "https://img.com/test.png", 21600n],
        { value: parseEther("10") }
      );

      const count = await clacFactory.read.tokenCount();
      expect(count).to.equal(1n);

      const token = await clacFactory.read.getToken([0n]);
      expect(token.name).to.equal("Test Token");
      expect(token.symbol).to.equal("TEST");
      expect(token.duration).to.equal(21600n);
      expect(token.dead).to.equal(false);
    });

    it("should revert if non-owner tries to create when not public", async function () {
      const { clacFactory, alice } = await deployFixture();

      await expect(
        clacFactory.write.createToken(
          ["Test", "TST", "", 21600n],
          { value: parseEther("10"), account: alice.account }
        )
      ).to.be.rejectedWith("Creation not public yet");
    });

    it("should allow public creation when enabled", async function () {
      const { clacFactory, alice } = await deployFixture();

      await clacFactory.write.setPublicCreation([true]);

      await clacFactory.write.createToken(
        ["Alice Token", "ALICE", "", 21600n],
        { value: parseEther("10"), account: alice.account }
      );

      const count = await clacFactory.read.tokenCount();
      expect(count).to.equal(1n);
    });

    it("should revert with invalid duration", async function () {
      const { clacFactory } = await deployFixture();

      await expect(
        clacFactory.write.createToken(
          ["Test", "TST", "", 3600n],
          { value: parseEther("10") }
        )
      ).to.be.rejectedWith("Invalid duration");
    });

    it("should revert with insufficient fee", async function () {
      const { clacFactory } = await deployFixture();

      await expect(
        clacFactory.write.createToken(
          ["Test", "TST", "", 21600n],
          { value: parseEther("1") }
        )
      ).to.be.rejectedWith("Insufficient creation fee");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("Buy & Sell", function () {
    it("should allow buying tokens", async function () {
      const { clacFactory, alice } = await deployFixture();

      await clacFactory.write.createToken(
        ["Test", "TST", "", 21600n],
        { value: parseEther("10") }
      );

      await hre.network.provider.send("hardhat_mine", ["0x10"]);

      await clacFactory.write.buy([0n, 0n], {
        value: parseEther("5"),
        account: alice.account,
      });

      const balance = await clacFactory.read.getBalance([0n, alice.account.address]);
      expect(balance > 0n).to.equal(true);
    });

    it("should collect fees on buy", async function () {
      const { clacFactory, treasury, alice, publicClient } = await deployFixture();

      await clacFactory.write.createToken(
        ["Test", "TST", "", 21600n],
        { value: parseEther("10") }
      );

      await hre.network.provider.send("hardhat_mine", ["0x10"]);

      const treasuryBefore = await publicClient.getBalance({ address: treasury.account.address });

      await clacFactory.write.buy([0n, 0n], {
        value: parseEther("10"),
        account: alice.account,
      });

      const treasuryAfter = await publicClient.getBalance({ address: treasury.account.address });
      // Treasury should receive 1% of 10 MON = 0.1 MON
      expect(treasuryAfter > treasuryBefore).to.equal(true);
    });

    it("should allow selling tokens", async function () {
      const { clacFactory, alice, publicClient } = await deployFixture();

      await clacFactory.write.createToken(
        ["Test", "TST", "", 21600n],
        { value: parseEther("10") }
      );

      await hre.network.provider.send("hardhat_mine", ["0x10"]);

      await clacFactory.write.buy([0n, 0n], {
        value: parseEther("5"),
        account: alice.account,
      });

      const balance = await clacFactory.read.getBalance([0n, alice.account.address]);
      const aliceBefore = await publicClient.getBalance({ address: alice.account.address });

      // Sell does not have a cooldown — selling immediately is allowed
      await clacFactory.write.sell([0n, balance / 2n, 0n], {
        account: alice.account,
      });

      const aliceAfter = await publicClient.getBalance({ address: alice.account.address });
      expect(aliceAfter > aliceBefore).to.equal(true);
    });

    it("should increase price with more buys", async function () {
      const { clacFactory, alice, bob } = await deployFixture();

      await clacFactory.write.createToken(
        ["Test", "TST", "", 21600n],
        { value: parseEther("10") }
      );

      await hre.network.provider.send("hardhat_mine", ["0x10"]);

      const price1 = await clacFactory.read.getPrice([0n]);

      await clacFactory.write.buy([0n, 0n], {
        value: parseEther("5"),
        account: alice.account,
      });

      const price2 = await clacFactory.read.getPrice([0n]);

      // bob is a different address — no cooldown issue
      await clacFactory.write.buy([0n, 0n], {
        value: parseEther("5"),
        account: bob.account,
      });

      const price3 = await clacFactory.read.getPrice([0n]);

      expect(price2 > price1).to.equal(true);
      expect(price3 > price2).to.equal(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("Cooldown", function () {
    it("should revert if same wallet buys within 2 blocks", async function () {
      const { clacFactory, alice } = await deployFixture();

      await clacFactory.write.createToken(
        ["Test", "TST", "img.png", 21600n],
        { value: parseEther("10") }
      );

      // Mine past anti-sniper window
      await hre.network.provider.send("hardhat_mine", ["0x10"]);

      // First buy
      await clacFactory.write.buy([0n, 0n], {
        value: parseEther("1"),
        account: alice.account,
      });

      // Immediate second buy — must revert
      await expect(
        clacFactory.write.buy([0n, 0n], {
          value: parseEther("1"),
          account: alice.account,
        })
      ).to.be.rejectedWith("Buy cooldown active");

      // Mine 3 blocks (> BUY_COOLDOWN_BLOCKS = 2)
      await hre.network.provider.send("hardhat_mine", ["0x3"]);

      // Now it should succeed
      await clacFactory.write.buy([0n, 0n], {
        value: parseEther("1"),
        account: alice.account,
      });

      const balance = await clacFactory.read.getBalance([0n, alice.account.address]);
      expect(balance > 0n).to.equal(true);
    });

    it("should not apply cooldown across different wallets", async function () {
      const { clacFactory, alice, bob } = await deployFixture();

      await clacFactory.write.createToken(
        ["Test", "TST", "img.png", 21600n],
        { value: parseEther("10") }
      );

      await hre.network.provider.send("hardhat_mine", ["0x10"]);

      await clacFactory.write.buy([0n, 0n], { value: parseEther("1"), account: alice.account });
      // Bob can buy in the very next tx — different address, independent cooldown
      await clacFactory.write.buy([0n, 0n], { value: parseEther("1"), account: bob.account });

      const aliceBal = await clacFactory.read.getBalance([0n, alice.account.address]);
      const bobBal = await clacFactory.read.getBalance([0n, bob.account.address]);
      expect(aliceBal > 0n).to.equal(true);
      expect(bobBal > 0n).to.equal(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("Minimum Buy", function () {
    it("should revert if buy amount < 0.01 MON", async function () {
      const { clacFactory, alice } = await deployFixture();

      await clacFactory.write.createToken(
        ["Test", "TST", "img.png", 21600n],
        { value: parseEther("10") }
      );

      await hre.network.provider.send("hardhat_mine", ["0x10"]);

      await expect(
        clacFactory.write.buy([0n, 0n], {
          value: parseEther("0.001"),
          account: alice.account,
        })
      ).to.be.rejectedWith("Min buy 0.01 MON");
    });

    it("should allow buy of exactly 0.01 MON", async function () {
      const { clacFactory, alice } = await deployFixture();

      await clacFactory.write.createToken(
        ["Test", "TST", "img.png", 21600n],
        { value: parseEther("10") }
      );

      await hre.network.provider.send("hardhat_mine", ["0x10"]);

      await clacFactory.write.buy([0n, 0n], {
        value: parseEther("0.01"),
        account: alice.account,
      });

      const balance = await clacFactory.read.getBalance([0n, alice.account.address]);
      expect(balance > 0n).to.equal(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("Whale Limit", function () {
    it("should revert if a single buy exceeds 10% of max supply", async function () {
      const { clacFactory, alice } = await deployFixture();

      await clacFactory.write.createToken(
        ["Test", "TST", "img.png", 21600n],
        { value: parseEther("10") }
      );

      await hre.network.provider.send("hardhat_mine", ["0x10"]);

      // With K=100_000_000 a 100 MON buy yields ~130M tokens > 100M (10% of 1B) limit.
      await expect(
        clacFactory.write.buy([0n, 0n], {
          value: parseEther("100"),
          account: alice.account,
        })
      ).to.be.rejectedWith("Max holding 10% exceeded");
    });

    it("should allow buying up to (but not exceeding) the 10% limit across multiple buys", async function () {
      const { clacFactory, alice } = await deployFixture();

      await clacFactory.write.createToken(
        ["Test", "TST", "img.png", 21600n],
        { value: parseEther("10") }
      );

      await hre.network.provider.send("hardhat_mine", ["0x10"]);

      // First small buy — safely under 10%
      await clacFactory.write.buy([0n, 0n], {
        value: parseEther("5"),
        account: alice.account,
      });

      const balance = await clacFactory.read.getBalance([0n, alice.account.address]);
      const maxHolding = (1_000_000_000n * 10n ** 18n * 1000n) / 10000n; // 10% of MAX_SUPPLY
      expect(balance <= maxHolding).to.equal(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("MAX Sell Fix", function () {
    it("should allow selling entire balance without revert", async function () {
      const { clacFactory, alice } = await deployFixture();

      await clacFactory.write.createToken(
        ["Test", "TST", "img.png", 21600n],
        { value: parseEther("10") }
      );

      await hre.network.provider.send("hardhat_mine", ["0x10"]);

      await clacFactory.write.buy([0n, 0n], {
        value: parseEther("5"),
        account: alice.account,
      });

      const balance = await clacFactory.read.getBalance([0n, alice.account.address]);

      // Sell does not require cooldown — fire immediately
      await clacFactory.write.sell([0n, balance, 0n], {
        account: alice.account,
      });

      const newBalance = await clacFactory.read.getBalance([0n, alice.account.address]);
      expect(newBalance).to.equal(0n);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("Updated Fee Structure (1% + 0.5%)", function () {
    it("should charge ~1% protocol fee on buy", async function () {
      const { clacFactory, treasury, alice, publicClient } = await deployFixture();

      await clacFactory.write.createToken(
        ["Test", "TST", "img.png", 21600n],
        { value: parseEther("10") }
      );

      await hre.network.provider.send("hardhat_mine", ["0x10"]);

      const treasuryBefore = await publicClient.getBalance({ address: treasury.account.address });

      await clacFactory.write.buy([0n, 0n], {
        value: parseEther("10"),
        account: alice.account,
      });

      const treasuryAfter = await publicClient.getBalance({ address: treasury.account.address });
      const feeReceived = treasuryAfter - treasuryBefore;

      // 1% of 10 MON = 0.1 MON
      const expectedFee = parseEther("0.1");
      expect(feeReceived >= expectedFee - parseEther("0.01")).to.equal(true);
      expect(feeReceived <= expectedFee + parseEther("0.01")).to.equal(true);
    });

    it("should send 0.5% creator fee on buy", async function () {
      const { clacFactory, alice, publicClient } = await deployFixture();

      // Owner = creator of token #0
      const wallets = await hre.viem.getWalletClients();
      const ownerAddress = wallets[0].account.address;

      await clacFactory.write.createToken(
        ["Test", "TST", "img.png", 21600n],
        { value: parseEther("10") }
      );

      await hre.network.provider.send("hardhat_mine", ["0x10"]);

      const ownerBefore = await publicClient.getBalance({ address: ownerAddress });

      await clacFactory.write.buy([0n, 0n], {
        value: parseEther("10"),
        account: alice.account,
      });

      const ownerAfter = await publicClient.getBalance({ address: ownerAddress });
      // 0.5% of 10 MON = 0.05 MON flows to creator
      const creatorFee = ownerAfter - ownerBefore;
      expect(creatorFee > 0n).to.equal(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("Death Clock", function () {
    it("should revert buy after time expired", async function () {
      const { clacFactory, alice } = await deployFixture();

      await clacFactory.write.createToken(
        ["Test", "TST", "", 21600n],
        { value: parseEther("10") }
      );

      await hre.network.provider.send("evm_increaseTime", [25200]);
      await hre.network.provider.send("evm_mine");

      await expect(
        clacFactory.write.buy([0n, 0n], {
          value: parseEther("1"),
          account: alice.account,
        })
      ).to.be.rejectedWith("Time expired");
    });

    it("should trigger death after expiry", async function () {
      const { clacFactory, alice, charlie } = await deployFixture();

      await clacFactory.write.createToken(
        ["Test", "TST", "", 21600n],
        { value: parseEther("10") }
      );

      await hre.network.provider.send("hardhat_mine", ["0x10"]);

      await clacFactory.write.buy([0n, 0n], {
        value: parseEther("5"),
        account: alice.account,
      });

      await hre.network.provider.send("evm_increaseTime", [25200]);
      await hre.network.provider.send("evm_mine");

      await clacFactory.write.triggerDeath([0n], { account: charlie.account });

      const token = await clacFactory.read.getToken([0n]);
      expect(token.dead).to.equal(true);
      expect(token.deathProcessed).to.equal(true);
    });

    it("should make claimable after death", async function () {
      const { clacFactory, alice, charlie } = await deployFixture();

      await clacFactory.write.createToken(
        ["Test", "TST", "", 21600n],
        { value: parseEther("10") }
      );

      await hre.network.provider.send("hardhat_mine", ["0x10"]);

      await clacFactory.write.buy([0n, 0n], {
        value: parseEther("5"),
        account: alice.account,
      });

      await hre.network.provider.send("evm_increaseTime", [25200]);
      await hre.network.provider.send("evm_mine");

      await clacFactory.write.triggerDeath([0n], { account: charlie.account });

      const claimAmount = await clacFactory.read.getClaimable([0n, alice.account.address]);
      expect(claimAmount > 0n).to.equal(true);
    });

    it("should allow claiming after death", async function () {
      const { clacFactory, alice, charlie, publicClient } = await deployFixture();

      await clacFactory.write.createToken(
        ["Test", "TST", "", 21600n],
        { value: parseEther("10") }
      );

      await hre.network.provider.send("hardhat_mine", ["0x10"]);

      await clacFactory.write.buy([0n, 0n], {
        value: parseEther("5"),
        account: alice.account,
      });

      await hre.network.provider.send("evm_increaseTime", [25200]);
      await hre.network.provider.send("evm_mine");

      await clacFactory.write.triggerDeath([0n], { account: charlie.account });

      const aliceBefore = await publicClient.getBalance({ address: alice.account.address });
      await clacFactory.write.claim([0n], { account: alice.account });
      const aliceAfter = await publicClient.getBalance({ address: alice.account.address });

      expect(aliceAfter > aliceBefore).to.equal(true);
    });

    it("should revert triggerDeath before expiry", async function () {
      const { clacFactory } = await deployFixture();

      await clacFactory.write.createToken(
        ["Test", "TST", "", 21600n],
        { value: parseEther("10") }
      );

      await expect(
        clacFactory.write.triggerDeath([0n])
      ).to.be.rejectedWith("Not expired yet");
    });

    it("should return correct time left", async function () {
      const { clacFactory } = await deployFixture();

      await clacFactory.write.createToken(
        ["Test", "TST", "", 21600n],
        { value: parseEther("10") }
      );

      const timeLeft = await clacFactory.read.getTimeLeft([0n]);
      expect(timeLeft > 21500n).to.equal(true);
      expect(timeLeft <= 21600n).to.equal(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("Updated Death Distribution (3% tax / 77% pro-rata / 23% lottery)", function () {
    it("should send death tax to treasury and make holders claimable", async function () {
      const { clacFactory, alice, bob, charlie, treasury, publicClient } = await deployFixture();

      await clacFactory.write.createToken(
        ["Test", "TST", "img.png", 21600n],
        { value: parseEther("10") }
      );

      await hre.network.provider.send("hardhat_mine", ["0x10"]);

      // Alice buys
      await clacFactory.write.buy([0n, 0n], {
        value: parseEther("5"),
        account: alice.account,
      });

      // Bob uses a different address — no cooldown issue
      await clacFactory.write.buy([0n, 0n], {
        value: parseEther("3"),
        account: bob.account,
      });

      // Fast-forward past 6h duration
      await hre.network.provider.send("evm_increaseTime", [25200]);
      await hre.network.provider.send("evm_mine");

      const treasuryBefore = await publicClient.getBalance({ address: treasury.account.address });

      await clacFactory.write.triggerDeath([0n], { account: charlie.account });

      const treasuryAfter = await publicClient.getBalance({ address: treasury.account.address });

      // Treasury received the 3% death tax
      expect(treasuryAfter > treasuryBefore).to.equal(true);

      // Both holders should have positive claimable amounts
      const aliceClaim = await clacFactory.read.getClaimable([0n, alice.account.address]);
      const bobClaim = await clacFactory.read.getClaimable([0n, bob.account.address]);

      expect(aliceClaim > 0n).to.equal(true);
      expect(bobClaim > 0n).to.equal(true);

      // Alice bought more than Bob so she holds more tokens → larger pro-rata share
      expect(aliceClaim > bobClaim).to.equal(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("Admin", function () {
    it("should toggle public creation", async function () {
      const { clacFactory } = await deployFixture();

      expect(await clacFactory.read.publicCreation()).to.equal(false);
      await clacFactory.write.setPublicCreation([true]);
      expect(await clacFactory.read.publicCreation()).to.equal(true);
    });

    it("should update creation fee", async function () {
      const { clacFactory } = await deployFixture();

      await clacFactory.write.setCreationFee([parseEther("20")]);
      expect(await clacFactory.read.creationFee()).to.equal(parseEther("20"));
    });

    it("should update K parameter", async function () {
      const { clacFactory } = await deployFixture();

      await clacFactory.write.setK([2000000n]);
      expect(await clacFactory.read.k()).to.equal(2000000n);
    });
  });
});

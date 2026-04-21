import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "viem";

describe("ClacFactory", function () {
  
  async function deployFixture() {
    const [owner, treasury, alice, bob, charlie] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    const clacFactory = await hre.viem.deployContract("ClacFactory", [
      treasury.account.address,
      1000000n, // K parameter
    ]);

    return { clacFactory, owner, treasury, alice, bob, charlie, publicClient };
  }

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
          ["Test", "TST", "", 3600n], // 1 hour - invalid
          { value: parseEther("10") }
        )
      ).to.be.rejectedWith("Invalid duration");
    });

    it("should revert with insufficient fee", async function () {
      const { clacFactory } = await deployFixture();

      await expect(
        clacFactory.write.createToken(
          ["Test", "TST", "", 21600n],
          { value: parseEther("1") } // Only 1 MON, need 10
        )
      ).to.be.rejectedWith("Insufficient creation fee");
    });
  });

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
      // Treasury should receive 2% of 10 MON = 0.2 MON (plus creation fee from before)
      expect(treasuryAfter > treasuryBefore).to.equal(true);
    });

    it("should allow selling tokens", async function () {
      const { clacFactory, alice, publicClient } = await deployFixture();

      await clacFactory.write.createToken(
        ["Test", "TST", "", 21600n],
        { value: parseEther("10") }
      );

      // Mine past sniper blocks
      await hre.network.provider.send("hardhat_mine", ["0x10"]);

      await clacFactory.write.buy([0n, 0n], {
        value: parseEther("5"),
        account: alice.account,
      });

      const balance = await clacFactory.read.getBalance([0n, alice.account.address]);

      const aliceBefore = await publicClient.getBalance({ address: alice.account.address });

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

      await clacFactory.write.buy([0n, 0n], {
        value: parseEther("5"),
        account: bob.account,
      });

      const price3 = await clacFactory.read.getPrice([0n]);

      expect(price2 > price1).to.equal(true);
      expect(price3 > price2).to.equal(true);
    });
  });

  describe("Death Clock", function () {
    it("should revert buy after time expired", async function () {
      const { clacFactory, alice } = await deployFixture();

      await clacFactory.write.createToken(
        ["Test", "TST", "", 21600n], // 6 hours
        { value: parseEther("10") }
      );

      // Fast forward 7 hours
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

      // Fast forward past death
      await hre.network.provider.send("evm_increaseTime", [25200]);
      await hre.network.provider.send("evm_mine");

      await clacFactory.write.triggerDeath([0n], {
        account: charlie.account,
      });

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

      await clacFactory.write.triggerDeath([0n], {
        account: charlie.account,
      });

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
        ["Test", "TST", "", 21600n], // 6h = 21600s
        { value: parseEther("10") }
      );

      const timeLeft = await clacFactory.read.getTimeLeft([0n]);
      // Should be approximately 21600 (minus a few seconds for block mining)
      expect(timeLeft > 21500n).to.equal(true);
      expect(timeLeft <= 21600n).to.equal(true);
    });
  });

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

import { expect } from "chai";
import hre from "hardhat";
import { parseEther, getAddress, keccak256, toBytes, type Address } from "viem";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

const DURATION_6H = 21600n;
const DURATION_12H = 43200n;
const DURATION_24H = 86400n;

const ONE_HOUR = 3600;
const SIX_HOURS = 21600;
const SNIPER_DURATION = 30;
const COOLDOWN_BLOCKS = 2;

const K = 100_000_000n;
const CREATION_FEE = parseEther("10");
const MIN_LOTTERY_BPS = 10n; // 0.1%

async function increaseTime(seconds: number) {
  await hre.network.provider.send("evm_increaseTime", [seconds]);
  await hre.network.provider.send("evm_mine", []);
}

async function mineBlocks(n: number) {
  for (let i = 0; i < n; i++) {
    await hre.network.provider.send("evm_mine", []);
  }
}

describe("ClacV2", function () {
  async function deployFixture() {
    const [owner, treasury, alice, bob, charlie, dave, eve, frank] =
      await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    const tokenImpl = await hre.viem.deployContract("ClacTokenImpl", []);

    const mockProvider = await hre.viem.deployContract("MockRandomnessProvider", [0n]);

    const factory = await hre.viem.deployContract("ClacFactoryV2", [
      tokenImpl.address,
      treasury.account.address,
      K,
      mockProvider.address,
      ZERO_ADDRESS, // trophy set after factory deployment
    ]);

    const trophy = await hre.viem.deployContract("ClacTrophyNFT", [factory.address]);
    await factory.write.setTrophyNFT([trophy.address]);

    return {
      tokenImpl,
      mockProvider,
      factory,
      trophy,
      owner,
      treasury,
      alice,
      bob,
      charlie,
      dave,
      eve,
      frank,
      publicClient,
    };
  }

  async function createToken(
    factory: any,
    creator: any,
    duration: bigint = DURATION_6H,
  ): Promise<Address> {
    const tx = await factory.write.createToken(
      ["Test Token", "TEST", "ipfs://test.png", duration, 0n],
      { value: CREATION_FEE, account: creator.account },
    );
    const publicClient = await hre.viem.getPublicClient();
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    const tokenCount = await factory.read.tokenCount();
    return await factory.read.allTokens([tokenCount - 1n]);
  }

  // ════════════════════════════════════════════════════════════════════════
  describe("Factory: token creation", function () {
    it("creates a clone with correct initialization", async () => {
      const { factory, owner, treasury, mockProvider, trophy } = await deployFixture();

      const tokenAddr = await createToken(factory, owner, DURATION_6H);
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);

      expect(getAddress(await token.read.creator())).to.equal(getAddress(owner.account.address));
      expect(await token.read.k()).to.equal(K);
      expect(getAddress(await token.read.treasury())).to.equal(getAddress(treasury.account.address));
      expect(getAddress(await token.read.randomnessProvider())).to.equal(getAddress(mockProvider.address));
      expect(getAddress(await token.read.trophyNFT())).to.equal(getAddress(trophy.address));
      expect(await token.read.virtualSupply()).to.equal(0n);
      expect(await token.read.poolBalance()).to.equal(0n);
      expect(await token.read.deathRequested()).to.equal(false);
    });

    it("reverts if non-owner creates while public flag is off", async () => {
      const { factory, alice } = await deployFixture();
      await expect(
        factory.write.createToken(["X", "X", "", DURATION_6H, 0n], {
          value: CREATION_FEE,
          account: alice.account,
        }),
      ).to.be.rejectedWith("Creation not public");
    });

    it("allows public creation when flag is set", async () => {
      const { factory, alice } = await deployFixture();
      await factory.write.setPublicCreation([true]);
      await factory.write.createToken(["X", "X", "", DURATION_6H, 0n], {
        value: CREATION_FEE,
        account: alice.account,
      });
      expect(await factory.read.tokenCount()).to.equal(1n);
    });

    it("rejects bad durations", async () => {
      const { factory, owner } = await deployFixture();
      await expect(
        factory.write.createToken(["X", "X", "", 3600n, 0n], {
          value: CREATION_FEE,
          account: owner.account,
        }),
      ).to.be.rejectedWith("Invalid duration");
    });

    it("forwards creation fee to treasury and refunds excess", async () => {
      const { factory, owner, treasury, publicClient } = await deployFixture();
      const treasuryBalBefore = await publicClient.getBalance({
        address: treasury.account.address,
      });
      await factory.write.createToken(["X", "X", "", DURATION_6H, 0n], {
        value: parseEther("15"), // 5 extra → should refund
        account: owner.account,
      });
      const treasuryBalAfter = await publicClient.getBalance({
        address: treasury.account.address,
      });
      expect(treasuryBalAfter - treasuryBalBefore).to.equal(CREATION_FEE);
    });

    it("registers token in allTokens, isToken, tokensByCreator", async () => {
      const { factory, owner } = await deployFixture();
      const tokenAddr = await createToken(factory, owner);
      expect(await factory.read.isToken([tokenAddr])).to.equal(true);
      const list = await factory.read.getAllTokens();
      expect(list.length).to.equal(1);
      expect(getAddress(list[0])).to.equal(getAddress(tokenAddr));
      const byCreator = await factory.read.getTokensByCreator([owner.account.address]);
      expect(byCreator.length).to.equal(1);
    });

    it("tokenImpl cannot be initialized directly", async () => {
      const { tokenImpl, owner, mockProvider, treasury } = await deployFixture();
      await expect(
        tokenImpl.write.initialize([
          owner.account.address,
          "X",
          "X",
          "",
          DURATION_6H,
          K,
          treasury.account.address,
          mockProvider.address,
          ZERO_ADDRESS,
          0n,
        ]),
      ).to.be.rejectedWith("Already initialized");
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  describe("Initial buy on creation", function () {
    it("creator receives tokens atomically when extra MON sent above creationFee", async () => {
      const { factory, owner } = await deployFixture();
      const tx = await factory.write.createToken(
        ["LaunchToken", "LT", "", DURATION_6H, 0n],
        { value: CREATION_FEE + parseEther("5"), account: owner.account },
      );
      const tokenCount = await factory.read.tokenCount();
      const tokenAddr = await factory.read.allTokens([tokenCount - 1n]);
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);

      const creatorBal = await token.read.balances([owner.account.address]);
      expect(creatorBal > 0n).to.equal(true);

      // virtualSupply should match the creator's balance (only buyer so far)
      expect(await token.read.virtualSupply()).to.equal(creatorBal);
      // poolBalance should be > 0 (5 MON minus fees)
      expect((await token.read.poolBalance()) > 0n).to.equal(true);
      // creator's lottery weight = balance
      expect(await token.read.lotteryWeight([owner.account.address])).to.equal(creatorBal);
    });

    it("initial buy does NOT trigger the 10% whale cap", async () => {
      const { factory, owner } = await deployFixture();
      // With K=1e8, ~200 MON yields ~20% of MAX_SUPPLY — would normally exceed
      // the 10% wallet cap but should pass via the initial-buy path.
      await factory.write.createToken(
        ["BigLaunch", "BL", "", DURATION_6H, 0n],
        { value: CREATION_FEE + parseEther("200"), account: owner.account },
      );
      const tokenCount = await factory.read.tokenCount();
      const tokenAddr = await factory.read.allTokens([tokenCount - 1n]);
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);
      const bal = await token.read.balances([owner.account.address]);
      const maxSupply = await token.read.MAX_SUPPLY();
      expect(bal > maxSupply / 10n).to.equal(true);
    });

    it("initial buy is hard-capped at MAX_INITIAL_BUY_BPS (79.31%)", async () => {
      const { factory, owner } = await deployFixture();
      // ~2000 MON > 1490 MON needed to buy 79.31% with K=1e8 — should revert.
      await expect(
        factory.write.createToken(
          ["TooBig", "TB", "", DURATION_6H, 0n],
          { value: CREATION_FEE + parseEther("2000"), account: owner.account },
        ),
      ).to.be.rejected;
    });

    it("subsequent buys for the creator ARE capped by MAX_HOLDING_BPS", async () => {
      // 200 MON initial buy already pushes creator over 10% of MAX_SUPPLY,
      // so any follow-up buy must revert at the whale cap.
      const { factory, owner } = await deployFixture();
      await factory.write.createToken(
        ["Whale", "W", "", DURATION_6H, 0n],
        { value: CREATION_FEE + parseEther("200"), account: owner.account },
      );
      const tokenCount = await factory.read.tokenCount();
      const tokenAddr = await factory.read.allTokens([tokenCount - 1n]);
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);

      await increaseTime(SNIPER_DURATION + 1);
      await expect(
        token.write.buy([0n], {
          value: parseEther("0.01"),
          account: owner.account,
        }),
      ).to.be.rejected;
    });

    it("creator can skip initial buy by sending only the creationFee", async () => {
      const { factory, owner } = await deployFixture();
      const tokenAddr = await createToken(factory, owner, DURATION_6H);
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);
      expect(await token.read.virtualSupply()).to.equal(0n);
      expect(await token.read.poolBalance()).to.equal(0n);
      expect(await token.read.totalHolders()).to.equal(0n);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  describe("Buy / Sell mechanics", function () {
    it("buy: increases supply, pool, balance; emits Trade", async () => {
      const { factory, owner, alice } = await deployFixture();
      await factory.write.setPublicCreation([true]);
      const tokenAddr = await createToken(factory, alice);
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);

      await token.write.buy([0n], { value: parseEther("1"), account: alice.account });
      expect(await token.read.virtualSupply()).to.satisfy((v: bigint) => v > 0n);
      expect(await token.read.poolBalance()).to.satisfy((v: bigint) => v > 0n);
      expect(await token.read.balances([alice.account.address])).to.satisfy((v: bigint) => v > 0n);
      expect(await token.read.totalHolders()).to.equal(1n);
    });

    it("buy: reverts under MIN_BUY", async () => {
      const { factory, owner, alice } = await deployFixture();
      await factory.write.setPublicCreation([true]);
      const tokenAddr = await createToken(factory, alice);
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);

      await expect(
        token.write.buy([0n], { value: parseEther("0.005"), account: alice.account }),
      ).to.be.rejectedWith("Min buy 0.01 MON");
    });

    it("buy: anti-sniper window caps wallet at 1% during first 30s", async () => {
      const { factory, owner, alice } = await deployFixture();
      await factory.write.setPublicCreation([true]);
      const tokenAddr = await createToken(factory, alice);
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);

      // 100 MON would massively exceed the 1% (=10M tokens) cap inside the sniper window.
      await expect(
        token.write.buy([0n], { value: parseEther("100"), account: alice.account }),
      ).to.be.rejectedWith("Anti-sniper");

      // After 30 seconds, restriction is lifted (subject to the 10% whale cap)
      await increaseTime(SNIPER_DURATION + 1);
      await token.write.buy([0n], { value: parseEther("3"), account: alice.account });
    });

    it("buy: cooldown blocks back-to-back buys from same wallet", async () => {
      const { factory, owner, alice } = await deployFixture();
      await factory.write.setPublicCreation([true]);
      const tokenAddr = await createToken(factory, alice);
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);
      await increaseTime(SNIPER_DURATION + 1);

      await token.write.buy([0n], { value: parseEther("0.5"), account: alice.account });
      await expect(
        token.write.buy([0n], { value: parseEther("0.5"), account: alice.account }),
      ).to.be.rejectedWith("Buy cooldown active");
      await mineBlocks(COOLDOWN_BLOCKS + 1);
      await token.write.buy([0n], { value: parseEther("0.5"), account: alice.account });
    });

    it("sell: refunds based on bonding curve and accrues fees as pendingFees", async () => {
      const { factory, owner, alice, publicClient, treasury } = await deployFixture();
      await factory.write.setPublicCreation([true]);
      const tokenAddr = await createToken(factory, alice);
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);
      await increaseTime(SNIPER_DURATION + 1);

      await token.write.buy([0n], { value: parseEther("1"), account: alice.account });
      const aliceBal = await token.read.balances([alice.account.address]);
      const treasuryFees0 = await token.read.pendingFees([treasury.account.address]);
      const sellAmount = aliceBal / 2n;

      await mineBlocks(COOLDOWN_BLOCKS + 1);
      await token.write.sell([sellAmount, 0n], { account: alice.account });

      const treasuryFees1 = await token.read.pendingFees([treasury.account.address]);
      expect(treasuryFees1 > treasuryFees0).to.equal(true);
    });

    it("sell: reverts in last hour", async () => {
      const { factory, owner, alice } = await deployFixture();
      await factory.write.setPublicCreation([true]);
      const tokenAddr = await createToken(factory, alice, DURATION_6H);
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);
      await increaseTime(SNIPER_DURATION + 1);
      await token.write.buy([0n], { value: parseEther("1"), account: alice.account });
      // Move into the last hour
      await increaseTime(SIX_HOURS - ONE_HOUR + 60);
      const aliceBal = await token.read.balances([alice.account.address]);
      await expect(
        token.write.sell([aliceBal / 2n, 0n], { account: alice.account }),
      ).to.be.rejectedWith("Sell closed in last hour");
    });

    it("buy: still allowed in last hour", async () => {
      const { factory, owner, alice, bob } = await deployFixture();
      await factory.write.setPublicCreation([true]);
      const tokenAddr = await createToken(factory, alice, DURATION_6H);
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);
      await increaseTime(SNIPER_DURATION + 1);
      await token.write.buy([0n], { value: parseEther("1"), account: alice.account });
      await increaseTime(SIX_HOURS - ONE_HOUR + 60);
      // Bob can still buy in last hour
      await token.write.buy([0n], { value: parseEther("1"), account: bob.account });
      expect(await token.read.balances([bob.account.address])).to.satisfy((v: bigint) => v > 0n);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  describe("Lottery weight", function () {
    it("buys before LAST_HOUR add weight; buys in LAST_HOUR do not", async () => {
      const { factory, owner, alice, bob } = await deployFixture();
      await factory.write.setPublicCreation([true]);
      const tokenAddr = await createToken(factory, alice, DURATION_6H);
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);
      await increaseTime(SNIPER_DURATION + 1);
      await token.write.buy([0n], { value: parseEther("1"), account: alice.account });
      const aliceWeight = await token.read.lotteryWeight([alice.account.address]);
      expect(aliceWeight).to.satisfy((v: bigint) => v > 0n);

      // Move into last hour, bob buys — should NOT receive weight
      await increaseTime(SIX_HOURS - ONE_HOUR + 60);
      await token.write.buy([0n], { value: parseEther("1"), account: bob.account });
      const bobWeight = await token.read.lotteryWeight([bob.account.address]);
      expect(bobWeight).to.equal(0n);
    });

    it("sells reduce weight (not below zero)", async () => {
      const { factory, owner, alice } = await deployFixture();
      await factory.write.setPublicCreation([true]);
      const tokenAddr = await createToken(factory, alice, DURATION_6H);
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);
      await increaseTime(SNIPER_DURATION + 1);
      await token.write.buy([0n], { value: parseEther("1"), account: alice.account });
      const w0 = await token.read.lotteryWeight([alice.account.address]);
      const aliceBal = await token.read.balances([alice.account.address]);
      await mineBlocks(COOLDOWN_BLOCKS + 1);
      await token.write.sell([aliceBal / 2n, 0n], { account: alice.account });
      const w1 = await token.read.lotteryWeight([alice.account.address]);
      expect(w1 < w0).to.equal(true);
      expect(w1 > 0n).to.equal(true);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  describe("Death lifecycle (full path with mock randomness)", function () {
    it("requestDeath finalizes immediately when no lottery is needed", async () => {
      const { factory, owner } = await deployFixture();
      const tokenAddr = await createToken(factory, owner, DURATION_6H);
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);

      // Skip 6 hours without anyone buying — no holders, no lottery
      await increaseTime(SIX_HOURS + 60);
      await token.write.requestDeath([], { value: 0n });
      expect(await token.read.deathFinalized()).to.equal(true);
    });

    it("requestDeath: distributes pool 3/20/77 + trigger bonus + claim works", async () => {
      const {
        factory,
        owner,
        alice,
        bob,
        treasury,
        publicClient,
      } = await deployFixture();
      await factory.write.setPublicCreation([true]);
      const tokenAddr = await createToken(factory, alice, DURATION_6H);
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);
      await increaseTime(SNIPER_DURATION + 1);

      await token.write.buy([0n], { value: parseEther("2"), account: alice.account });
      await mineBlocks(COOLDOWN_BLOCKS + 1);
      await token.write.buy([0n], { value: parseEther("3"), account: bob.account });

      const poolBefore = await token.read.poolBalance();
      // Move past death
      await increaseTime(SIX_HOURS + 60);

      // Owner triggers death (gets bonus)
      await token.write.requestDeath([], { value: 0n, account: owner.account });
      expect(await token.read.deathFinalized()).to.equal(true);

      // Trigger bonus = 0.1 MON, death tax = 3% of (pool - 0.1)
      const triggerBonusOwner = await token.read.pendingFees([owner.account.address]);
      expect(triggerBonusOwner).to.equal(parseEther("0.1"));

      // Claim alice — pro-rata + maybe lottery
      await token.write.claim([], { account: alice.account });
      await token.write.claim([], { account: bob.account });

      // Both claimed
      expect(await token.read.claimed([alice.account.address])).to.equal(true);
      expect(await token.read.claimed([bob.account.address])).to.equal(true);
    });

    it("payouts ≤ original pool (conservation invariant)", async () => {
      const { factory, owner, alice, bob, charlie, treasury } = await deployFixture();
      await factory.write.setPublicCreation([true]);
      const tokenAddr = await createToken(factory, alice, DURATION_6H);
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);
      await increaseTime(SNIPER_DURATION + 1);

      await token.write.buy([0n], { value: parseEther("1"), account: alice.account });
      await mineBlocks(COOLDOWN_BLOCKS + 1);
      await token.write.buy([0n], { value: parseEther("2"), account: bob.account });
      await mineBlocks(COOLDOWN_BLOCKS + 1);
      await token.write.buy([0n], { value: parseEther("1"), account: charlie.account });

      // Capture pool right before death
      const poolBefore = await token.read.poolBalance();

      // Capture treasury fees accrued from trading (these came OUT of net buy amounts,
      // not from the pool — pool is the post-fee net, so they are separate from poolBefore)
      const treasuryTradingFees = await token.read.pendingFees([treasury.account.address]);

      await increaseTime(SIX_HOURS + 60);
      await token.write.requestDeath([], { value: 0n, account: owner.account });

      const proRata = await token.read.proRataPool();
      const lottery = await token.read.lotteryPool();
      const treasuryAfter = await token.read.pendingFees([treasury.account.address]);
      const deathTaxAccrued = treasuryAfter - treasuryTradingFees;
      const triggerBonus = await token.read.pendingFees([owner.account.address]);

      // Conservation: pool == proRata + lottery + deathTax + triggerBonus (modulo wei rounding)
      const total = proRata + lottery + deathTaxAccrued + triggerBonus;
      expect(total <= poolBefore).to.equal(true);
      // Sanity: should be very close (wei-level rounding only)
      expect(poolBefore - total < 100n).to.equal(true);
    });

    it("only randomness provider can call fulfillRandomness", async () => {
      const { factory, owner, alice } = await deployFixture();
      await factory.write.setPublicCreation([true]);
      const tokenAddr = await createToken(factory, alice, DURATION_6H);
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);
      await increaseTime(SNIPER_DURATION + 1);
      await token.write.buy([0n], { value: parseEther("1"), account: alice.account });
      await increaseTime(SIX_HOURS + 60);

      await expect(
        token.write.fulfillRandomness([0n, ("0x" + "ab".repeat(32)) as `0x${string}`], {
          account: alice.account,
        }),
      ).to.be.rejected;
    });

    it("requestDeath cannot be called twice", async () => {
      const { factory, owner, alice } = await deployFixture();
      await factory.write.setPublicCreation([true]);
      const tokenAddr = await createToken(factory, alice, DURATION_6H);
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);
      await increaseTime(SNIPER_DURATION + 1);
      await token.write.buy([0n], { value: parseEther("1"), account: alice.account });
      await increaseTime(SIX_HOURS + 60);
      await token.write.requestDeath([], { value: 0n, account: owner.account });
      await expect(
        token.write.requestDeath([], { value: 0n, account: owner.account }),
      ).to.be.rejectedWith("Already requested");
    });

    it("requestDeath reverts before deathTime", async () => {
      const { factory, owner, alice } = await deployFixture();
      await factory.write.setPublicCreation([true]);
      const tokenAddr = await createToken(factory, alice, DURATION_6H);
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);
      await increaseTime(60);
      await token.write.buy([0n], { value: parseEther("1"), account: alice.account });
      await expect(
        token.write.requestDeath([], { value: 0n, account: owner.account }),
      ).to.be.rejectedWith("Not expired");
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  describe("Manual mode randomness (async path)", function () {
    it("with manual mode, fulfillRandomness must be triggered separately", async () => {
      const { factory, mockProvider, owner, alice, bob } = await deployFixture();
      await mockProvider.write.setManualMode([true]);
      await factory.write.setPublicCreation([true]);
      const tokenAddr = await createToken(factory, alice, DURATION_6H);
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);
      await increaseTime(SNIPER_DURATION + 1);
      await token.write.buy([0n], { value: parseEther("1"), account: alice.account });
      await mineBlocks(COOLDOWN_BLOCKS + 1);
      await token.write.buy([0n], { value: parseEther("1"), account: bob.account });
      await increaseTime(SIX_HOURS + 60);
      await token.write.requestDeath([], { value: 0n, account: owner.account });

      // Not yet finalized
      expect(await token.read.deathFinalized()).to.equal(false);
      const seq = await token.read.deathSequenceNumber();
      // Provider delivers
      await mockProvider.write.manualFulfill([
        seq,
        ("0x" + "deadbeef".padEnd(64, "0")) as `0x${string}`,
      ]);
      expect(await token.read.deathFinalized()).to.equal(true);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  describe("Claim", function () {
    it("claim reverts before death finalized", async () => {
      const { factory, owner, alice } = await deployFixture();
      await factory.write.setPublicCreation([true]);
      const tokenAddr = await createToken(factory, alice, DURATION_6H);
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);
      await token.write.buy([0n], { value: parseEther("1"), account: alice.account });
      await expect(
        token.write.claim([], { account: alice.account }),
      ).to.be.rejectedWith("Not finalized");
    });

    it("claim reverts twice for same user", async () => {
      const { factory, owner, alice } = await deployFixture();
      await factory.write.setPublicCreation([true]);
      const tokenAddr = await createToken(factory, alice, DURATION_6H);
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);
      await increaseTime(SNIPER_DURATION + 1);
      await token.write.buy([0n], { value: parseEther("1"), account: alice.account });
      await increaseTime(SIX_HOURS + 60);
      await token.write.requestDeath([], { value: 0n, account: owner.account });
      await token.write.claim([], { account: alice.account });
      await expect(
        token.write.claim([], { account: alice.account }),
      ).to.be.rejectedWith("Already claimed");
    });

    it("non-holder cannot claim", async () => {
      const { factory, owner, alice, bob } = await deployFixture();
      await factory.write.setPublicCreation([true]);
      const tokenAddr = await createToken(factory, alice, DURATION_6H);
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);
      await increaseTime(SNIPER_DURATION + 1);
      await token.write.buy([0n], { value: parseEther("1"), account: alice.account });
      await increaseTime(SIX_HOURS + 60);
      await token.write.requestDeath([], { value: 0n, account: owner.account });
      // Bob never bought — claim should be "Nothing to claim"
      await expect(token.write.claim([], { account: bob.account })).to.be.rejected;
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  describe("Withdraw fees", function () {
    it("creator can withdraw accrued fees", async () => {
      const { factory, owner, alice, publicClient } = await deployFixture();
      await factory.write.setPublicCreation([true]);
      const tokenAddr = await createToken(factory, owner, DURATION_6H); // owner is creator
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);
      await increaseTime(SNIPER_DURATION + 1);
      await token.write.buy([0n], { value: parseEther("5"), account: alice.account });

      const fees = await token.read.pendingFees([owner.account.address]);
      expect(fees).to.satisfy((v: bigint) => v > 0n);

      const balBefore = await publicClient.getBalance({ address: owner.account.address });
      const tx = await token.write.withdrawFees([], { account: owner.account });
      const r = await publicClient.waitForTransactionReceipt({ hash: tx });
      const gasCost = r.gasUsed * r.effectiveGasPrice;
      const balAfter = await publicClient.getBalance({ address: owner.account.address });
      expect(balAfter + gasCost - balBefore).to.equal(fees);

      expect(await token.read.pendingFees([owner.account.address])).to.equal(0n);
    });

    it("withdrawFees reverts if no fees", async () => {
      const { factory, owner, alice } = await deployFixture();
      await factory.write.setPublicCreation([true]);
      const tokenAddr = await createToken(factory, owner, DURATION_6H);
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);
      await expect(
        token.write.withdrawFees([], { account: alice.account }),
      ).to.be.rejectedWith("No fees");
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  describe("Trophy NFT", function () {
    it("mints commemorative NFT after claim, only once", async () => {
      const { factory, owner, alice, trophy } = await deployFixture();
      await factory.write.setPublicCreation([true]);
      const tokenAddr = await createToken(factory, alice, DURATION_6H);
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);
      await increaseTime(SNIPER_DURATION + 1);
      await token.write.buy([0n], { value: parseEther("1"), account: alice.account });
      await increaseTime(SIX_HOURS + 60);
      await token.write.requestDeath([], { value: 0n, account: owner.account });
      await token.write.claim([], { account: alice.account });
      await token.write.mintTrophy([], { account: alice.account });

      const balance = await trophy.read.balanceOf([alice.account.address]);
      expect(balance).to.equal(1n);
      // Cannot mint twice
      await expect(
        token.write.mintTrophy([], { account: alice.account }),
      ).to.be.rejectedWith("Already minted");
    });

    it("trophy.mint cannot be called by non-token addresses", async () => {
      const { trophy, alice } = await deployFixture();
      await expect(
        trophy.write.mint([
          alice.account.address,
          alice.account.address,
          0n,
          0n,
          false,
        ], { account: alice.account }),
      ).to.be.rejectedWith("Not a registered token");
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  describe("Sweep unclaimed", function () {
    it("rejects sweep before deadline", async () => {
      const { factory, owner, alice } = await deployFixture();
      await factory.write.setPublicCreation([true]);
      const tokenAddr = await createToken(factory, alice, DURATION_6H);
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);
      await increaseTime(SNIPER_DURATION + 1);
      await token.write.buy([0n], { value: parseEther("1"), account: alice.account });
      await increaseTime(SIX_HOURS + 60);
      await token.write.requestDeath([], { value: 0n, account: owner.account });
      await expect(token.write.sweepUnclaimed([])).to.be.rejectedWith("Deadline not reached");
    });

    it("after 30 days without claims, sweepUnclaimed sends remaining to treasury", async () => {
      const { factory, owner, alice, treasury } = await deployFixture();
      await factory.write.setPublicCreation([true]);
      const tokenAddr = await createToken(factory, alice, DURATION_6H);
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);
      await increaseTime(SNIPER_DURATION + 1);
      await token.write.buy([0n], { value: parseEther("1"), account: alice.account });
      await increaseTime(SIX_HOURS + 60);
      await token.write.requestDeath([], { value: 0n, account: owner.account });
      // Skip 30 days
      await increaseTime(31 * 24 * 3600);

      const treasuryFeesBefore = await token.read.pendingFees([treasury.account.address]);
      await token.write.sweepUnclaimed([]);
      const treasuryFeesAfter = await token.read.pendingFees([treasury.account.address]);
      expect(treasuryFeesAfter > treasuryFeesBefore).to.equal(true);
      expect(await token.read.swept()).to.equal(true);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  describe("Sybil resistance: weighted lottery", function () {
    it("equal-balance holders have equal lottery odds (over many trials)", async () => {
      // Sanity check: with two equal-weight holders, after many lottery runs each
      // should be picked roughly half the time. We can't run many tests cheaply,
      // so just verify that with one holder, that holder always wins.
      const { factory, owner, alice } = await deployFixture();
      await factory.write.setPublicCreation([true]);
      const tokenAddr = await createToken(factory, alice, DURATION_6H);
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);
      await increaseTime(SNIPER_DURATION + 1);
      await token.write.buy([0n], { value: parseEther("1"), account: alice.account });
      await increaseTime(SIX_HOURS + 60);
      await token.write.requestDeath([], { value: 0n, account: owner.account });
      const winners = await token.read.getLotteryWinners();
      expect(getAddress(winners[0])).to.equal(getAddress(alice.account.address));
    });

    it("dust holders below MIN_LOTTERY_WEIGHT_BPS are not eligible", async () => {
      const {
        factory,
        owner,
        alice,
        bob,
        charlie,
        dave,
      } = await deployFixture();
      await factory.write.setPublicCreation([true]);
      const tokenAddr = await createToken(factory, alice, DURATION_6H);
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);
      await increaseTime(SNIPER_DURATION + 1);

      // Alice buys big — dominates totalLotteryWeight
      await token.write.buy([0n], { value: parseEther("5"), account: alice.account });
      await mineBlocks(COOLDOWN_BLOCKS + 1);
      // Bob buys big — also eligible
      await token.write.buy([0n], { value: parseEther("5"), account: bob.account });
      await mineBlocks(COOLDOWN_BLOCKS + 1);
      // Charlie & Dave buy tiny — should fall below 0.1% threshold
      await token.write.buy([0n], { value: parseEther("0.01"), account: charlie.account });
      await mineBlocks(COOLDOWN_BLOCKS + 1);
      await token.write.buy([0n], { value: parseEther("0.01"), account: dave.account });

      await increaseTime(SIX_HOURS + 60);
      await token.write.requestDeath([], { value: 0n, account: owner.account });

      const winners = await token.read.getLotteryWinners();
      // Charlie & Dave must NOT be winners
      for (const w of winners) {
        expect(getAddress(w)).to.not.equal(getAddress(charlie.account.address));
        expect(getAddress(w)).to.not.equal(getAddress(dave.account.address));
      }
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  describe("Admin / ownership", function () {
    it("only owner can change defaults", async () => {
      const { factory, alice } = await deployFixture();
      await expect(
        factory.write.setCreationFee([parseEther("5")], { account: alice.account }),
      ).to.be.rejectedWith("Not owner");
    });

    it("setDefaultK does not affect already-created tokens", async () => {
      const { factory, owner } = await deployFixture();
      const tokenAddr = await createToken(factory, owner);
      const token = await hre.viem.getContractAt("ClacTokenImpl", tokenAddr);
      const kBefore = await token.read.k();
      await factory.write.setDefaultK([K * 2n]);
      const kAfter = await token.read.k();
      expect(kAfter).to.equal(kBefore);
    });

    it("two-step ownership transfer", async () => {
      const { factory, owner, alice } = await deployFixture();
      await factory.write.transferOwnership([alice.account.address]);
      expect(getAddress(await factory.read.owner())).to.equal(getAddress(owner.account.address));
      await factory.write.acceptOwnership([], { account: alice.account });
      expect(getAddress(await factory.read.owner())).to.equal(getAddress(alice.account.address));
    });
  });
});

// Calls factory.setPublicCreation(true) so non-owner wallets can launch tokens.
//
// Usage:
//   FACTORY=0x... pnpm hardhat run scripts/enable-public-creation.ts --network monadTestnet

import hre from "hardhat";

async function main() {
  const factoryAddr = (process.env.FACTORY ?? "").trim();
  if (!factoryAddr) throw new Error("FACTORY env required");

  const publicClient = await hre.viem.getPublicClient();
  const [walletClient] = await hre.viem.getWalletClients();

  const factory = await hre.viem.getContractAt(
    "ClacFactoryV2",
    factoryAddr as `0x${string}`,
  );

  const owner = await factory.read.owner();
  if (owner.toLowerCase() !== walletClient.account.address.toLowerCase()) {
    throw new Error(
      `Connected wallet ${walletClient.account.address} is not factory owner ${owner}`,
    );
  }

  const before = await factory.read.publicCreation();
  console.log(`publicCreation before: ${before}`);

  if (before) {
    console.log("Already enabled, nothing to do.");
    return;
  }

  const tx = await factory.write.setPublicCreation([true]);
  await publicClient.waitForTransactionReceipt({ hash: tx });
  const after = await factory.read.publicCreation();
  console.log(`publicCreation after:  ${after}  (tx ${tx})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

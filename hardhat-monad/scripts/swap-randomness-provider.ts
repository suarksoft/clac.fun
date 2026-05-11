// Deploys a fresh PythEntropyProvider and swaps it in as the factory's
// `defaultRandomnessProvider`. Useful when the initial deploy used the Mock
// provider and we want to upgrade to Pyth without redeploying everything.
//
// IMPORTANT: only the factory owner can call setRandomnessProvider. Existing
// tokens already in flight keep their original provider; only NEW tokens
// created after this call will use the new provider.
//
// Usage:
//   FACTORY=0x... PYTH_ENTROPY=0x... PYTH_PROVIDER=0x... \
//     pnpm swap:randomness --network monadTestnet

import hre from "hardhat";

async function main() {
  const factoryAddr = (process.env.FACTORY ?? "").trim();
  const pythEntropy = (process.env.PYTH_ENTROPY ?? "").trim();
  const pythProvider = (process.env.PYTH_PROVIDER ?? "").trim();
  const gasLimit = BigInt(process.env.RANDOMNESS_GAS ?? "1500000");

  if (!factoryAddr) throw new Error("FACTORY env required");
  if (!pythEntropy) throw new Error("PYTH_ENTROPY env required");
  if (!pythProvider) throw new Error("PYTH_PROVIDER env required");

  const publicClient = await hre.viem.getPublicClient();
  const [walletClient] = await hre.viem.getWalletClients();

  console.log(
    `Deploying PythEntropyProvider(entropy=${pythEntropy}, provider=${pythProvider}, gasLimit=${gasLimit})…`,
  );
  const newProvider = await hre.viem.deployContract("PythEntropyProvider", [
    pythEntropy as `0x${string}`,
    pythProvider as `0x${string}`,
    Number(gasLimit),
  ]);
  console.log(`✓ Deployed at ${newProvider.address}`);

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

  console.log("Calling factory.setRandomnessProvider(newProvider)…");
  const txHash = await factory.write.setRandomnessProvider([newProvider.address]);
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`✓ Swap complete (tx ${txHash})`);

  const updated = await factory.read.defaultRandomnessProvider();
  console.log(`Factory.defaultRandomnessProvider = ${updated}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

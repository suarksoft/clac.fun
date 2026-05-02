import hre from "hardhat";
import mainnetParams from "../ignition/parameters/mainnet.json";

async function main() {
  const [deployer] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  const address = deployer.account.address;
  const balance = await publicClient.getBalance({ address });
  const balanceMON = Number(balance) / 1e18;

  console.log("Deployer :", address);
  console.log("Balance  :", balanceMON.toFixed(4), "MON");

  const chainId = await publicClient.getChainId();
  console.log("Chain ID :", chainId);

  const params = (mainnetParams as Record<string, Record<string, string>>)
    .ClacFactoryModule;
  const treasury = params?.treasury ?? "";

  if (treasury === "0x0000000000000000000000000000000000000001" || !treasury) {
    throw new Error(
      "Treasury address is placeholder. Update ignition/parameters/mainnet.json before deploying.",
    );
  }
  console.log("Treasury :", treasury);

  if (balanceMON < 1) {
    throw new Error("Insufficient balance. Need at least 1 MON for deployment.");
  }

  if (chainId !== 143) {
    throw new Error(`Expected chain 143 (Monad Mainnet), got ${chainId}.`);
  }

  console.log("\n✅ Pre-deploy check passed. Ready for mainnet.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

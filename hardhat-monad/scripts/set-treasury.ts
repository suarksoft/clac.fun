import hre from "hardhat";
import deployments from "../ignition/deployments/chain-10143/deployed_addresses.json";

async function main() {
  const nextTreasury = process.env.TREASURY_ADDRESS;
  if (!nextTreasury) {
    throw new Error("TREASURY_ADDRESS is missing in environment.");
  }

  const contractAddress = deployments["ClacFactoryModule#ClacFactory"];
  if (!contractAddress) {
    throw new Error("Deployed ClacFactory address not found.");
  }

  const publicClient = await hre.viem.getPublicClient();
  const [walletClient] = await hre.viem.getWalletClients();
  if (!walletClient) {
    throw new Error("No wallet client found. Check PRIVATE_KEY in .env.");
  }

  const contract = await hre.viem.getContractAt("ClacFactory", contractAddress, {
    client: { public: publicClient, wallet: walletClient },
  });

  const owner = await contract.read.owner();
  const currentTreasury = await contract.read.treasury();

  console.log("Contract:", contractAddress);
  console.log("Signer:", walletClient.account.address);
  console.log("Owner:", owner);
  console.log("Current treasury:", currentTreasury);
  console.log("Target treasury:", nextTreasury);

  if (currentTreasury.toLowerCase() === nextTreasury.toLowerCase()) {
    console.log("Treasury already up to date.");
    return;
  }

  if (owner.toLowerCase() !== walletClient.account.address.toLowerCase()) {
    throw new Error("Signer is not contract owner, cannot call setTreasury.");
  }

  const txHash = await contract.write.setTreasury([nextTreasury as `0x${string}`]);
  console.log("setTreasury tx:", txHash);
  await publicClient.waitForTransactionReceipt({ hash: txHash });

  const updatedTreasury = await contract.read.treasury();
  console.log("Updated treasury:", updatedTreasury);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

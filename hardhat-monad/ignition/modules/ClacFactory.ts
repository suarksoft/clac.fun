import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ClacFactoryModule = buildModule("ClacFactoryModule", (m) => {
  // Parameters — set these when deploying
  const treasury = m.getParameter(
    "treasury",
    process.env.TREASURY_ADDRESS || "0x0000000000000000000000000000000000000000",
  );
  const k = m.getParameter("k", 1000000n); // Bonding curve constant — tune during testing

  const clacFactory = m.contract("ClacFactory", [treasury, k]);

  return { clacFactory };
});

export default ClacFactoryModule;

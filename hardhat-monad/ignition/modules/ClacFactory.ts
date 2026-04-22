import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ClacFactoryModule = buildModule("ClacFactoryModule", (m) => {
  const zeroAddress = "0x0000000000000000000000000000000000000000";
  // Parameters — set these when deploying
  const treasury = m.getParameter("treasury", zeroAddress);
  const k = m.getParameter("k", 1000000n); // Bonding curve constant — tune during testing
  if (treasury === zeroAddress) {
    throw new Error(
      "Invalid treasury parameter. Pass ignition parameters with a non-zero treasury address.",
    );
  }

  const clacFactory = m.contract("ClacFactory", [treasury, k]);

  return { clacFactory };
});

export default ClacFactoryModule;

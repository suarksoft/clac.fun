import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Production v2 stack:
 *   1. ClacTokenImpl       (cloned per token)
 *   2. PythEntropyProvider (Pyth Entropy V2 adapter)
 *   3. ClacFactoryV2       (registry + deployer)
 *   4. ClacTrophyNFT       (commemorative NFT, factory-bound)
 *   5. wires trophy into the factory via setTrophyNFT
 *
 * Required parameters (override via JSON):
 *   - treasury:      address that receives fees + creation fee
 *   - k:             bonding curve K (locked per token at creation)
 *   - pythEntropy:   Pyth Entropy V2 contract on the target chain
 *                    (Monad testnet: 0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320)
 *   - pythProvider:  Pyth's default entropy provider address
 *   - randomnessGas: gas limit for Pyth callback (default 1_500_000)
 *
 * For local Hardhat testing with a Mock VRF, see ClacFactoryV2Mock.ts.
 */
const ClacFactoryV2Module = buildModule("ClacFactoryV2Module", (m) => {
  const treasury = m.getParameter("treasury");
  const k = m.getParameter("k");
  const pythEntropy = m.getParameter("pythEntropy");
  const pythProvider = m.getParameter("pythProvider");
  const randomnessGas = m.getParameter("randomnessGas", 1_500_000n);

  const tokenImpl = m.contract("ClacTokenImpl", []);

  const randomnessProvider = m.contract("PythEntropyProvider", [
    pythEntropy,
    pythProvider,
    randomnessGas,
  ]);

  const factory = m.contract("ClacFactoryV2", [
    tokenImpl,
    treasury,
    k,
    randomnessProvider,
    "0x0000000000000000000000000000000000000000",
  ]);

  const trophy = m.contract("ClacTrophyNFT", [factory]);

  m.call(factory, "setTrophyNFT", [trophy], { id: "wireTrophy" });

  return { tokenImpl, randomnessProvider, factory, trophy };
});

export default ClacFactoryV2Module;

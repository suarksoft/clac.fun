import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Local-dev v2 stack with MockRandomnessProvider for fast lottery callbacks.
 * DO NOT USE ON MAINNET — randomness is keccak-based, not verifiable.
 *
 * Parameters:
 *   - treasury: fee/creation fee recipient
 *   - k: bonding curve constant (locked per token at creation)
 *   - mockFee: fee returned by MockRandomnessProvider.getFee() (default 0)
 */
const ClacFactoryV2MockModule = buildModule(
  "ClacFactoryV2MockModule",
  (m) => {
    const treasury = m.getParameter("treasury");
    const k = m.getParameter("k");
    const mockFee = m.getParameter("mockFee", 0n);

    const tokenImpl = m.contract("ClacTokenImpl", []);

    const randomnessProvider = m.contract("MockRandomnessProvider", [mockFee]);

    const factory = m.contract("ClacFactoryV2", [
      tokenImpl,
      treasury,
      k,
      randomnessProvider,
      "0x0000000000000000000000000000000000000000",
    ]);

    const trophy = m.contract("ClacTrophyNFT", [factory]);

    m.call(factory, "setTrophyNFT", [trophy], { id: "wireTrophyMock" });

    return { tokenImpl, randomnessProvider, factory, trophy };
  },
);

export default ClacFactoryV2MockModule;

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IClacTrophyNFT {
    /// @notice Mint a death-trophy NFT for a holder of `token`
    /// @dev Only callable by a token contract that was registered by the factory
    function mint(
        address to,
        address token,
        uint256 finalBalance,
        uint256 claimedAmount,
        bool wasLotteryWinner
    ) external returns (uint256 nftId);
}

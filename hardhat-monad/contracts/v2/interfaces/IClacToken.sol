// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IClacToken {
    function initialize(
        address creator,
        string calldata name,
        string calldata symbol,
        string calldata imageURI,
        uint256 duration,
        uint256 k,
        address treasury,
        address randomnessProvider,
        address trophyNFT,
        uint256 minInitialTokens
    ) external payable;

    function creator() external view returns (address);
    function deathTime() external view returns (uint256);
    function deathFinalized() external view returns (bool);
    function balances(address) external view returns (uint256);
}

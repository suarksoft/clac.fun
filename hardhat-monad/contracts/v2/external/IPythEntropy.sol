// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Minimal Pyth Entropy V2 interface
/// @dev Reference: https://docs.pyth.network/entropy
interface IEntropyV2 {
    function requestV2(
        address provider,
        bytes32 userRandomNumber,
        uint32 gasLimit
    ) external payable returns (uint64 sequenceNumber);

    function getFeeV2(address provider, uint32 gasLimit) external view returns (uint128 feeAmount);
}

/// @notice Base contract for Pyth Entropy callback consumers
abstract contract IEntropyConsumer {
    /// @dev External entrypoint hit by Pyth Entropy contract; not user-callable
    function entropyCallback(
        uint64 sequence,
        address provider,
        bytes32 randomNumber
    ) external {
        address entropyAddress = getEntropy();
        require(msg.sender == entropyAddress, "Only entropy");
        _entropyCallback(sequence, provider, randomNumber);
    }

    function _entropyCallback(
        uint64 sequence,
        address provider,
        bytes32 randomNumber
    ) internal virtual;

    function getEntropy() internal view virtual returns (address);
}

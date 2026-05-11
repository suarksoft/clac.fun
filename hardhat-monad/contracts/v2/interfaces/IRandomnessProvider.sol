// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IRandomnessProvider {
    /// @notice Native MON fee required to request randomness
    function getFee() external view returns (uint256);

    /// @notice Request randomness; provider will later call IRandomnessConsumer.fulfillRandomness on `consumer`
    /// @dev Only the consumer itself may call this (msg.sender must equal `consumer`)
    function requestRandomness(address consumer, bytes32 userSeed)
        external
        payable
        returns (uint64 sequenceNumber);
}

interface IRandomnessConsumer {
    /// @notice Called by the randomness provider once randomness is available
    function fulfillRandomness(uint64 sequenceNumber, bytes32 randomNumber) external;
}

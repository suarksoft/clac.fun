// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IRandomnessProvider, IRandomnessConsumer} from "../interfaces/IRandomnessProvider.sol";

/// @title MockRandomnessProvider
/// @notice Test/dev randomness provider. NOT FOR PRODUCTION.
/// @dev Default mode delivers randomness synchronously. `setManualMode(true)` defers callback so
///      tests can simulate async timing with `manualFulfill(...)`.
contract MockRandomnessProvider is IRandomnessProvider {

    uint256 public fee;
    uint64 public nextSequence;
    bool public manualMode;

    mapping(uint64 => address) public sequenceToConsumer;
    mapping(uint64 => bytes32) public sequenceToSeed;

    event RandomnessRequested(uint64 sequence, address consumer, bytes32 seed);
    event RandomnessFulfilled(uint64 sequence, address consumer, bytes32 randomNumber);

    constructor(uint256 _fee) {
        fee = _fee;
    }

    function setFee(uint256 _fee) external {
        fee = _fee;
    }

    function setManualMode(bool _manual) external {
        manualMode = _manual;
    }

    function getFee() external view override returns (uint256) {
        return fee;
    }

    function requestRandomness(address consumer, bytes32 userSeed)
        external
        payable
        override
        returns (uint64 sequenceNumber)
    {
        require(msg.sender == consumer, "Only consumer can request");
        require(msg.value >= fee, "Insufficient fee");

        sequenceNumber = nextSequence++;
        sequenceToConsumer[sequenceNumber] = consumer;
        sequenceToSeed[sequenceNumber] = userSeed;

        emit RandomnessRequested(sequenceNumber, consumer, userSeed);

        if (!manualMode) {
            bytes32 random = keccak256(
                abi.encode(userSeed, sequenceNumber, block.timestamp, block.prevrandao)
            );
            _deliver(sequenceNumber, consumer, random);
        }
    }

    function manualFulfill(uint64 sequenceNumber, bytes32 randomNumber) external {
        address consumer = sequenceToConsumer[sequenceNumber];
        require(consumer != address(0), "Unknown sequence");
        _deliver(sequenceNumber, consumer, randomNumber);
    }

    function _deliver(uint64 sequenceNumber, address consumer, bytes32 randomNumber) internal {
        delete sequenceToConsumer[sequenceNumber];
        delete sequenceToSeed[sequenceNumber];
        IRandomnessConsumer(consumer).fulfillRandomness(sequenceNumber, randomNumber);
        emit RandomnessFulfilled(sequenceNumber, consumer, randomNumber);
    }

    receive() external payable {}
}

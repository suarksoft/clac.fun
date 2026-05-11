// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IRandomnessProvider, IRandomnessConsumer} from "../interfaces/IRandomnessProvider.sol";
import {IEntropyV2, IEntropyConsumer} from "../external/IPythEntropy.sol";

/// @title PythEntropyProvider
/// @notice Adapter wrapping Pyth Entropy V2 as an IRandomnessProvider.
/// @dev The provider is the IEntropyConsumer; it forwards Pyth's callback to the original consumer.
contract PythEntropyProvider is IRandomnessProvider, IEntropyConsumer {

    IEntropyV2 public immutable entropy;
    address public immutable entropyProvider; // Pyth's default provider address
    uint32 public immutable callbackGasLimit;

    mapping(uint64 => address) public sequenceToConsumer;

    event RandomnessRequested(uint64 indexed sequence, address indexed consumer);
    event RandomnessFulfilled(uint64 indexed sequence, address indexed consumer);

    constructor(address _entropy, address _entropyProvider, uint32 _gasLimit) {
        require(_entropy != address(0), "Invalid entropy");
        require(_entropyProvider != address(0), "Invalid provider");
        require(_gasLimit > 0, "Invalid gas limit");
        entropy = IEntropyV2(_entropy);
        entropyProvider = _entropyProvider;
        callbackGasLimit = _gasLimit;
    }

    // ─── IRandomnessProvider ───────────────────

    function getFee() external view override returns (uint256) {
        return uint256(entropy.getFeeV2(entropyProvider, callbackGasLimit));
    }

    function requestRandomness(address consumer, bytes32 userSeed)
        external
        payable
        override
        returns (uint64 sequenceNumber)
    {
        require(msg.sender == consumer, "Only consumer can request");

        sequenceNumber = entropy.requestV2{value: msg.value}(
            entropyProvider, userSeed, callbackGasLimit
        );
        sequenceToConsumer[sequenceNumber] = consumer;
        emit RandomnessRequested(sequenceNumber, consumer);
    }

    // ─── IEntropyConsumer ──────────────────────

    function _entropyCallback(
        uint64 sequence,
        address /* provider */,
        bytes32 randomNumber
    ) internal override {
        address consumer = sequenceToConsumer[sequence];
        require(consumer != address(0), "Unknown sequence");
        delete sequenceToConsumer[sequence];

        IRandomnessConsumer(consumer).fulfillRandomness(sequence, randomNumber);
        emit RandomnessFulfilled(sequence, consumer);
    }

    function getEntropy() internal view override returns (address) {
        return address(entropy);
    }
}

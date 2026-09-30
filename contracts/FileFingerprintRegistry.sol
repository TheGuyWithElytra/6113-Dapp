// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice First registration of a SHA-256 file digest in this registry.
/// @dev Registration is a public record, not a statement of authorship or ownership.
contract FileFingerprintRegistry {
    struct Record { address registrant; uint256 registeredAt; }
    mapping(bytes32 => Record) public records;
    event FingerprintRegistered(bytes32 indexed fingerprint, address indexed registrant, uint256 registeredAt);
    error EmptyFingerprint();
    error AlreadyRegistered();

    function register(bytes32 fingerprint) external {
        if (fingerprint == bytes32(0)) revert EmptyFingerprint();
        if (records[fingerprint].registrant != address(0)) revert AlreadyRegistered();
        records[fingerprint] = Record(msg.sender, block.timestamp);
        emit FingerprintRegistered(fingerprint, msg.sender, block.timestamp);
    }
}

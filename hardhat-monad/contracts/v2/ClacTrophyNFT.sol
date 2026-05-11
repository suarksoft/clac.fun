// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {IClacTrophyNFT} from "./interfaces/IClacTrophyNFT.sol";

interface IFactoryView {
    function isToken(address) external view returns (bool);
}

/// @title ClacTrophyNFT
/// @notice Commemorative NFT minted to former holders after a clac.fun token dies.
///         Only ClacTokenImpl clones registered by the factory may mint.
contract ClacTrophyNFT is ERC721, IClacTrophyNFT {
    using Strings for uint256;
    using Strings for address;

    struct Trophy {
        address token;          // dead token address
        uint256 finalBalance;   // holder's balance at death
        uint256 claimedAmount;  // pro-rata + lottery payout (in wei)
        bool wasLotteryWinner;
        uint256 mintedAt;
    }

    address public immutable factory;
    uint256 public nextTokenId;
    mapping(uint256 => Trophy) public trophies;

    event TrophyMinted(
        uint256 indexed nftId,
        address indexed holder,
        address indexed token,
        uint256 claimedAmount,
        bool wasLotteryWinner
    );

    constructor(address _factory) ERC721("clac.fun Trophy", "CLACT") {
        require(_factory != address(0), "Invalid factory");
        factory = _factory;
    }

    function mint(
        address to,
        address token,
        uint256 finalBalance,
        uint256 claimedAmount,
        bool wasLotteryWinner
    ) external override returns (uint256 nftId) {
        require(IFactoryView(factory).isToken(msg.sender), "Not a registered token");
        require(msg.sender == token, "Token mismatch");
        require(to != address(0), "Bad recipient");

        nftId = ++nextTokenId;
        trophies[nftId] = Trophy({
            token: token,
            finalBalance: finalBalance,
            claimedAmount: claimedAmount,
            wasLotteryWinner: wasLotteryWinner,
            mintedAt: block.timestamp
        });

        _safeMint(to, nftId);
        emit TrophyMinted(nftId, to, token, claimedAmount, wasLotteryWinner);
    }

    // ═══════════════════════════════════════════
    //              ON-CHAIN METADATA
    // ═══════════════════════════════════════════

    function tokenURI(uint256 nftId) public view override returns (string memory) {
        _requireOwned(nftId);
        Trophy memory t = trophies[nftId];

        string memory json = string(
            abi.encodePacked(
                '{"name":"clac.fun Trophy #', nftId.toString(),
                '","description":"Commemorative trophy for surviving a clac.fun timed memecoin.",',
                '"attributes":[',
                    '{"trait_type":"Token","value":"', Strings.toHexString(uint160(t.token), 20), '"},',
                    '{"trait_type":"Final Balance","value":"', t.finalBalance.toString(), '"},',
                    '{"trait_type":"Claimed (wei)","value":"', t.claimedAmount.toString(), '"},',
                    '{"trait_type":"Lottery Winner","value":"', t.wasLotteryWinner ? "true" : "false", '"},',
                    '{"trait_type":"Minted At","value":"', t.mintedAt.toString(), '"}',
                ']}'
            )
        );

        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(bytes(json))
            )
        );
    }
}

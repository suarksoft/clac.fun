// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IClacToken} from "./interfaces/IClacToken.sol";

/// @title ClacFactoryV2
/// @notice Registry + minimal-proxy deployer for clac.fun timed memecoins.
/// @dev Each token is its own EIP-1167 clone of `tokenImplementation`.
///      Per-token K is locked at creation; changing factory defaults only affects new tokens.
contract ClacFactoryV2 is ReentrancyGuard {

    // ═══════════════════════════════════════════
    //                 STATE
    // ═══════════════════════════════════════════

    address public immutable tokenImplementation;

    address public owner;
    address public pendingOwner;

    address public treasury;
    uint256 public defaultK;
    address public defaultRandomnessProvider;
    address public defaultTrophyNFT;

    uint256 public creationFee;
    bool public publicCreation;

    address[] public allTokens;
    mapping(address => bool) public isToken;
    mapping(address => address[]) public tokensByCreator;

    // Valid duration check: must match impl's hardcoded values
    uint256 public constant DURATION_6H = 6 hours;
    uint256 public constant DURATION_12H = 12 hours;
    uint256 public constant DURATION_24H = 24 hours;

    // ═══════════════════════════════════════════
    //                 EVENTS
    // ═══════════════════════════════════════════

    event TokenCreated(
        address indexed token,
        address indexed creator,
        uint256 indexed index,
        string name,
        string symbol,
        string imageURI,
        uint256 duration,
        uint256 k
    );

    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event TreasuryUpdated(address indexed treasury);
    event DefaultKUpdated(uint256 k);
    event RandomnessProviderUpdated(address indexed provider);
    event TrophyNFTUpdated(address indexed trophy);
    event CreationFeeUpdated(uint256 fee);
    event PublicCreationUpdated(bool isPublic);

    // ═══════════════════════════════════════════
    //               MODIFIERS
    // ═══════════════════════════════════════════

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // ═══════════════════════════════════════════
    //              CONSTRUCTOR
    // ═══════════════════════════════════════════

    constructor(
        address _implementation,
        address _treasury,
        uint256 _defaultK,
        address _randomnessProvider,
        address _trophyNFT
    ) {
        require(_implementation != address(0), "Invalid impl");
        require(_treasury != address(0), "Invalid treasury");
        require(_defaultK > 0, "Invalid k");
        require(_randomnessProvider != address(0), "Invalid randomness");

        tokenImplementation = _implementation;
        owner = msg.sender;
        treasury = _treasury;
        defaultK = _defaultK;
        defaultRandomnessProvider = _randomnessProvider;
        defaultTrophyNFT = _trophyNFT; // can be address(0) initially

        creationFee = 10 ether;
        publicCreation = false;

        emit OwnershipTransferred(address(0), msg.sender);
        emit TreasuryUpdated(_treasury);
        emit DefaultKUpdated(_defaultK);
        emit RandomnessProviderUpdated(_randomnessProvider);
        emit TrophyNFTUpdated(_trophyNFT);
        emit CreationFeeUpdated(10 ether);
    }

    // ═══════════════════════════════════════════
    //              CREATE TOKEN
    // ═══════════════════════════════════════════

    /// @notice Create a new token clone. Any `msg.value` above `creationFee` is forwarded
    ///         to the clone's `initialize` and applied as the creator's atomic initial
    ///         buy (capped at MAX_INITIAL_BUY_BPS = 79.31% of MAX_SUPPLY).
    /// @param minInitialTokens Slippage protection for the initial buy. Pass 0 to skip
    ///                         the initial buy entirely (in which case do not send any
    ///                         extra MON beyond `creationFee`).
    function createToken(
        string calldata name,
        string calldata symbol,
        string calldata imageURI,
        uint256 duration,
        uint256 minInitialTokens
    ) external payable nonReentrant returns (address token) {
        if (!publicCreation) {
            require(msg.sender == owner, "Creation not public");
        }
        require(
            duration == DURATION_6H || duration == DURATION_12H || duration == DURATION_24H,
            "Invalid duration"
        );
        require(msg.value >= creationFee, "Insufficient creation fee");
        require(bytes(name).length > 0 && bytes(name).length <= 64, "Bad name");
        require(bytes(symbol).length > 0 && bytes(symbol).length <= 16, "Bad symbol");
        require(bytes(imageURI).length <= 512, "Bad imageURI");

        uint256 initialBuyAmount = msg.value - creationFee;

        // Deploy minimal proxy clone
        token = Clones.clone(tokenImplementation);

        // Send creation fee to treasury BEFORE initializing the clone so the
        // contract balance is exactly the initial-buy amount when the clone runs.
        (bool ok, ) = payable(treasury).call{value: creationFee}("");
        require(ok, "Treasury transfer failed");

        // Atomically initialize and (if any) execute the creator's initial buy
        IClacToken(token).initialize{value: initialBuyAmount}(
            msg.sender,
            name,
            symbol,
            imageURI,
            duration,
            defaultK,
            treasury,
            defaultRandomnessProvider,
            defaultTrophyNFT,
            minInitialTokens
        );

        // Register
        uint256 index = allTokens.length;
        allTokens.push(token);
        isToken[token] = true;
        tokensByCreator[msg.sender].push(token);

        emit TokenCreated(
            token, msg.sender, index, name, symbol, imageURI, duration, defaultK
        );
    }

    // ═══════════════════════════════════════════
    //                  VIEWS
    // ═══════════════════════════════════════════

    function tokenCount() external view returns (uint256) {
        return allTokens.length;
    }

    function getAllTokens() external view returns (address[] memory) {
        return allTokens;
    }

    function getTokensByCreator(address creator) external view returns (address[] memory) {
        return tokensByCreator[creator];
    }

    function tokensSlice(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory page)
    {
        uint256 total = allTokens.length;
        if (offset >= total) return new address[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        page = new address[](end - offset);
        for (uint256 i = 0; i < page.length; i++) {
            page[i] = allTokens[offset + i];
        }
    }

    // ═══════════════════════════════════════════
    //              ADMIN (owner)
    // ═══════════════════════════════════════════

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function setDefaultK(uint256 _k) external onlyOwner {
        require(_k > 0, "Invalid k");
        defaultK = _k;
        emit DefaultKUpdated(_k);
    }

    function setRandomnessProvider(address _provider) external onlyOwner {
        require(_provider != address(0), "Invalid provider");
        defaultRandomnessProvider = _provider;
        emit RandomnessProviderUpdated(_provider);
    }

    function setTrophyNFT(address _trophy) external onlyOwner {
        defaultTrophyNFT = _trophy;
        emit TrophyNFTUpdated(_trophy);
    }

    function setCreationFee(uint256 _fee) external onlyOwner {
        creationFee = _fee;
        emit CreationFeeUpdated(_fee);
    }

    function setPublicCreation(bool _public) external onlyOwner {
        publicCreation = _public;
        emit PublicCreationUpdated(_public);
    }

    // ═══════════════════════════════════════════
    //          OWNERSHIP (2-step transfer)
    // ═══════════════════════════════════════════

    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Not pending owner");
        address prev = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(prev, owner);
    }

    function renounceOwnership() external onlyOwner {
        address prev = owner;
        owner = address(0);
        pendingOwner = address(0);
        emit OwnershipTransferred(prev, address(0));
    }
}

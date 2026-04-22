// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BondingCurve} from "./libraries/BondingCurve.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ClacFactory
/// @notice clac.fun — Timed memecoin launchpad on Monad
/// @dev Every token has a death clock. When time's up: clac. 💀

contract ClacFactory is ReentrancyGuard {

    // ═══════════════════════════════════════════
    //                 STRUCTS
    // ═══════════════════════════════════════════

    struct Token {
        address creator;
        string name;
        string symbol;
        string imageURI;
        uint256 virtualSupply;
        uint256 poolBalance;
        uint256 createdAt;
        uint256 duration;
        bool dead;
        bool deathProcessed;
        uint256 totalHolders;
    }

    // ═══════════════════════════════════════════
    //                CONSTANTS
    // ═══════════════════════════════════════════

    uint256 public constant PROTOCOL_FEE_BPS = 200;   // 2%
    uint256 public constant CREATOR_FEE_BPS = 100;     // 1%
    uint256 public constant DEATH_TAX_BPS = 500;       // 5%
    uint256 public constant PRO_RATA_BPS = 6500;       // 65%
    uint256 public constant LOTTERY_BPS = 3500;         // 35%
    uint256 public constant LOTTERY_WINNERS = 3;
    uint256 public constant SNIPER_BLOCKS = 5;
    uint256 public constant MAX_BUY_BPS_EARLY = 100;   // 1%
    uint256 public constant DEATH_TRIGGER_BONUS = 0.1 ether;
    uint256 public constant DURATION_6H = 21600;
    uint256 public constant DURATION_12H = 43200;
    uint256 public constant DURATION_24H = 86400;
    uint256 public constant BPS = 10000;
    uint256 public constant MAX_POOL = 10_000 ether;
    uint256 public constant MAX_SUPPLY = 1_000_000_000 ether; // 1B tokens

    // ═══════════════════════════════════════════
    //              STATE VARIABLES
    // ═══════════════════════════════════════════

    address public owner;
    address public treasury;
    uint256 public k;
    uint256 public creationFee;
    bool public publicCreation;
    uint256 public tokenCount;

    mapping(uint256 => Token) public tokens;
    mapping(uint256 => mapping(address => uint256)) public balances;
    mapping(uint256 => address[]) internal _holders;
    mapping(uint256 => mapping(address => bool)) public isHolder;
    mapping(uint256 => mapping(address => uint256)) public claimable;
    mapping(uint256 => uint256) public creationBlock;

    // ═══════════════════════════════════════════
    //                 EVENTS
    // ═══════════════════════════════════════════

    event TokenCreated(
        uint256 indexed tokenId, address indexed creator,
        string name, string symbol, string imageURI, uint256 duration
    );

    event Trade(
        uint256 indexed tokenId, address indexed trader, bool isBuy,
        uint256 tokenAmount, uint256 monAmount, uint256 protocolFee,
        uint256 creatorFee, uint256 newSupply, uint256 newPrice
    );

    event TokenClacced(uint256 indexed tokenId, uint256 poolRemaining, address triggeredBy);
    event LotteryWin(uint256 indexed tokenId, address indexed winner, uint256 amount);
    event Claimed(uint256 indexed tokenId, address indexed holder, uint256 amount);

    // ═══════════════════════════════════════════
    //               MODIFIERS
    // ═══════════════════════════════════════════

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier tokenAlive(uint256 tokenId) {
        require(tokenId < tokenCount, "Token does not exist");
        require(!tokens[tokenId].dead, "Token is dead");
        require(block.timestamp < tokens[tokenId].createdAt + tokens[tokenId].duration, "Time expired");
        _;
    }

    modifier tokenExists(uint256 tokenId) {
        require(tokenId < tokenCount, "Token does not exist");
        _;
    }

    // ═══════════════════════════════════════════
    //              CONSTRUCTOR
    // ═══════════════════════════════════════════

    constructor(address _treasury, uint256 _k) {
        require(_treasury != address(0), "Invalid treasury");
        owner = msg.sender;
        treasury = _treasury;
        k = _k;
        creationFee = 10 ether;
        publicCreation = false;
    }

    // ═══════════════════════════════════════════
    //             CREATE TOKEN
    // ═══════════════════════════════════════════

    function createToken(
        string calldata name,
        string calldata symbol,
        string calldata imageURI,
        uint256 duration
    ) external payable returns (uint256 tokenId) {
        if (!publicCreation) {
            require(msg.sender == owner, "Creation not public yet");
        }

        require(
            duration == DURATION_6H || duration == DURATION_12H || duration == DURATION_24H,
            "Invalid duration"
        );
        require(msg.value >= creationFee, "Insufficient creation fee");

        _sendMON(treasury, creationFee);
        if (msg.value > creationFee) {
            _sendMON(msg.sender, msg.value - creationFee);
        }

        tokenId = tokenCount++;
        Token storage t = tokens[tokenId];
        t.creator = msg.sender;
        t.name = name;
        t.symbol = symbol;
        t.imageURI = imageURI;
        t.createdAt = block.timestamp;
        t.duration = duration;
        creationBlock[tokenId] = block.number;

        emit TokenCreated(tokenId, msg.sender, name, symbol, imageURI, duration);
    }

    // ═══════════════════════════════════════════
    //                  BUY
    // ═══════════════════════════════════════════

    function buy(uint256 tokenId, uint256 minTokens) external payable nonReentrant tokenAlive(tokenId) {
        require(msg.value > 0, "Send MON to buy");
        Token storage t = tokens[tokenId];
        require(t.poolBalance + msg.value <= MAX_POOL, "Pool cap reached");

        uint256 protocolFee = (msg.value * PROTOCOL_FEE_BPS) / BPS;
        uint256 creatorFee = (msg.value * CREATOR_FEE_BPS) / BPS;
        uint256 netAmount = msg.value - protocolFee - creatorFee;

        uint256 tokenAmount = _getTokensForMON(t.virtualSupply, netAmount);
        require(tokenAmount >= minTokens, "Slippage exceeded");
        require(t.virtualSupply + tokenAmount <= MAX_SUPPLY, "Max supply reached");

        // Anti-sniper
        if (block.number < creationBlock[tokenId] + SNIPER_BLOCKS) {
            uint256 maxBuy = (MAX_SUPPLY * MAX_BUY_BPS_EARLY) / BPS;
            require(balances[tokenId][msg.sender] + tokenAmount <= maxBuy, "Anti-sniper: max buy exceeded");
        }

        t.virtualSupply += tokenAmount;
        t.poolBalance += netAmount;
        balances[tokenId][msg.sender] += tokenAmount;

        if (!isHolder[tokenId][msg.sender]) {
            isHolder[tokenId][msg.sender] = true;
            _holders[tokenId].push(msg.sender);
            t.totalHolders++;
        }

        _sendMON(treasury, protocolFee);
        _sendMON(t.creator, creatorFee);

        emit Trade(tokenId, msg.sender, true, tokenAmount, msg.value, protocolFee, creatorFee, t.virtualSupply, BondingCurve.getPrice(t.virtualSupply, k));
    }

    // ═══════════════════════════════════════════
    //                  SELL
    // ═══════════════════════════════════════════

    function sell(uint256 tokenId, uint256 tokenAmount, uint256 minMON) external nonReentrant tokenAlive(tokenId) {
        require(tokenAmount > 0, "Amount must be > 0");
        require(balances[tokenId][msg.sender] >= tokenAmount, "Insufficient balance");
        Token storage t = tokens[tokenId];

        uint256 grossRevenue = BondingCurve.getSellRevenue(t.virtualSupply, tokenAmount, k);
        require(grossRevenue <= t.poolBalance, "Insufficient pool");

        uint256 protocolFee = (grossRevenue * PROTOCOL_FEE_BPS) / BPS;
        uint256 creatorFee = (grossRevenue * CREATOR_FEE_BPS) / BPS;
        uint256 netRevenue = grossRevenue - protocolFee - creatorFee;
        require(netRevenue >= minMON, "Slippage exceeded");

        t.virtualSupply -= tokenAmount;
        t.poolBalance -= grossRevenue;
        balances[tokenId][msg.sender] -= tokenAmount;

        if (balances[tokenId][msg.sender] == 0) {
            isHolder[tokenId][msg.sender] = false;
            t.totalHolders--;
        }

        _sendMON(treasury, protocolFee);
        _sendMON(t.creator, creatorFee);
        _sendMON(msg.sender, netRevenue);

        emit Trade(tokenId, msg.sender, false, tokenAmount, netRevenue, protocolFee, creatorFee, t.virtualSupply, BondingCurve.getPrice(t.virtualSupply, k));
    }

    // ═══════════════════════════════════════════
    //            DEATH — CLAC! 💀
    // ═══════════════════════════════════════════

    function triggerDeath(uint256 tokenId) external nonReentrant tokenExists(tokenId) {
        Token storage t = tokens[tokenId];
        require(!t.dead, "Already dead");
        require(block.timestamp >= t.createdAt + t.duration, "Not expired yet");

        t.dead = true;
        uint256 pool = t.poolBalance;

        if (pool == 0) {
            t.deathProcessed = true;
            emit TokenClacced(tokenId, 0, msg.sender);
            return;
        }

        // Death trigger bonus is carved out first so total payouts never exceed pool.
        uint256 triggerBonus = pool >= DEATH_TRIGGER_BONUS ? DEATH_TRIGGER_BONUS : 0;
        uint256 poolAfterBonus = pool - triggerBonus;

        // Death tax
        uint256 deathTax = (poolAfterBonus * DEATH_TAX_BPS) / BPS;
        uint256 distributable = poolAfterBonus - deathTax;
        uint256 proRataPool = (distributable * PRO_RATA_BPS) / BPS;
        uint256 lotteryPool = distributable - proRataPool;

        // Pro-rata distribution
        uint256 holderCount = _holders[tokenId].length;
        if (holderCount > 0 && t.virtualSupply > 0) {
            for (uint256 i = 0; i < holderCount; i++) {
                address holder = _holders[tokenId][i];
                uint256 bal = balances[tokenId][holder];
                if (bal > 0) {
                    uint256 share = (proRataPool * bal) / t.virtualSupply;
                    claimable[tokenId][holder] += share;
                }
            }
        }

        // Lottery — 3 random winners
        if (holderCount > 0 && lotteryPool > 0) {
            uint256 winnersFound = 0;
            uint256 perWinner = lotteryPool / LOTTERY_WINNERS;

            for (uint256 i = 0; i < LOTTERY_WINNERS && i < holderCount; i++) {
                uint256 seed = uint256(keccak256(abi.encodePacked(
                    blockhash(block.number - 1), tokenId, i, holderCount, block.timestamp
                )));

                uint256 attempts = 0;
                while (attempts < holderCount) {
                    uint256 idx = (seed + attempts) % holderCount;
                    address winner = _holders[tokenId][idx];
                    if (balances[tokenId][winner] > 0) {
                        claimable[tokenId][winner] += perWinner;
                        winnersFound++;
                        emit LotteryWin(tokenId, winner, perWinner);
                        break;
                    }
                    attempts++;
                }
            }

            if (winnersFound < LOTTERY_WINNERS) {
                deathTax += (LOTTERY_WINNERS - winnersFound) * perWinner;
            }
        }

        _sendMON(treasury, deathTax);

        if (triggerBonus > 0 && address(this).balance >= triggerBonus) {
            _sendMON(msg.sender, triggerBonus);
        }

        t.deathProcessed = true;
        t.poolBalance = 0;
        emit TokenClacced(tokenId, distributable, msg.sender);
    }

    // ═══════════════════════════════════════════
    //                 CLAIM
    // ═══════════════════════════════════════════

    function claim(uint256 tokenId) external nonReentrant tokenExists(tokenId) {
        require(tokens[tokenId].dead && tokens[tokenId].deathProcessed, "Not claimable yet");
        uint256 amount = claimable[tokenId][msg.sender];
        require(amount > 0, "Nothing to claim");

        claimable[tokenId][msg.sender] = 0;
        _sendMON(msg.sender, amount);
        emit Claimed(tokenId, msg.sender, amount);
    }

    // ═══════════════════════════════════════════
    //             VIEW FUNCTIONS
    // ═══════════════════════════════════════════

    function getPrice(uint256 tokenId) external view tokenExists(tokenId) returns (uint256) {
        return BondingCurve.getPrice(tokens[tokenId].virtualSupply, k);
    }

    function getBuyCost(uint256 tokenId, uint256 tokenAmount) external view tokenExists(tokenId) returns (uint256) {
        uint256 rawCost = BondingCurve.getBuyCost(tokens[tokenId].virtualSupply, tokenAmount, k);
        uint256 totalFeeBps = PROTOCOL_FEE_BPS + CREATOR_FEE_BPS;
        return (rawCost * BPS) / (BPS - totalFeeBps);
    }

    function getSellQuote(uint256 tokenId, uint256 tokenAmount) external view tokenExists(tokenId) returns (uint256) {
        uint256 rawRevenue = BondingCurve.getSellRevenue(tokens[tokenId].virtualSupply, tokenAmount, k);
        uint256 totalFeeBps = PROTOCOL_FEE_BPS + CREATOR_FEE_BPS;
        return rawRevenue - (rawRevenue * totalFeeBps) / BPS;
    }

    function getTimeLeft(uint256 tokenId) external view tokenExists(tokenId) returns (uint256) {
        Token storage t = tokens[tokenId];
        uint256 deathTime = t.createdAt + t.duration;
        if (block.timestamp >= deathTime) return 0;
        return deathTime - block.timestamp;
    }

    function isAlive(uint256 tokenId) external view tokenExists(tokenId) returns (bool) {
        Token storage t = tokens[tokenId];
        return !t.dead && block.timestamp < t.createdAt + t.duration;
    }

    function getBalance(uint256 tokenId, address user) external view returns (uint256) {
        return balances[tokenId][user];
    }

    function getToken(uint256 tokenId) external view tokenExists(tokenId) returns (Token memory) {
        return tokens[tokenId];
    }

    function getHolders(uint256 tokenId) external view tokenExists(tokenId) returns (address[] memory) {
        return _holders[tokenId];
    }

    function getFirstBuyerMultiplier(uint256 tokenId) external view tokenExists(tokenId) returns (uint256) {
        if (tokens[tokenId].virtualSupply == 0) return 0;
        uint256 currentPrice = BondingCurve.getPrice(tokens[tokenId].virtualSupply, k);
        uint256 firstPrice = BondingCurve.getPrice(1 ether, k);
        if (firstPrice == 0) return 0;
        return (currentPrice * 100) / firstPrice;
    }

    function getClaimable(uint256 tokenId, address user) external view returns (uint256) {
        return claimable[tokenId][user];
    }

    // ═══════════════════════════════════════════
    //              ADMIN FUNCTIONS
    // ═══════════════════════════════════════════

    function setPublicCreation(bool _public) external onlyOwner {
        publicCreation = _public;
    }

    function setCreationFee(uint256 _fee) external onlyOwner {
        creationFee = _fee;
    }

    function setK(uint256 _k) external onlyOwner {
        k = _k;
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
    }

    // ═══════════════════════════════════════════
    //               INTERNAL
    // ═══════════════════════════════════════════

    function _getTokensForMON(uint256 currentSupply, uint256 monAmount) internal view returns (uint256) {
        uint256 low = 0;
        uint256 high = MAX_SUPPLY - currentSupply;
        if (high == 0) return 0;

        while (low < high) {
            uint256 mid = (low + high + 1) / 2;
            uint256 cost = BondingCurve.getBuyCost(currentSupply, mid, k);
            if (cost <= monAmount) {
                low = mid;
            } else {
                high = mid - 1;
            }
        }
        return low;
    }

    function _sendMON(address to, uint256 amount) internal {
        if (amount == 0) return;
        (bool success, ) = payable(to).call{value: amount}("");
        require(success, "MON transfer failed");
    }

    receive() external payable {}
}

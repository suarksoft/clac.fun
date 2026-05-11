// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BondingCurve} from "../libraries/BondingCurve.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IRandomnessProvider, IRandomnessConsumer} from "./interfaces/IRandomnessProvider.sol";
import {IClacTrophyNFT} from "./interfaces/IClacTrophyNFT.sol";

/// @title ClacTokenImpl
/// @notice Per-token implementation cloned by ClacFactoryV2 (EIP-1167 minimal proxy)
/// @dev Each clone has its own MON pool, holders, and death timer.
///      Uses standard (storage-based) ReentrancyGuard. For minimal proxies, the default
///      _status = 0 evaluates as NOT_ENTERED, so no upgradeable initializer is needed.
contract ClacTokenImpl is IRandomnessConsumer, ReentrancyGuard {

    // ═══════════════════════════════════════════
    //                 CONSTANTS
    // ═══════════════════════════════════════════

    uint256 public constant PROTOCOL_FEE_BPS = 100;       // 1% per trade
    uint256 public constant CREATOR_FEE_BPS = 50;         // 0.5% per trade
    uint256 public constant DEATH_TAX_BPS = 300;          // 3% of pool at death
    uint256 public constant PRO_RATA_BPS = 7700;          // 77% of pool at death
    uint256 public constant LOTTERY_BPS = 2000;           // 20% of pool at death
    uint256 public constant LOTTERY_WINNERS_COUNT = 3;
    uint256 public constant DEATH_TRIGGER_BONUS = 0.1 ether;

    uint256 public constant LAST_HOUR_DURATION = 1 hours; // sell ban + lottery snapshot freeze
    uint256 public constant SNIPER_DURATION = 30 seconds; // anti-sniper window
    uint256 public constant MAX_BUY_BPS_EARLY = 100;      // 1% of MAX_SUPPLY in sniper window

    uint256 public constant BPS = 10000;
    uint256 public constant MAX_SUPPLY = 1_000_000_000 ether;
    uint256 public constant MIN_BUY = 0.01 ether;
    uint256 public constant BUY_COOLDOWN_BLOCKS = 2;
    uint256 public constant MAX_HOLDING_BPS = 1000;       // 10% of MAX_SUPPLY per wallet (post-launch)
    uint256 public constant MAX_INITIAL_BUY_BPS = 7931;   // 79.31% cap on creator's atomic launch buy
    uint256 public constant MAX_HOLDERS = 2000;
    uint256 public constant MIN_LOTTERY_WEIGHT_BPS = 10;  // 0.1% of totalLotteryWeight to enter lottery
    uint256 public constant CLAIM_DEADLINE = 30 days;

    uint256 public constant DURATION_6H = 6 hours;
    uint256 public constant DURATION_12H = 12 hours;
    uint256 public constant DURATION_24H = 24 hours;

    // ═══════════════════════════════════════════
    //                 STORAGE
    // ═══════════════════════════════════════════

    // — initialization guard —
    bool private _initialized;

    // — set on init, never changed —
    address public factory;
    address public creator;
    string public name;
    string public symbol;
    string public imageURI;
    uint256 public createdAt;
    uint256 public deathTime;
    uint256 public k;
    address public treasury;
    address public randomnessProvider;
    address public trophyNFT;
    uint256 public creationBlock;

    // — trading state —
    uint256 public virtualSupply;
    uint256 public poolBalance;
    uint256 public totalHolders;

    address[] internal _holders;
    mapping(address => uint256) public balances;
    mapping(address => bool) public isHolder;
    mapping(address => uint256) internal _holderIndex;
    mapping(address => uint256) public lastBuyBlock;

    // — lottery weight (only buys before LAST_HOUR add weight; sells reduce weight) —
    mapping(address => uint256) public lotteryWeight;
    uint256 public totalLotteryWeight;

    // — fees: pull pattern (creator, treasury, death trigger bonus) —
    mapping(address => uint256) public pendingFees;
    uint256 public totalPendingFees;

    // — death state —
    bool public deathRequested;
    bool public deathFinalized;
    address public deathRequestedBy;
    uint64 public deathSequenceNumber;
    bytes32 public lotteryRandomness;
    uint256 public deathProcessedAt;

    uint256 public totalSupplySnapshot;
    uint256 public proRataPool;
    uint256 public lotteryPool;
    address[3] public lotteryWinners;
    uint256 public lotteryWinnersCount;
    uint256 public lotteryShare;

    // — claim tracking —
    mapping(address => bool) public claimed;
    mapping(address => bool) public trophyMinted;
    bool public swept;

    // ═══════════════════════════════════════════
    //                  EVENTS
    // ═══════════════════════════════════════════

    event Initialized(address indexed factory, address indexed creator, uint256 deathTime);
    event Trade(
        address indexed trader,
        bool indexed isBuy,
        uint256 tokenAmount,
        uint256 monAmount,
        uint256 protocolFee,
        uint256 creatorFee,
        uint256 newSupply,
        uint256 newPrice
    );
    event LotteryWeightChanged(address indexed holder, uint256 newWeight, uint256 newTotalWeight);
    event DeathRequested(address indexed requestedBy, uint64 sequenceNumber, uint256 lotteryFeePaid);
    event DeathFinalized(uint256 proRataPool, uint256 lotteryPool, address[3] winners);
    event Claimed(address indexed holder, uint256 proRataAmount, uint256 lotteryAmount);
    event FeeWithdrawn(address indexed who, uint256 amount);
    event TrophyMinted(address indexed holder, uint256 nftId);
    event UnclaimedSwept(address indexed treasury, uint256 amount);

    // ═══════════════════════════════════════════
    //                 MODIFIERS
    // ═══════════════════════════════════════════

    modifier onlyAlive() {
        require(block.timestamp < deathTime, "Token expired");
        require(!deathRequested, "Death pending");
        _;
    }

    // ═══════════════════════════════════════════
    //              CONSTRUCTOR / INIT
    // ═══════════════════════════════════════════

    /// @dev Locks the implementation contract — only clones can be initialized.
    constructor() {
        _initialized = true;
    }

    /// @notice Initialize the clone. If `msg.value` > 0, executes the creator's atomic
    ///         "initial buy" — bypasses the 10% per-wallet cap (MAX_HOLDING_BPS) and is
    ///         subject only to MAX_INITIAL_BUY_BPS (79.31% of MAX_SUPPLY).
    /// @param minInitialTokens Slippage protection for the initial buy. Set to 0 to skip.
    function initialize(
        address _creator,
        string calldata _name,
        string calldata _symbol,
        string calldata _imageURI,
        uint256 _duration,
        uint256 _k,
        address _treasury,
        address _randomnessProvider,
        address _trophyNFT,
        uint256 minInitialTokens
    ) external payable {
        require(!_initialized, "Already initialized");
        require(
            _duration == DURATION_6H || _duration == DURATION_12H || _duration == DURATION_24H,
            "Invalid duration"
        );
        require(_creator != address(0), "Invalid creator");
        require(_treasury != address(0), "Invalid treasury");
        require(_randomnessProvider != address(0), "Invalid randomness provider");
        require(_k > 0, "Invalid k");

        _initialized = true;
        factory = msg.sender;
        creator = _creator;
        name = _name;
        symbol = _symbol;
        imageURI = _imageURI;
        createdAt = block.timestamp;
        deathTime = block.timestamp + _duration;
        k = _k;
        treasury = _treasury;
        randomnessProvider = _randomnessProvider;
        trophyNFT = _trophyNFT;
        creationBlock = block.number;

        emit Initialized(msg.sender, _creator, deathTime);

        if (msg.value > 0) {
            _performInitialBuy(_creator, msg.value, minInitialTokens);
        }
    }

    /// @dev Atomic initial buy executed inside `initialize` for the creator.
    ///      Skips the per-wallet 10% cap (MAX_HOLDING_BPS) but enforces a hard
    ///      MAX_INITIAL_BUY_BPS (79.31%) ceiling so the creator can never own
    ///      the entire supply outright.
    function _performInitialBuy(
        address _creator,
        uint256 monAmount,
        uint256 minTokens
    ) internal {
        uint256 protocolFee = (monAmount * PROTOCOL_FEE_BPS) / BPS;
        uint256 creatorFee = (monAmount * CREATOR_FEE_BPS) / BPS;
        uint256 netAmount = monAmount - protocolFee - creatorFee;

        uint256 tokenAmount = _getTokensForMON(0, netAmount);
        require(tokenAmount > 0, "Zero tokens out");
        require(tokenAmount >= minTokens, "Slippage exceeded");

        uint256 maxInitial = (MAX_SUPPLY * MAX_INITIAL_BUY_BPS) / BPS;
        require(tokenAmount <= maxInitial, "Initial buy exceeds 79.31%");

        virtualSupply = tokenAmount;
        poolBalance = netAmount;
        balances[_creator] = tokenAmount;

        isHolder[_creator] = true;
        _holderIndex[_creator] = 0;
        _holders.push(_creator);
        totalHolders = 1;

        // Initial buy happens at t=0, well before LAST_HOUR — fully lottery-eligible.
        lotteryWeight[_creator] = tokenAmount;
        totalLotteryWeight = tokenAmount;
        emit LotteryWeightChanged(_creator, tokenAmount, tokenAmount);

        // Pull-pattern fees (creator can withdraw their own creator-fee + treasury draws protocol-fee)
        _addPendingFee(treasury, protocolFee);
        _addPendingFee(_creator, creatorFee);

        emit Trade(
            _creator,
            true,
            tokenAmount,
            monAmount,
            protocolFee,
            creatorFee,
            virtualSupply,
            BondingCurve.getPrice(virtualSupply, k)
        );
    }

    // ═══════════════════════════════════════════
    //                   BUY
    // ═══════════════════════════════════════════

    function buy(uint256 minTokens) external payable nonReentrant onlyAlive {
        require(msg.value >= MIN_BUY, "Min buy 0.01 MON");
        require(
            block.number > lastBuyBlock[msg.sender] + BUY_COOLDOWN_BLOCKS,
            "Buy cooldown active"
        );
        lastBuyBlock[msg.sender] = block.number;

        uint256 protocolFee = (msg.value * PROTOCOL_FEE_BPS) / BPS;
        uint256 creatorFee = (msg.value * CREATOR_FEE_BPS) / BPS;
        uint256 netAmount = msg.value - protocolFee - creatorFee;

        uint256 tokenAmount = _getTokensForMON(virtualSupply, netAmount);
        require(tokenAmount > 0, "Zero tokens out");
        require(tokenAmount >= minTokens, "Slippage exceeded");
        require(virtualSupply + tokenAmount <= MAX_SUPPLY, "Max supply reached");

        // Anti-sniper: time-based, first 30s capped at 1% per wallet
        if (block.timestamp < createdAt + SNIPER_DURATION) {
            uint256 maxBuy = (MAX_SUPPLY * MAX_BUY_BPS_EARLY) / BPS;
            require(balances[msg.sender] + tokenAmount <= maxBuy, "Anti-sniper");
        }

        // Whale limit
        uint256 maxHolding = (MAX_SUPPLY * MAX_HOLDING_BPS) / BPS;
        require(balances[msg.sender] + tokenAmount <= maxHolding, "Max holding 10%");

        // — state updates —
        virtualSupply += tokenAmount;
        poolBalance += netAmount;
        balances[msg.sender] += tokenAmount;

        if (!isHolder[msg.sender]) {
            require(_holders.length < MAX_HOLDERS, "Max holders reached");
            isHolder[msg.sender] = true;
            _holderIndex[msg.sender] = _holders.length;
            _holders.push(msg.sender);
            totalHolders++;
        }

        // Lottery weight: only count buys made before LAST_HOUR
        if (block.timestamp < deathTime - LAST_HOUR_DURATION) {
            lotteryWeight[msg.sender] += tokenAmount;
            totalLotteryWeight += tokenAmount;
            emit LotteryWeightChanged(msg.sender, lotteryWeight[msg.sender], totalLotteryWeight);
        }

        // Pull-pattern fees
        _addPendingFee(treasury, protocolFee);
        _addPendingFee(creator, creatorFee);

        emit Trade(
            msg.sender, true, tokenAmount, msg.value,
            protocolFee, creatorFee,
            virtualSupply, BondingCurve.getPrice(virtualSupply, k)
        );
    }

    // ═══════════════════════════════════════════
    //                   SELL
    // ═══════════════════════════════════════════

    function sell(uint256 tokenAmount, uint256 minMON) external nonReentrant {
        require(!deathRequested, "Death pending");
        require(block.timestamp < deathTime, "Token expired");
        // Sell is closed during the last hour to prevent pool drain before distribution
        require(
            block.timestamp < deathTime - LAST_HOUR_DURATION,
            "Sell closed in last hour"
        );
        require(tokenAmount > 0, "Amount > 0");
        require(balances[msg.sender] >= tokenAmount, "Insufficient balance");

        uint256 grossRevenue = BondingCurve.getSellRevenue(virtualSupply, tokenAmount, k);
        if (grossRevenue > poolBalance) grossRevenue = poolBalance;

        uint256 protocolFee = (grossRevenue * PROTOCOL_FEE_BPS) / BPS;
        uint256 creatorFee = (grossRevenue * CREATOR_FEE_BPS) / BPS;
        uint256 netRevenue = grossRevenue - protocolFee - creatorFee;
        require(netRevenue >= minMON, "Slippage exceeded");

        // — state updates —
        virtualSupply -= tokenAmount;
        poolBalance -= grossRevenue;
        balances[msg.sender] -= tokenAmount;

        // Reduce lottery weight (cannot go below 0)
        uint256 weightReduction = tokenAmount > lotteryWeight[msg.sender]
            ? lotteryWeight[msg.sender]
            : tokenAmount;
        if (weightReduction > 0) {
            lotteryWeight[msg.sender] -= weightReduction;
            totalLotteryWeight -= weightReduction;
            emit LotteryWeightChanged(msg.sender, lotteryWeight[msg.sender], totalLotteryWeight);
        }

        // Remove from holders array if balance hits 0 (swap-and-pop)
        if (balances[msg.sender] == 0) {
            uint256 idx = _holderIndex[msg.sender];
            uint256 lastIdx = _holders.length - 1;
            if (idx != lastIdx) {
                address last = _holders[lastIdx];
                _holders[idx] = last;
                _holderIndex[last] = idx;
            }
            _holders.pop();
            isHolder[msg.sender] = false;
            delete _holderIndex[msg.sender];
            totalHolders--;
        }

        _addPendingFee(treasury, protocolFee);
        _addPendingFee(creator, creatorFee);

        _sendMON(msg.sender, netRevenue);

        emit Trade(
            msg.sender, false, tokenAmount, netRevenue,
            protocolFee, creatorFee,
            virtualSupply, BondingCurve.getPrice(virtualSupply, k)
        );
    }

    // ═══════════════════════════════════════════
    //                   DEATH
    // ═══════════════════════════════════════════

    /// @notice Trigger token death once `deathTime` is reached.
    ///         Caller must send enough MON to cover the randomness provider fee.
    ///         Excess is refunded.
    function requestDeath() external payable nonReentrant {
        require(!deathRequested, "Already requested");
        require(block.timestamp >= deathTime, "Not expired");

        deathRequested = true;
        deathRequestedBy = msg.sender;

        // Snapshot total supply for pro-rata math
        totalSupplySnapshot = virtualSupply;

        // Carve out trigger bonus first so total payouts never exceed pool
        uint256 pool = poolBalance;
        uint256 triggerBonus = pool >= DEATH_TRIGGER_BONUS ? DEATH_TRIGGER_BONUS : 0;
        uint256 poolAfterBonus = pool - triggerBonus;

        uint256 deathTax = (poolAfterBonus * DEATH_TAX_BPS) / BPS;
        uint256 lotteryAlloc = (poolAfterBonus * LOTTERY_BPS) / BPS;
        uint256 proRataAlloc = poolAfterBonus - deathTax - lotteryAlloc;

        proRataPool = proRataAlloc;
        lotteryPool = lotteryAlloc;

        // Pull-pattern: trigger bonus goes to caller, death tax to treasury
        if (triggerBonus > 0) _addPendingFee(msg.sender, triggerBonus);
        if (deathTax > 0) _addPendingFee(treasury, deathTax);

        // Decide whether we need randomness
        bool needsLottery = lotteryPool > 0 && totalLotteryWeight > 0 && _holders.length > 0;

        if (needsLottery) {
            uint256 fee = IRandomnessProvider(randomnessProvider).getFee();
            require(msg.value >= fee, "Insufficient randomness fee");

            bytes32 userSeed = keccak256(
                abi.encode(block.timestamp, block.prevrandao, msg.sender, address(this))
            );
            uint64 seq = IRandomnessProvider(randomnessProvider).requestRandomness{value: fee}(
                address(this), userSeed
            );
            deathSequenceNumber = seq;

            uint256 refund = msg.value - fee;
            if (refund > 0) _sendMON(msg.sender, refund);

            emit DeathRequested(msg.sender, seq, fee);
        } else {
            // No lottery — fold lottery pool into pro-rata, finalize immediately
            proRataPool += lotteryPool;
            lotteryPool = 0;
            if (msg.value > 0) _sendMON(msg.sender, msg.value);
            _finalizeDeath(bytes32(0));
            emit DeathRequested(msg.sender, 0, 0);
        }
    }

    /// @notice Called by the randomness provider once randomness is delivered.
    ///         No reentrancy guard here on purpose — sync mock providers must work in tests.
    ///         State guards prevent double-finalize.
    function fulfillRandomness(uint64 sequenceNumber, bytes32 randomNumber) external override {
        require(msg.sender == randomnessProvider, "Not provider");
        require(deathRequested && !deathFinalized, "Bad state");
        require(sequenceNumber == deathSequenceNumber, "Bad sequence");
        _finalizeDeath(randomNumber);
    }

    function _finalizeDeath(bytes32 seed) internal {
        deathFinalized = true;
        lotteryRandomness = seed;
        deathProcessedAt = block.timestamp;

        if (seed != bytes32(0) && totalLotteryWeight > 0 && _holders.length > 0 && lotteryPool > 0) {
            uint256 minWeight = (totalLotteryWeight * MIN_LOTTERY_WEIGHT_BPS) / BPS;
            // Always allow at least 1 wei of weight as floor
            if (minWeight == 0) minWeight = 1;

            uint256 holderLen = _holders.length;
            uint256 eligibleWeight = 0;
            uint256 eligibleCount = 0;

            for (uint256 i = 0; i < holderLen; i++) {
                address h = _holders[i];
                if (lotteryWeight[h] >= minWeight) {
                    eligibleWeight += lotteryWeight[h];
                    eligibleCount++;
                }
            }

            if (eligibleCount > 0 && eligibleWeight > 0) {
                uint256 numWinners = LOTTERY_WINNERS_COUNT > eligibleCount
                    ? eligibleCount
                    : LOTTERY_WINNERS_COUNT;

                for (uint256 slot = 0; slot < numWinners; slot++) {
                    uint256 r = uint256(keccak256(abi.encode(seed, slot))) % eligibleWeight;
                    uint256 acc = 0;
                    for (uint256 i = 0; i < holderLen; i++) {
                        address h = _holders[i];
                        uint256 w = lotteryWeight[h];
                        if (w < minWeight) continue;
                        acc += w;
                        if (acc > r) {
                            lotteryWinners[slot] = h;
                            break;
                        }
                    }
                }

                lotteryWinnersCount = numWinners;
                lotteryShare = lotteryPool / numWinners;

                uint256 unused = lotteryPool - (lotteryShare * numWinners);
                if (unused > 0) proRataPool += unused;
            } else {
                // No eligible holders — fold lottery into pro-rata
                proRataPool += lotteryPool;
                lotteryPool = 0;
            }
        }

        emit DeathFinalized(proRataPool, lotteryPool, lotteryWinners);
    }

    // ═══════════════════════════════════════════
    //                  CLAIM
    // ═══════════════════════════════════════════

    function claim() external nonReentrant {
        require(deathFinalized, "Not finalized");
        require(!claimed[msg.sender], "Already claimed");

        uint256 userBalance = balances[msg.sender];
        uint256 proRataShare = totalSupplySnapshot > 0
            ? (proRataPool * userBalance) / totalSupplySnapshot
            : 0;

        uint256 lotteryAmount = 0;
        for (uint256 i = 0; i < lotteryWinnersCount; i++) {
            if (lotteryWinners[i] == msg.sender) {
                lotteryAmount += lotteryShare;
            }
        }

        uint256 total = proRataShare + lotteryAmount;
        require(total > 0, "Nothing to claim");

        claimed[msg.sender] = true;

        _sendMON(msg.sender, total);
        emit Claimed(msg.sender, proRataShare, lotteryAmount);
    }

    // ═══════════════════════════════════════════
    //              FEE WITHDRAW
    // ═══════════════════════════════════════════

    function withdrawFees() external nonReentrant {
        uint256 amount = pendingFees[msg.sender];
        require(amount > 0, "No fees");
        pendingFees[msg.sender] = 0;
        totalPendingFees -= amount;
        _sendMON(msg.sender, amount);
        emit FeeWithdrawn(msg.sender, amount);
    }

    // ═══════════════════════════════════════════
    //                 TROPHY NFT
    // ═══════════════════════════════════════════

    function mintTrophy() external nonReentrant returns (uint256 nftId) {
        require(deathFinalized, "Not finalized");
        require(claimed[msg.sender], "Claim first");
        require(!trophyMinted[msg.sender], "Already minted");
        require(trophyNFT != address(0), "No trophy");

        trophyMinted[msg.sender] = true;

        uint256 finalBalance = balances[msg.sender];
        uint256 claimedAmount = totalSupplySnapshot > 0
            ? (proRataPool * finalBalance) / totalSupplySnapshot
            : 0;
        bool wasWinner = _wasLotteryWinner(msg.sender);
        if (wasWinner) {
            for (uint256 i = 0; i < lotteryWinnersCount; i++) {
                if (lotteryWinners[i] == msg.sender) {
                    claimedAmount += lotteryShare;
                }
            }
        }

        nftId = IClacTrophyNFT(trophyNFT).mint(
            msg.sender, address(this), finalBalance, claimedAmount, wasWinner
        );
        emit TrophyMinted(msg.sender, nftId);
    }

    // ═══════════════════════════════════════════
    //         SWEEP UNCLAIMED (after deadline)
    // ═══════════════════════════════════════════

    /// @notice After CLAIM_DEADLINE, anyone can sweep unclaimed pro-rata + lottery shares to
    ///         treasury's pendingFees. Already-accrued fees (creator/treasury/trigger) remain
    ///         withdrawable forever.
    function sweepUnclaimed() external nonReentrant {
        require(deathFinalized, "Not finalized");
        require(!swept, "Already swept");
        require(
            block.timestamp >= deathProcessedAt + CLAIM_DEADLINE,
            "Deadline not reached"
        );

        swept = true;

        uint256 contractBal = address(this).balance;
        uint256 sweepable = contractBal > totalPendingFees
            ? contractBal - totalPendingFees
            : 0;

        if (sweepable > 0) {
            _addPendingFee(treasury, sweepable);
            emit UnclaimedSwept(treasury, sweepable);
        }
    }

    // ═══════════════════════════════════════════
    //                   VIEWS
    // ═══════════════════════════════════════════

    function getPrice() external view returns (uint256) {
        return BondingCurve.getPrice(virtualSupply, k);
    }

    function getTimeLeft() external view returns (uint256) {
        if (block.timestamp >= deathTime) return 0;
        return deathTime - block.timestamp;
    }

    function isAlive() external view returns (bool) {
        return !deathRequested && block.timestamp < deathTime;
    }

    function isInLastHour() external view returns (bool) {
        if (block.timestamp >= deathTime) return false;
        return block.timestamp >= deathTime - LAST_HOUR_DURATION;
    }

    function getHolders() external view returns (address[] memory) {
        return _holders;
    }

    function getLotteryWinners() external view returns (address[3] memory) {
        return lotteryWinners;
    }

    function getClaimable(address user)
        external
        view
        returns (uint256 proRataAmount, uint256 lotteryAmount)
    {
        if (!deathFinalized || claimed[user]) return (0, 0);
        if (totalSupplySnapshot > 0) {
            proRataAmount = (proRataPool * balances[user]) / totalSupplySnapshot;
        }
        for (uint256 i = 0; i < lotteryWinnersCount; i++) {
            if (lotteryWinners[i] == user) lotteryAmount += lotteryShare;
        }
    }

    function getBuyCost(uint256 tokenAmount) external view returns (uint256) {
        uint256 rawCost = BondingCurve.getBuyCost(virtualSupply, tokenAmount, k);
        uint256 totalFeeBps = PROTOCOL_FEE_BPS + CREATOR_FEE_BPS;
        return (rawCost * BPS) / (BPS - totalFeeBps);
    }

    function getSellQuote(uint256 tokenAmount) external view returns (uint256) {
        uint256 rawRevenue = BondingCurve.getSellRevenue(virtualSupply, tokenAmount, k);
        uint256 totalFeeBps = PROTOCOL_FEE_BPS + CREATOR_FEE_BPS;
        return rawRevenue - (rawRevenue * totalFeeBps) / BPS;
    }

    function getRandomnessFee() external view returns (uint256) {
        return IRandomnessProvider(randomnessProvider).getFee();
    }

    // ═══════════════════════════════════════════
    //                 INTERNAL
    // ═══════════════════════════════════════════

    function _wasLotteryWinner(address user) internal view returns (bool) {
        for (uint256 i = 0; i < lotteryWinnersCount; i++) {
            if (lotteryWinners[i] == user) return true;
        }
        return false;
    }

    function _getTokensForMON(uint256 currentSupply, uint256 monAmount) internal view returns (uint256) {
        uint256 high = MAX_SUPPLY - currentSupply;
        if (high == 0 || monAmount == 0) return 0;
        uint256 low = 0;
        while (low < high) {
            uint256 mid = (low + high + 1) / 2;
            uint256 cost = BondingCurve.getBuyCost(currentSupply, mid, k);
            if (cost <= monAmount) low = mid;
            else high = mid - 1;
        }
        return low;
    }

    function _addPendingFee(address who, uint256 amount) internal {
        if (amount == 0) return;
        pendingFees[who] += amount;
        totalPendingFees += amount;
    }

    function _sendMON(address to, uint256 amount) internal {
        if (amount == 0) return;
        (bool success, ) = payable(to).call{value: amount}("");
        require(success, "MON transfer failed");
    }

    /// @dev Receive needed for sell refunds & death-trigger refund flow
    receive() external payable {}
}

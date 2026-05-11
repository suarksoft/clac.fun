// ABIs for ClacFactoryV2 + ClacTokenImpl (v2 architecture)
//
// Factory: registry + minimal-proxy deployer. Emits TokenCreated when a new clone is born.
// Each cloned token contract emits its own lifecycle events.

export const CLAC_FACTORY_V2_ABI = [
  'event TokenCreated(address indexed token, address indexed creator, uint256 indexed index, string name, string symbol, string imageURI, uint256 duration, uint256 k)',

  'function allTokens(uint256) view returns (address)',
  'function tokenCount() view returns (uint256)',
  'function isToken(address) view returns (bool)',
  'function getAllTokens() view returns (address[])',
  'function getTokensByCreator(address) view returns (address[])',
  'function tokensSlice(uint256 offset, uint256 limit) view returns (address[])',
  'function tokenImplementation() view returns (address)',
  'function MAX_INITIAL_BUY_BPS() view returns (uint256)',
  'function treasury() view returns (address)',
  'function defaultK() view returns (uint256)',
  'function defaultRandomnessProvider() view returns (address)',
  'function defaultTrophyNFT() view returns (address)',
  'function creationFee() view returns (uint256)',
  'function publicCreation() view returns (bool)',
];

export const CLAC_TOKEN_V2_ABI = [
  // Lifecycle events
  'event Initialized(address indexed factory, address indexed creator, uint256 deathTime)',
  'event Trade(address indexed trader, bool indexed isBuy, uint256 tokenAmount, uint256 monAmount, uint256 protocolFee, uint256 creatorFee, uint256 newSupply, uint256 newPrice)',
  'event LotteryWeightChanged(address indexed holder, uint256 newWeight, uint256 newTotalWeight)',
  'event DeathRequested(address indexed requestedBy, uint64 sequenceNumber, uint256 lotteryFeePaid)',
  'event DeathFinalized(uint256 proRataPool, uint256 lotteryPool, address[3] winners)',
  'event Claimed(address indexed holder, uint256 proRataAmount, uint256 lotteryAmount)',
  'event FeeWithdrawn(address indexed who, uint256 amount)',
  'event TrophyMinted(address indexed holder, uint256 nftId)',
  'event UnclaimedSwept(address indexed treasury, uint256 amount)',

  // Static accessors
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function imageURI() view returns (string)',
  'function creator() view returns (address)',
  'function factory() view returns (address)',
  'function k() view returns (uint256)',
  'function createdAt() view returns (uint256)',
  'function deathTime() view returns (uint256)',
  'function treasury() view returns (address)',
  'function randomnessProvider() view returns (address)',
  'function trophyNFT() view returns (address)',

  // Trading state
  'function virtualSupply() view returns (uint256)',
  'function poolBalance() view returns (uint256)',
  'function totalHolders() view returns (uint256)',
  'function totalLotteryWeight() view returns (uint256)',
  'function balances(address) view returns (uint256)',
  'function lotteryWeight(address) view returns (uint256)',
  'function isHolder(address) view returns (bool)',
  'function pendingFees(address) view returns (uint256)',

  // Death state
  'function deathRequested() view returns (bool)',
  'function deathFinalized() view returns (bool)',
  'function deathRequestedBy() view returns (address)',
  'function deathSequenceNumber() view returns (uint64)',
  'function lotteryRandomness() view returns (bytes32)',
  'function deathProcessedAt() view returns (uint256)',
  'function totalSupplySnapshot() view returns (uint256)',
  'function proRataPool() view returns (uint256)',
  'function lotteryPool() view returns (uint256)',
  'function lotteryShare() view returns (uint256)',
  'function lotteryWinnersCount() view returns (uint256)',
  'function lotteryWinners(uint256) view returns (address)',
  'function getLotteryWinners() view returns (address[3])',

  // View helpers
  'function isAlive() view returns (bool)',
  'function isInLastHour() view returns (bool)',
  'function getTimeLeft() view returns (uint256)',
  'function getPrice() view returns (uint256)',
  'function getBuyCost(uint256 tokenAmount) view returns (uint256)',
  'function getSellQuote(uint256 tokenAmount) view returns (uint256)',
  'function getRandomnessFee() view returns (uint256)',
  'function getHolders() view returns (address[])',
  'function getClaimable(address user) view returns (uint256 proRataAmount, uint256 lotteryAmount)',
  'function claimed(address) view returns (bool)',
  'function trophyMinted(address) view returns (bool)',
  'function swept() view returns (bool)',
];

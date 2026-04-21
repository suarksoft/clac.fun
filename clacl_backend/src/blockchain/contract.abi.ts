export const CLAC_FACTORY_ABI = [
  'event TokenCreated(uint256 indexed tokenId, address indexed creator, string name, string symbol, string imageURI, uint256 duration)',
  'event Trade(uint256 indexed tokenId, address indexed trader, bool isBuy, uint256 tokenAmount, uint256 monAmount, uint256 protocolFee, uint256 creatorFee, uint256 newSupply, uint256 newPrice)',
  'event TokenClacced(uint256 indexed tokenId, uint256 poolRemaining, address triggeredBy)',
  'event LotteryWin(uint256 indexed tokenId, address indexed winner, uint256 amount)',
  'event Claimed(uint256 indexed tokenId, address indexed holder, uint256 amount)',

  'function tokens(uint256) view returns (address creator, string name, string symbol, string imageURI, uint256 virtualSupply, uint256 poolBalance, uint256 createdAt, uint256 duration, bool dead, bool deathProcessed, uint256 totalHolders)',
  'function balances(uint256, address) view returns (uint256)',
  'function getPrice(uint256 tokenId) view returns (uint256)',
  'function getBuyCost(uint256 tokenId, uint256 tokenAmount) view returns (uint256)',
  'function getSellQuote(uint256 tokenId, uint256 tokenAmount) view returns (uint256)',
  'function getTimeLeft(uint256 tokenId) view returns (uint256)',
  'function isAlive(uint256 tokenId) view returns (bool)',
  'function tokenCount() view returns (uint256)',
  'function getHolders(uint256 tokenId) view returns (address[])',
  'function claimable(uint256, address) view returns (uint256)',
  'function getFirstBuyerMultiplier(uint256 tokenId) view returns (uint256)',
];

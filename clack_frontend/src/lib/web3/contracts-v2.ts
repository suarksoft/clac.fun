import { parseAbi } from 'viem'
import { publicEnv } from '@/lib/env'

export const CLAC_FACTORY_V2_ADDRESS =
  (publicEnv.NEXT_PUBLIC_FACTORY_V2_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`

export const CLAC_FACTORY_V2_ABI = parseAbi([
  'event TokenCreated(address indexed token, address indexed creator, uint256 indexed index, string name, string symbol, string imageURI, uint256 duration, uint256 k)',
  'function createToken(string name, string symbol, string imageURI, uint256 duration, uint256 minInitialTokens) payable returns (address token)',
  'function allTokens(uint256) view returns (address)',
  'function tokenCount() view returns (uint256)',
  'function isToken(address) view returns (bool)',
  'function getAllTokens() view returns (address[])',
  'function getTokensByCreator(address) view returns (address[])',
  'function tokensSlice(uint256 offset, uint256 limit) view returns (address[])',
  'function creationFee() view returns (uint256)',
  'function publicCreation() view returns (bool)',
  'function defaultK() view returns (uint256)',
  'function MAX_INITIAL_BUY_BPS() view returns (uint256)',
  'function owner() view returns (address)',
])

export const CLAC_TOKEN_V2_ABI = parseAbi([
  // Events
  'event Trade(address indexed trader, bool indexed isBuy, uint256 tokenAmount, uint256 monAmount, uint256 protocolFee, uint256 creatorFee, uint256 newSupply, uint256 newPrice)',
  'event LotteryWeightChanged(address indexed holder, uint256 newWeight, uint256 newTotalWeight)',
  'event DeathRequested(address indexed requestedBy, uint64 sequenceNumber, uint256 lotteryFeePaid)',
  'event DeathFinalized(uint256 proRataPool, uint256 lotteryPool, address[3] winners)',
  'event Claimed(address indexed holder, uint256 proRataAmount, uint256 lotteryAmount)',
  'event TrophyMinted(address indexed holder, uint256 nftId)',
  // Static info
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function imageURI() view returns (string)',
  'function creator() view returns (address)',
  'function factory() view returns (address)',
  'function k() view returns (uint256)',
  'function createdAt() view returns (uint256)',
  'function deathTime() view returns (uint256)',
  // Trading state
  'function virtualSupply() view returns (uint256)',
  'function poolBalance() view returns (uint256)',
  'function totalHolders() view returns (uint256)',
  'function totalLotteryWeight() view returns (uint256)',
  'function balances(address) view returns (uint256)',
  'function lotteryWeight(address) view returns (uint256)',
  'function pendingFees(address) view returns (uint256)',
  // Death state
  'function deathRequested() view returns (bool)',
  'function deathFinalized() view returns (bool)',
  'function proRataPool() view returns (uint256)',
  'function lotteryPool() view returns (uint256)',
  'function getLotteryWinners() view returns (address[3])',
  // View helpers
  'function isAlive() view returns (bool)',
  'function isInLastHour() view returns (bool)',
  'function getTimeLeft() view returns (uint256)',
  'function getPrice() view returns (uint256)',
  'function getBuyCost(uint256 tokenAmount) view returns (uint256)',
  'function getSellQuote(uint256 tokenAmount) view returns (uint256)',
  'function getRandomnessFee() view returns (uint256)',
  'function getClaimable(address user) view returns (uint256 proRataAmount, uint256 lotteryAmount)',
  'function claimed(address) view returns (bool)',
  'function trophyMinted(address) view returns (bool)',
  // Write
  'function buy(uint256 minTokens) payable',
  'function sell(uint256 tokenAmount, uint256 minMON)',
  'function requestDeath() payable',
  'function claim()',
  'function mintTrophy()',
  'function withdrawFees()',
])

/** MAX_SUPPLY from contract: 1_000_000_000 tokens */
export const V2_MAX_SUPPLY = 1_000_000_000

/**
 * Estimates tokens received for a given MON input from supply=0.
 * kRaw: raw defaultK value from factory (bigint)
 * Returns tokens in human units (not wei).
 */
export function estimateInitialBuyTokens(inputMON: number, kRaw: bigint): number {
  if (inputMON <= 0 || kRaw === 0n) return 0
  const netMON = inputMON * 0.985
  const K = Number(kRaw) / 1e18
  return Math.pow((netMON * 3) / (2 * K), 2 / 3)
}

/**
 * Estimates MON cost to buy targetTokens from supply=0.
 * Returns MON in human units (includes fees).
 */
export function estimateInitialBuyCost(targetTokens: number, kRaw: bigint): number {
  if (targetTokens <= 0 || kRaw === 0n) return 0
  const K = Number(kRaw) / 1e18
  const gross = K * (2 / 3) * Math.pow(targetTokens, 1.5)
  return gross / 0.985
}

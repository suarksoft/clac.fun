import { publicEnv } from '@/lib/env'

export const CLAC_FACTORY_ADDRESS =
  publicEnv.NEXT_PUBLIC_CLAC_FACTORY_ADDRESS

export const CLAC_FACTORY_ABI = [
  {
    type: 'event',
    name: 'TokenCreated',
    inputs: [
      { indexed: true, name: 'tokenId', type: 'uint256' },
      { indexed: true, name: 'creator', type: 'address' },
      { indexed: false, name: 'name', type: 'string' },
      { indexed: false, name: 'symbol', type: 'string' },
      { indexed: false, name: 'imageURI', type: 'string' },
      { indexed: false, name: 'duration', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    stateMutability: 'payable',
    name: 'createToken',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'imageURI', type: 'string' },
      { name: 'duration', type: 'uint256' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'creationFee',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'publicCreation',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'setCreationFee',
    inputs: [{ name: '_fee', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'setPublicCreation',
    inputs: [{ name: '_public', type: 'bool' }],
    outputs: [],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'k',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'setK',
    inputs: [{ name: '_k', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'getBuyCost',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'tokenAmount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'getSellQuote',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'tokenAmount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'getTimeLeft',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    stateMutability: 'payable',
    name: 'buy',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'minTokens', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'sell',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'tokenAmount', type: 'uint256' },
      { name: 'minMON', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'claim',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'triggerDeath',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'getClaimable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'user', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'getBalance',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'user', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

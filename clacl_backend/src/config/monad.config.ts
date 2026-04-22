const sanitizeAddress = (value?: string) => (value ?? '').trim();

export const monadConfig = {
  testnet: {
    rpcUrl: process.env.MONAD_RPC_URL ?? 'https://testnet-rpc.monad.xyz',
    wsUrl: process.env.MONAD_WS_URL ?? 'wss://testnet-rpc.monad.xyz',
    chainId: 10143,
    contractAddress: sanitizeAddress(process.env.MONAD_CONTRACT_ADDRESS),
  },
  mainnet: {
    rpcUrl: process.env.MONAD_MAINNET_RPC_URL ?? 'https://rpc.monad.xyz',
    wsUrl: process.env.MONAD_MAINNET_WS_URL ?? 'wss://rpc.monad.xyz',
    chainId: 143,
    contractAddress: sanitizeAddress(process.env.MONAD_CONTRACT_ADDRESS_MAINNET),
  },
};

export const activeConfig = monadConfig.testnet;

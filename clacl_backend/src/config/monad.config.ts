const sanitizeAddress = (value?: string) => (value ?? '').trim();

export const monadConfig = {
  testnet: {
    rpcUrl: process.env.MONAD_RPC_URL ?? 'https://testnet-rpc.monad.xyz',
    wsUrl: process.env.MONAD_WS_URL ?? 'wss://testnet-rpc.monad.xyz',
    chainId: 10143,
    contractAddress: sanitizeAddress(process.env.MONAD_CONTRACT_ADDRESS),
    factoryV2Address: sanitizeAddress(process.env.MONAD_FACTORY_V2_ADDRESS),
  },
  mainnet: {
    rpcUrl: process.env.MONAD_MAINNET_RPC_URL ?? 'https://rpc.monad.xyz',
    wsUrl: process.env.MONAD_MAINNET_WS_URL ?? 'wss://rpc.monad.xyz',
    chainId: 143,
    contractAddress: sanitizeAddress(process.env.MONAD_CONTRACT_ADDRESS_MAINNET),
    factoryV2Address: sanitizeAddress(process.env.MONAD_FACTORY_V2_ADDRESS_MAINNET),
  },
};

// Set MONAD_NETWORK=mainnet in .env to switch to Monad Mainnet
const network = (process.env.MONAD_NETWORK ?? 'testnet').toLowerCase();
export const activeConfig =
  network === 'mainnet' ? monadConfig.mainnet : monadConfig.testnet;

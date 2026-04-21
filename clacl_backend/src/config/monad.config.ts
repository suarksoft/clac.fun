export const monadConfig = {
  testnet: {
    rpcUrl: 'https://testnet-rpc.monad.xyz',
    wsUrl: 'wss://testnet-rpc.monad.xyz',
    chainId: 10143,
    contractAddress: process.env.MONAD_CONTRACT_ADDRESS ?? '',
  },
  mainnet: {
    rpcUrl: 'https://rpc.monad.xyz',
    wsUrl: 'wss://rpc.monad.xyz',
    chainId: 143,
    contractAddress: process.env.MONAD_CONTRACT_ADDRESS_MAINNET ?? '',
  },
};

export const activeConfig = monadConfig.testnet;

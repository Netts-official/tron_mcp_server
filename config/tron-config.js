export const NETWORKS = {
  mainnet: {
    fullNode: 'https://api.trongrid.io',
    solidityNode: 'https://api.trongrid.io',
    eventServer: 'https://api.trongrid.io',
    tronScan: 'https://tronscan.org',
  },
  shasta: {
    fullNode: 'https://api.shasta.trongrid.io',
    solidityNode: 'https://api.shasta.trongrid.io',
    eventServer: 'https://api.shasta.trongrid.io',
    tronScan: 'https://shasta.tronscan.org',
  },
  nile: {
    fullNode: 'https://nile.trongrid.io',
    solidityNode: 'https://nile.trongrid.io',
    eventServer: 'https://nile.trongrid.io',
    tronScan: 'https://nile.tronscan.org',
  },
};

export const CONTRACT_ADDRESSES = {
  mainnet: {
    USDT: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    USDC: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8',
    WTRX: 'TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR',
  },
  shasta: {
    // Add Shasta testnet contract addresses here
  },
  nile: {
    // Add Nile testnet contract addresses here
  },
};

export const DEFAULT_FEE_LIMIT = 150000000; // 150 TRX
export const DEFAULT_CALL_VALUE = 0;
export const CONFIRMATION_TIME = 3000; // 3 seconds
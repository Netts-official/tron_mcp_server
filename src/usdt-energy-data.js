/**
 * USDT Energy Data - Accurate energy consumption data for USDT operations
 */
export const USDTEnergyData = {
  // USDT Contract Address
  CONTRACT_ADDRESS: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  
  // Test addresses for energy estimation
  TEST_ADDRESSES: {
    EXISTING_ADDRESS: 'TKyWtnzwBNiQ7aZc7drNjAULb65kDJSXeq', // For testing transfers to existing addresses
    NEW_ADDRESS_TEMPLATE: 'TC6uvxCcXzYeRo7uphDPfFR5QhdwFL5crW' // Template for new address transfers
  },
  
  // Energy consumption by function
  FUNCTIONS: {
    transfer: {
      toExistingAddress: 13940, // Energy for transfer to existing address
      toNewAddress: 31990,      // Energy for transfer to new address (activation)
      description: 'Transfer USDT to another address'
    },
    
    approve: {
      energy: 13180,
      description: 'Approve another address to spend USDT'
    },
    
    transferFrom: {
      energy: 18190,
      description: 'Transfer USDT from approved address'
    },
    
    balanceOf: {
      energy: 680,
      description: 'Query USDT balance of an address'
    },
    
    allowance: {
      energy: 680,
      description: 'Query allowance between two addresses'
    }
  },
  
  // Energy price information
  ENERGY_PRICING: {
    sunPerUnit: 210,           // Current energy price: 210 SUN per unit
    trxPerUnit: 0.00021,       // Equivalent in TRX
    usdPerUnit: 0.00004,       // Approximate USD cost per unit
    burnedTrxAlternative: 14.5 // TRX burned if no energy available
  },
  
  // Common transfer scenarios
  SCENARIOS: {
    standardTransfer: {
      energy: 13940,
      costInSun: 13940 * 210,
      costInTrx: 13940 * 0.00021,
      description: 'Standard USDT transfer to existing address'
    },
    
    newAddressTransfer: {
      energy: 31990,
      costInSun: 31990 * 210,
      costInTrx: 31990 * 0.00021,
      description: 'USDT transfer to new address (includes activation)'
    },
    
    withoutEnergy: {
      energy: 0,
      burnedTrx: 14.5,
      description: 'Transfer without sufficient energy (burns TRX)'
    }
  },
  
  // Helper functions
  calculateCost: function(energy, pricePerUnit = this.ENERGY_PRICING.sunPerUnit) {
    return {
      energy: energy,
      costInSun: energy * pricePerUnit,
      costInTrx: energy * pricePerUnit / 1000000,
      costInUsd: energy * this.ENERGY_PRICING.usdPerUnit
    };
  },
  
  isNewAddress: function(address) {
    // This would need to check if address has been activated
    // For now, return false (assume existing address)
    return false;
  },
  
  getTransferEnergy: function(toAddress) {
    return this.isNewAddress(toAddress) 
      ? this.FUNCTIONS.transfer.toNewAddress
      : this.FUNCTIONS.transfer.toExistingAddress;
  },
  
  // Energy estimation for different amounts
  estimateByAmount: function(amount, toAddress) {
    const baseEnergy = this.getTransferEnergy(toAddress);
    
    // Large amounts might require slightly more energy
    if (amount > 1000000 * 1000000) { // > 1M USDT
      return baseEnergy + 500;
    }
    
    return baseEnergy;
  }
};

export default USDTEnergyData;
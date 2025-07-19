import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class NetworkMonitor {
  constructor(tronWeb, tronScanAPI, priceTracker) {
    this.tronWeb = tronWeb;
    this.tronScanAPI = tronScanAPI;
    this.priceTracker = priceTracker;
    this.cacheDir = path.join(__dirname, '..', 'cache');
    this.networkData = {
      parameters: null,
      statistics: null,
      lastUpdate: null
    };
    this.updateInterval = null;
  }

  async initialize() {
    console.error('Initializing network monitor...');
    await this.updateNetworkData();
    
    // Update every hour
    this.updateInterval = setInterval(() => {
      this.updateNetworkData().catch(console.error);
    }, 3600000); // 1 hour
    
    console.error('Network monitor initialized. Updates every hour.');
  }

  async updateNetworkData() {
    console.error('Updating network data...');
    
    try {
      // Get chain parameters
      const parameters = await this.tronWeb.trx.getChainParameters();
      
      // Get node info
      const nodeInfo = await this.tronWeb.trx.getNodeInfo();
      
      // Get current block
      const currentBlock = await this.tronWeb.trx.getCurrentBlock();
      
      // Get TronScan statistics
      const tronStats = await this.tronScanAPI.getTronStatistics();
      const energyPrices = await this.tronScanAPI.getEnergyPrices();
      const stakingRate = await this.tronScanAPI.getStakingRate();
      const bandwidthData = await this.tronScanAPI.getBandwidthConsumption();
      
      // Get TRX price
      const trxPrice = await this.priceTracker.getTRXPrice();
      
      this.networkData = {
        parameters: this.parseChainParameters(parameters),
        nodeInfo: {
          version: nodeInfo.configNodeInfo?.codeVersion,
          p2pVersion: nodeInfo.configNodeInfo?.p2pVersion,
          listenPort: nodeInfo.configNodeInfo?.listenPort,
          discoverEnable: nodeInfo.configNodeInfo?.discoverEnable,
          activeNodeSize: nodeInfo.configNodeInfo?.activeNodeSize,
          passiveNodeSize: nodeInfo.configNodeInfo?.passiveNodeSize,
          totalFlow: nodeInfo.totalFlow,
          beginSyncNum: nodeInfo.beginSyncNum,
          block: nodeInfo.block,
          solidityBlock: nodeInfo.solidityBlock,
          currentConnectCount: nodeInfo.currentConnectCount
        },
        currentBlock: {
          number: currentBlock.block_header.raw_data.number,
          timestamp: currentBlock.block_header.raw_data.timestamp,
          witnessAddress: currentBlock.block_header.raw_data.witness_address,
          transactionCount: currentBlock.transactions?.length || 0,
          blockID: currentBlock.blockID
        },
        statistics: {
          overview: tronStats,
          energyPrices: energyPrices,
          stakingRate: stakingRate,
          bandwidth: bandwidthData
        },
        price: trxPrice,
        lastUpdate: new Date().toISOString()
      };
      
      // Save to cache
      await this.saveNetworkData();
      
      console.error('Network data updated successfully');
      return this.networkData;
    } catch (error) {
      console.error('Failed to update network data:', error);
      throw error;
    }
  }

  parseChainParameters(parameters) {
    const parsed = {};
    
    parameters.forEach(param => {
      const key = param.key;
      let value = param.value;
      
      // Convert known parameters to readable format
      switch (key) {
        case 'getMaintenanceTimeInterval':
          parsed.maintenanceInterval = value;
          break;
        case 'getAccountUpgradeCost':
          parsed.accountUpgradeCost = value / 1000000; // Convert to TRX
          break;
        case 'getCreateAccountFee':
          parsed.createAccountFee = value / 1000000;
          break;
        case 'getTransactionFee':
          parsed.transactionFee = value / 1000000;
          break;
        case 'getAssetIssueFee':
          parsed.assetIssueFee = value / 1000000;
          break;
        case 'getWitnessPayPerBlock':
          parsed.witnessPayPerBlock = value / 1000000;
          break;
        case 'getWitnessStandbyAllowance':
          parsed.witnessStandbyAllowance = value / 1000000;
          break;
        case 'getCreateNewAccountFeeInSystemContract':
          parsed.createNewAccountFeeInSystemContract = value / 1000000;
          break;
        case 'getCreateNewAccountBandwidthRate':
          parsed.createNewAccountBandwidthRate = value;
          break;
        case 'getAllowCreationOfContracts':
          parsed.allowCreationOfContracts = value === 1;
          break;
        case 'getEnergyFee':
          parsed.energyFee = value / 1000000;
          break;
        case 'getExchangeCreateFee':
          parsed.exchangeCreateFee = value / 1000000;
          break;
        case 'getMaxCpuTimeOfOneTx':
          parsed.maxCpuTimeOfOneTx = value;
          break;
        case 'getAllowUpdateAccountName':
          parsed.allowUpdateAccountName = value === 1;
          break;
        case 'getAllowSameTokenName':
          parsed.allowSameTokenName = value === 1;
          break;
        case 'getAllowDelegateResource':
          parsed.allowDelegateResource = value === 1;
          break;
        case 'getTotalEnergyLimit':
          parsed.totalEnergyLimit = value;
          break;
        case 'getAllowTvmTransferTrc10':
          parsed.allowTvmTransferTrc10 = value === 1;
          break;
        case 'getTotalEnergyCurrentLimit':
          parsed.totalEnergyCurrentLimit = value;
          break;
        case 'getAllowMultiSign':
          parsed.allowMultiSign = value === 1;
          break;
        case 'getAllowAdaptiveEnergy':
          parsed.allowAdaptiveEnergy = value === 1;
          break;
        case 'getUpdateAccountPermissionFee':
          parsed.updateAccountPermissionFee = value / 1000000;
          break;
        case 'getMultiSignFee':
          parsed.multiSignFee = value / 1000000;
          break;
        case 'getAllowAccountStateRoot':
          parsed.allowAccountStateRoot = value === 1;
          break;
        case 'getAllowProtoFilterNum':
          parsed.allowProtoFilterNum = value === 1;
          break;
        case 'getActivePermissionCount':
          parsed.activePermissionCount = value;
          break;
        case 'getPermissionUpdateDeleteCost':
          parsed.permissionUpdateDeleteCost = value / 1000000;
          break;
        case 'getPermissionCreateCost':
          parsed.permissionCreateCost = value / 1000000;
          break;
        default:
          parsed[key] = value;
      }
    });
    
    return parsed;
  }

  async saveNetworkData() {
    const dataFile = path.join(this.cacheDir, 'network_data.json');
    await fs.writeFile(dataFile, JSON.stringify(this.networkData, null, 2));
  }

  async loadCachedData() {
    try {
      const dataFile = path.join(this.cacheDir, 'network_data.json');
      const data = await fs.readFile(dataFile, 'utf8');
      this.networkData = JSON.parse(data);
      return this.networkData;
    } catch (error) {
      return null;
    }
  }

  getNetworkData() {
    return this.networkData;
  }

  getChainParameters() {
    return this.networkData.parameters;
  }

  getCurrentPrice() {
    return this.networkData.price;
  }

  getStatistics() {
    return this.networkData.statistics;
  }

  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      console.error('Network monitor stopped');
    }
  }
}
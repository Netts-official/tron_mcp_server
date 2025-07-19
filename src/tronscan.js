import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TronScanAPI {
  constructor() {
    this.baseURL = 'https://apilist.tronscanapi.com/api';
    this.cacheDir = path.join(__dirname, '..', 'cache');
    this.apiKeys = process.env.API_KEYS ? process.env.API_KEYS.split(',') : [];
    this.currentKeyIndex = 0;
    this.ensureCacheDir();
  }

  async ensureCacheDir() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create cache directory:', error);
    }
  }

  getApiKey() {
    if (this.apiKeys.length === 0) return null;
    const key = this.apiKeys[this.currentKeyIndex];
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    return key;
  }

  async makeRequest(endpoint, params = {}) {
    try {
      const apiKey = this.getApiKey();
      const headers = apiKey ? { 'TRON-PRO-API-KEY': apiKey } : {};
      
      const response = await axios.get(`${this.baseURL}${endpoint}`, {
        params,
        headers,
        timeout: 10000,
      });
      
      return response.data;
    } catch (error) {
      console.error(`TronScan API error for ${endpoint}:`, error.message);
      throw error;
    }
  }

  async getEnergyConsumptionData(limit = 10, day = null) {
    const params = { limit };
    if (day) params.day = day;
    
    const cacheKey = `energy_consumption_${limit}_${day || 'latest'}`;
    return await this.getCachedOrFetch(
      cacheKey,
      () => this.makeRequest('/energydailystatistic', params),
      3600000 // 1 hour cache
    );
  }

  async getEnergyDistribution() {
    return await this.getCachedOrFetch(
      'energy_distribution',
      () => this.makeRequest('/energystatistic'),
      3600000
    );
  }

  async getContractStatistics(limit = 10) {
    return await this.getCachedOrFetch(
      `contract_stats_${limit}`,
      () => this.makeRequest('/statistic/contract', { limit }),
      3600000
    );
  }

  async getTronStatistics() {
    return await this.getCachedOrFetch(
      'tron_statistics',
      () => this.makeRequest('/stats/overview'),
      1800000 // 30 minutes cache
    );
  }

  async getTRXSupplyData() {
    return await this.getCachedOrFetch(
      'trx_supply',
      () => this.makeRequest('/statistic/supply'),
      3600000
    );
  }

  async getTransactionTrend(days = 7) {
    return await this.getCachedOrFetch(
      `transaction_trend_${days}`,
      () => this.makeRequest('/statistic/transaction', { days }),
      3600000
    );
  }

  async getActiveAccounts(days = 7) {
    return await this.getCachedOrFetch(
      `active_accounts_${days}`,
      () => this.makeRequest('/statistic/activeaccounts', { days }),
      3600000
    );
  }

  async getBandwidthConsumption() {
    return await this.getCachedOrFetch(
      'bandwidth_consumption',
      () => this.makeRequest('/netstatistic'),
      3600000
    );
  }

  async getDefiTVL() {
    return await this.getCachedOrFetch(
      'defi_tvl',
      () => this.makeRequest('/defiTvl'),
      1800000
    );
  }

  async getEnergyPrices() {
    return await this.getCachedOrFetch(
      'energy_prices',
      () => this.makeRequest('/acquisition_cost_statistic'),
      1800000
    );
  }

  async getStakingRate() {
    return await this.getCachedOrFetch(
      'staking_rate',
      () => this.makeRequest('/freezeresource'),
      3600000
    );
  }

  async getContractCalledDistribution(contractAddress) {
    return await this.getCachedOrFetch(
      `contract_called_${contractAddress}`,
      () => this.makeRequest('/contract/called-distribution', { 
        address: contractAddress 
      }),
      3600000
    );
  }

  async getTokenTVC() {
    return await this.getCachedOrFetch(
      'token_tvc',
      () => this.makeRequest('/statistic/token/tvc'),
      3600000
    );
  }

  async getBlockSizeData(days = 7) {
    return await this.getCachedOrFetch(
      `block_size_${days}`,
      () => this.makeRequest('/statistic/blocksize', { days }),
      3600000
    );
  }

  async getCumulativeBlockSize() {
    return await this.getCachedOrFetch(
      'cumulative_block_size',
      () => this.makeRequest('/statistic/blocksize/cumulative'),
      3600000
    );
  }

  async getTRXPriceHistory(days = 30) {
    return await this.getCachedOrFetch(
      `trx_price_history_${days}`,
      () => this.makeRequest('/statistic/price', { days }),
      1800000
    );
  }

  async getTRXHolders(limit = 100) {
    return await this.getCachedOrFetch(
      `trx_holders_${limit}`,
      () => this.makeRequest('/statistic/holders', { limit }),
      3600000
    );
  }

  async getNewUsersDaily(days = 7) {
    return await this.getCachedOrFetch(
      `new_users_${days}`,
      () => this.makeRequest('/statistic/newusers', { days }),
      3600000
    );
  }

  async getCurrentBlock() {
    return await this.getCachedOrFetch(
      'current_block',
      () => this.makeRequest('/block/latest'),
      30000 // 30 seconds cache for current block
    );
  }

  async getBlock(blockNumber) {
    return await this.getCachedOrFetch(
      `block_${blockNumber}`,
      () => this.makeRequest(`/block/${blockNumber}`),
      3600000 // 1 hour cache for specific blocks
    );
  }

  async getCachedOrFetch(cacheKey, fetchFunction, ttl = 3600000) {
    const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);
    
    try {
      const stats = await fs.stat(cacheFile);
      const age = Date.now() - stats.mtimeMs;
      
      if (age < ttl) {
        const cached = await fs.readFile(cacheFile, 'utf8');
        return JSON.parse(cached);
      }
    } catch (error) {
      // Cache miss, continue to fetch
    }
    
    try {
      const data = await fetchFunction();
      await fs.writeFile(cacheFile, JSON.stringify(data, null, 2));
      return data;
    } catch (error) {
      // If fetch fails, try to return stale cache
      try {
        const cached = await fs.readFile(cacheFile, 'utf8');
        return JSON.parse(cached);
      } catch (cacheError) {
        throw error;
      }
    }
  }

  async clearCache() {
    try {
      const files = await fs.readdir(this.cacheDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(this.cacheDir, file)))
      );
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }
}
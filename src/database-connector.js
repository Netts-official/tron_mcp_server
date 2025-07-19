import { MongoClient } from 'mongodb';
import { ClickHouse } from 'clickhouse';
import fetch from 'node-fetch';

export class DatabaseConnector {
  constructor() {
    this.mongoClient = null;
    this.clickHouseClient = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      // Initialize MongoDB connection
      const mongoUri = process.env.MONGODB_URI || 'mongodb://scaner842898Kg:kajsdhfiuKJA%26T3932@37.27.231.90:27017/mongobase';
      this.mongoClient = new MongoClient(mongoUri);
      await this.mongoClient.connect();
      this.mongoDb = this.mongoClient.db('mongobase');
      console.error('[Database Connector] MongoDB connected');

      // Initialize ClickHouse connection
      this.clickHouseClient = new ClickHouse({
        url: process.env.CLICKHOUSE_HOST || '37.27.231.90',
        port: process.env.CLICKHOUSE_PORT || 8123,
        basicAuth: {
          username: process.env.CLICKHOUSE_USER || 'click23948u',
          password: process.env.CLICKHOUSE_PASSWORD || 'kjdsf98UKAJ%28%2AU%23JK'
        },
        config: {
          database: process.env.CLICKHOUSE_DATABASE || 'tron_blockchain'
        }
      });
      console.error('[Database Connector] ClickHouse configured');

      this.isInitialized = true;
    } catch (error) {
      console.error('[Database Connector] Initialization failed:', error.message);
      throw error;
    }
  }

  async getEnergyStatisticsFromTRC20(address, tokenAddress = null, limit = 100) {
    try {
      let query = `
        SELECT 
          toAddress,
          tokenAddress,
          AVG(energyUsage) as avg_energy,
          MIN(energyUsage) as min_energy,
          MAX(energyUsage) as max_energy,
          COUNT(*) as transfer_count,
          toStartOfDay(blockTimestamp) as date
        FROM tron_blockchain.trc20_transfers
        WHERE 1=1
      `;

      const params = [];
      if (address) {
        query += ` AND (fromAddress = ? OR toAddress = ?)`;
        params.push(address, address);
      }
      if (tokenAddress) {
        query += ` AND tokenAddress = ?`;
        params.push(tokenAddress);
      }

      query += `
        GROUP BY toAddress, tokenAddress, date
        ORDER BY date DESC
        LIMIT ?
      `;
      params.push(limit);

      const result = await this.executeClickHouseQuery(query, params);
      return result;
    } catch (error) {
      console.error('[Database Connector] Error getting energy statistics:', error.message);
      throw error;
    }
  }

  async getTransactionHistory(address, limit = 100) {
    try {
      const query = `
        SELECT 
          blockNumber,
          transactionHash,
          fromAddress,
          toAddress,
          value,
          energyUsage,
          energyFee,
          netUsage,
          netFee,
          contractAddress,
          contractType,
          blockTimestamp
        FROM tron_blockchain.BlockTransactions
        WHERE fromAddress = ? OR toAddress = ?
        ORDER BY blockTimestamp DESC
        LIMIT ?
      `;

      const result = await this.executeClickHouseQuery(query, [address, address, limit]);
      return result;
    } catch (error) {
      console.error('[Database Connector] Error getting transaction history:', error.message);
      throw error;
    }
  }

  async getResourceDelegation(address) {
    try {
      const query = `
        SELECT 
          from_address,
          to_address,
          resource_type,
          resource_amount,
          delegation_time,
          expiration_time,
          is_active
        FROM tron_blockchain.resource_delegation
        WHERE (from_address = ? OR to_address = ?)
          AND is_active = 1
        ORDER BY delegation_time DESC
      `;

      const result = await this.executeClickHouseQuery(query, [address, address]);
      return result;
    } catch (error) {
      console.error('[Database Connector] Error getting resource delegation:', error.message);
      throw error;
    }
  }

  async getContractEnergyAnalysis(contractAddress, functionSelector = null, timeRange = 7) {
    try {
      let query = `
        SELECT 
          contractAddress,
          functionSelector,
          AVG(energyUsage) as avg_energy,
          MIN(energyUsage) as min_energy,
          MAX(energyUsage) as max_energy,
          STDDEV(energyUsage) as stddev_energy,
          COUNT(*) as call_count,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
          toStartOfDay(blockTimestamp) as date
        FROM tron_blockchain.BlockTransactions
        WHERE contractAddress = ?
          AND blockTimestamp >= now() - INTERVAL ? DAY
      `;

      const params = [contractAddress, timeRange];
      
      if (functionSelector) {
        query += ` AND functionSelector = ?`;
        params.push(functionSelector);
      }

      query += `
        GROUP BY contractAddress, functionSelector, date
        ORDER BY date DESC
      `;

      const result = await this.executeClickHouseQuery(query, params);
      return result;
    } catch (error) {
      console.error('[Database Connector] Error analyzing contract energy:', error.message);
      throw error;
    }
  }

  async getUSDTTransferStats(timeRange = 30) {
    try {
      const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
      
      const query = `
        SELECT 
          toStartOfDay(blockTimestamp) as date,
          COUNT(*) as transfer_count,
          AVG(energyUsage) as avg_energy,
          PERCENTILE(energyUsage, 0.5) as median_energy,
          PERCENTILE(energyUsage, 0.95) as p95_energy,
          SUM(energyUsage) as total_energy,
          COUNT(DISTINCT fromAddress) as unique_senders,
          COUNT(DISTINCT toAddress) as unique_receivers
        FROM tron_blockchain.trc20_transfers
        WHERE tokenAddress = ?
          AND blockTimestamp >= now() - INTERVAL ? DAY
        GROUP BY date
        ORDER BY date DESC
      `;

      const result = await this.executeClickHouseQuery(query, [USDT_CONTRACT, timeRange]);
      return result;
    } catch (error) {
      console.error('[Database Connector] Error getting USDT transfer stats:', error.message);
      throw error;
    }
  }

  async getTopEnergyConsumers(limit = 100) {
    try {
      const query = `
        SELECT 
          fromAddress as address,
          COUNT(*) as transaction_count,
          SUM(energyUsage) as total_energy,
          AVG(energyUsage) as avg_energy,
          SUM(energyFee) as total_energy_fee,
          COUNT(DISTINCT contractAddress) as unique_contracts
        FROM tron_blockchain.BlockTransactions
        WHERE blockTimestamp >= now() - INTERVAL 7 DAY
          AND energyUsage > 0
        GROUP BY address
        ORDER BY total_energy DESC
        LIMIT ?
      `;

      const result = await this.executeClickHouseQuery(query, [limit]);
      return result;
    } catch (error) {
      console.error('[Database Connector] Error getting top energy consumers:', error.message);
      throw error;
    }
  }

  async getAddressEnergyProfile(address) {
    try {
      // Get from MongoDB for real-time data
      const mongoData = await this.mongoDb.collection('address_profiles').findOne({ address });

      // Get historical data from ClickHouse
      const clickHouseQuery = `
        SELECT 
          toStartOfHour(blockTimestamp) as hour,
          COUNT(*) as transaction_count,
          SUM(energyUsage) as total_energy,
          AVG(energyUsage) as avg_energy,
          COUNT(DISTINCT contractAddress) as unique_contracts
        FROM tron_blockchain.BlockTransactions
        WHERE fromAddress = ?
          AND blockTimestamp >= now() - INTERVAL 24 HOUR
        GROUP BY hour
        ORDER BY hour DESC
      `;

      const historicalData = await this.executeClickHouseQuery(clickHouseQuery, [address]);

      return {
        realtimeData: mongoData,
        historicalData: historicalData
      };
    } catch (error) {
      console.error('[Database Connector] Error getting address energy profile:', error.message);
      throw error;
    }
  }

  async executeClickHouseQuery(query, params = []) {
    try {
      // Format query with parameters
      let formattedQuery = query;
      params.forEach((param) => {
        formattedQuery = formattedQuery.replace('?', `'${param}'`);
      });

      const stream = this.clickHouseClient.query(formattedQuery);
      const result = await stream.toPromise();
      
      return result;
    } catch (error) {
      console.error('[Database Connector] ClickHouse query error:', error.message);
      throw error;
    }
  }

  async saveEnergyEstimation(estimation) {
    try {
      // Save to MongoDB for quick access
      const collection = this.mongoDb.collection('energy_estimations');
      await collection.insertOne({
        ...estimation,
        timestamp: new Date(),
        ttl: new Date(Date.now() + 3600000) // 1 hour TTL
      });
    } catch (error) {
      console.error('[Database Connector] Error saving energy estimation:', error.message);
    }
  }

  async getNetworkEnergyTrends(days = 7) {
    try {
      const query = `
        SELECT 
          toStartOfHour(blockTimestamp) as hour,
          COUNT(*) as transaction_count,
          SUM(energyUsage) as total_energy,
          AVG(energyUsage) as avg_energy,
          SUM(energyFee) as total_energy_fee,
          AVG(energyFee / GREATEST(energyUsage, 1)) as avg_energy_price
        FROM tron_blockchain.BlockTransactions
        WHERE blockTimestamp >= now() - INTERVAL ? DAY
          AND energyUsage > 0
        GROUP BY hour
        ORDER BY hour DESC
      `;

      const result = await this.executeClickHouseQuery(query, [days]);
      return result;
    } catch (error) {
      console.error('[Database Connector] Error getting network energy trends:', error.message);
      throw error;
    }
  }

  async close() {
    try {
      if (this.mongoClient) {
        await this.mongoClient.close();
      }
      this.isInitialized = false;
      console.error('[Database Connector] Connections closed');
    } catch (error) {
      console.error('[Database Connector] Error closing connections:', error.message);
    }
  }
}
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PriceTracker {
  constructor() {
    this.cacheDir = path.join(__dirname, '..', 'cache');
    this.coingeckoURL = 'https://api.coingecko.com/api/v3';
    this.ensureCacheDir();
  }

  async ensureCacheDir() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create cache directory:', error);
    }
  }

  async getTRXPrice() {
    const cacheFile = path.join(this.cacheDir, 'trx_price.json');
    
    // Check cache (5 minutes TTL for price data)
    try {
      const stats = await fs.stat(cacheFile);
      const age = Date.now() - stats.mtimeMs;
      if (age < 300000) { // 5 minutes
        const cached = await fs.readFile(cacheFile, 'utf8');
        return JSON.parse(cached);
      }
    } catch (error) {
      // Cache miss
    }

    try {
      const response = await axios.get(`${this.coingeckoURL}/simple/price`, {
        params: {
          ids: 'tron',
          vs_currencies: 'usd,eur,btc,eth',
          include_market_cap: true,
          include_24hr_vol: true,
          include_24hr_change: true,
          include_last_updated_at: true
        },
        timeout: 10000
      });

      const priceData = {
        prices: response.data.tron,
        timestamp: Date.now(),
        source: 'coingecko'
      };

      // Cache the result
      await fs.writeFile(cacheFile, JSON.stringify(priceData, null, 2));
      
      return priceData;
    } catch (error) {
      // Try to return stale cache if API fails
      try {
        const cached = await fs.readFile(cacheFile, 'utf8');
        const data = JSON.parse(cached);
        data.stale = true;
        return data;
      } catch (cacheError) {
        throw new Error(`Failed to fetch TRX price: ${error.message}`);
      }
    }
  }

  async getTRXMarketData() {
    const cacheFile = path.join(this.cacheDir, 'trx_market_data.json');
    
    // Check cache (15 minutes TTL)
    try {
      const stats = await fs.stat(cacheFile);
      const age = Date.now() - stats.mtimeMs;
      if (age < 900000) { // 15 minutes
        const cached = await fs.readFile(cacheFile, 'utf8');
        return JSON.parse(cached);
      }
    } catch (error) {
      // Cache miss
    }

    try {
      const response = await axios.get(`${this.coingeckoURL}/coins/tron`, {
        params: {
          localization: false,
          tickers: false,
          market_data: true,
          community_data: true,
          developer_data: false,
          sparkline: true
        },
        timeout: 10000
      });

      const marketData = {
        id: response.data.id,
        symbol: response.data.symbol,
        name: response.data.name,
        market_data: {
          current_price: response.data.market_data.current_price,
          market_cap: response.data.market_data.market_cap,
          market_cap_rank: response.data.market_data.market_cap_rank,
          total_volume: response.data.market_data.total_volume,
          high_24h: response.data.market_data.high_24h,
          low_24h: response.data.market_data.low_24h,
          price_change_24h: response.data.market_data.price_change_24h,
          price_change_percentage_24h: response.data.market_data.price_change_percentage_24h,
          price_change_percentage_7d: response.data.market_data.price_change_percentage_7d,
          price_change_percentage_30d: response.data.market_data.price_change_percentage_30d,
          circulating_supply: response.data.market_data.circulating_supply,
          total_supply: response.data.market_data.total_supply,
          ath: response.data.market_data.ath,
          ath_date: response.data.market_data.ath_date,
          atl: response.data.market_data.atl,
          atl_date: response.data.market_data.atl_date
        },
        sparkline_7d: response.data.market_data.sparkline_7d,
        last_updated: response.data.last_updated,
        timestamp: Date.now()
      };

      // Cache the result
      await fs.writeFile(cacheFile, JSON.stringify(marketData, null, 2));
      
      return marketData;
    } catch (error) {
      // Try to return stale cache if API fails
      try {
        const cached = await fs.readFile(cacheFile, 'utf8');
        const data = JSON.parse(cached);
        data.stale = true;
        return data;
      } catch (cacheError) {
        throw new Error(`Failed to fetch TRX market data: ${error.message}`);
      }
    }
  }

  async getPriceHistory(days = 30) {
    const cacheFile = path.join(this.cacheDir, `trx_price_history_${days}.json`);
    
    // Check cache (1 hour TTL for historical data)
    try {
      const stats = await fs.stat(cacheFile);
      const age = Date.now() - stats.mtimeMs;
      if (age < 3600000) { // 1 hour
        const cached = await fs.readFile(cacheFile, 'utf8');
        return JSON.parse(cached);
      }
    } catch (error) {
      // Cache miss
    }

    try {
      const response = await axios.get(`${this.coingeckoURL}/coins/tron/market_chart`, {
        params: {
          vs_currency: 'usd',
          days: days,
          interval: days > 30 ? 'daily' : 'hourly'
        },
        timeout: 10000
      });

      const historyData = {
        prices: response.data.prices,
        market_caps: response.data.market_caps,
        total_volumes: response.data.total_volumes,
        days: days,
        timestamp: Date.now()
      };

      // Cache the result
      await fs.writeFile(cacheFile, JSON.stringify(historyData, null, 2));
      
      return historyData;
    } catch (error) {
      // Try to return stale cache if API fails
      try {
        const cached = await fs.readFile(cacheFile, 'utf8');
        const data = JSON.parse(cached);
        data.stale = true;
        return data;
      } catch (cacheError) {
        throw new Error(`Failed to fetch TRX price history: ${error.message}`);
      }
    }
  }

  async getOHLCData(days = 7) {
    const cacheFile = path.join(this.cacheDir, `trx_ohlc_${days}.json`);
    
    // Check cache (30 minutes TTL)
    try {
      const stats = await fs.stat(cacheFile);
      const age = Date.now() - stats.mtimeMs;
      if (age < 1800000) { // 30 minutes
        const cached = await fs.readFile(cacheFile, 'utf8');
        return JSON.parse(cached);
      }
    } catch (error) {
      // Cache miss
    }

    try {
      const response = await axios.get(`${this.coingeckoURL}/coins/tron/ohlc`, {
        params: {
          vs_currency: 'usd',
          days: days
        },
        timeout: 10000
      });

      const ohlcData = {
        data: response.data.map(candle => ({
          timestamp: candle[0],
          open: candle[1],
          high: candle[2],
          low: candle[3],
          close: candle[4]
        })),
        days: days,
        timestamp: Date.now()
      };

      // Cache the result
      await fs.writeFile(cacheFile, JSON.stringify(ohlcData, null, 2));
      
      return ohlcData;
    } catch (error) {
      // Try to return stale cache if API fails
      try {
        const cached = await fs.readFile(cacheFile, 'utf8');
        const data = JSON.parse(cached);
        data.stale = true;
        return data;
      } catch (cacheError) {
        throw new Error(`Failed to fetch TRX OHLC data: ${error.message}`);
      }
    }
  }
}
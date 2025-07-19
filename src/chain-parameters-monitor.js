/**
 * Chain Parameters Monitor
 * Получает актуальные параметры сети TRON и курс TRX в реальном времени
 */

import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

export class ChainParametersMonitor {
  constructor(tronWeb) {
    this.tronWeb = tronWeb;
    this.cacheFile = path.join(process.cwd(), 'cache', 'chain-parameters.json');
    this.cache = null;
    this.cacheExpiry = 5 * 60 * 1000; // 5 минут
  }

  /**
   * Получает актуальные параметры сети
   */
  async getChainParameters() {
    try {
      // Проверяем кеш
      if (await this.isCacheValid()) {
        return this.cache.parameters;
      }

      console.error('[CHAIN-PARAMS] Fetching fresh chain parameters...');
      
      // Получаем параметры с ноды
      const response = await fetch(`${this.tronWeb.fullNode.host}/wallet/getchainparameters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const params = {};
      
      // Преобразуем массив параметров в объект
      for (const item of data.chainParameter || []) {
        params[item.key] = item.value;
      }

      // Сохраняем в кеш
      await this.saveToCache({ parameters: params });
      
      return params;
    } catch (error) {
      console.error('[CHAIN-PARAMS] Error fetching chain parameters:', error);
      // Возвращаем последний известный кеш если есть
      if (this.cache) {
        return this.cache.parameters;
      }
      throw error;
    }
  }

  /**
   * Получает энергию за 1 TRX
   */
  async getEnergyPerTRX() {
    try {
      const accountResource = await this.tronWeb.trx.getAccountResources();
      
      const totalEnergyLimit = accountResource.TotalEnergyLimit || 0;
      const totalEnergyWeight = accountResource.TotalEnergyWeight || 0;
      
      if (totalEnergyWeight > 0) {
        return totalEnergyLimit / totalEnergyWeight;
      }
      
      // Fallback значение
      return 2380; // Примерное значение на январь 2025
    } catch (error) {
      console.error('[CHAIN-PARAMS] Error getting energy per TRX:', error);
      return 2380;
    }
  }

  /**
   * Получает актуальный курс TRX в USD
   */
  async getTRXPrice() {
    try {
      // Проверяем кеш
      if (await this.isCacheValid() && this.cache.trxPrice) {
        const priceAge = Date.now() - new Date(this.cache.trxPriceUpdated).getTime();
        if (priceAge < 60000) { // Если цена обновлялась менее минуты назад
          return this.cache.trxPrice;
        }
      }

      console.error('[CHAIN-PARAMS] Fetching fresh TRX price...');
      
      // Получаем цену с CoinGecko
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tron&vs_currencies=usd');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const price = data.tron?.usd || 0;

      // Обновляем кеш
      if (this.cache) {
        this.cache.trxPrice = price;
        this.cache.trxPriceUpdated = new Date().toISOString();
        await this.saveToCache(this.cache);
      }

      return price;
    } catch (error) {
      console.error('[CHAIN-PARAMS] Error fetching TRX price:', error);
      // Возвращаем последнюю известную цену
      if (this.cache && this.cache.trxPrice) {
        return this.cache.trxPrice;
      }
      return 0.146; // Fallback значение
    }
  }

  /**
   * Получает стоимость энергии в TRX и USD
   */
  async getEnergyCost() {
    try {
      const params = await this.getChainParameters();
      const energyFeeSun = params.getEnergyFee || 420;
      const trxPrice = await this.getTRXPrice();
      const energyPerTRX = await this.getEnergyPerTRX();
      
      // Стоимость 1 единицы энергии в TRX
      const energyCostTRX = energyFeeSun / 1_000_000;
      
      // Стоимость 1 единицы энергии в USD
      const energyCostUSD = energyCostTRX * trxPrice;
      
      return {
        energyFeeSun,
        energyCostTRX,
        energyCostUSD,
        trxPrice,
        energyPerTRX,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('[CHAIN-PARAMS] Error calculating energy cost:', error);
      // Возвращаем последние известные значения
      return {
        energyFeeSun: 420,
        energyCostTRX: 0.00042,
        energyCostUSD: 0.00006132,
        trxPrice: 0.146,
        energyPerTRX: 2380,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Получает расход энергии для USDT трансфера
   */
  async getUSDTTransferEnergy(toAddress, isNewAddress = null) {
    try {
      // Если не указано, проверяем адрес
      if (isNewAddress === null) {
        try {
          const account = await this.tronWeb.trx.getAccount(toAddress);
          isNewAddress = !account || !account.address;
        } catch {
          isNewAddress = true; // Считаем новым в случае ошибки
        }
      }

      // Реальные значения из тестов netts.io
      const energy = isNewAddress ? 130285 : 64285;
      
      return {
        energy,
        isNewAddress,
        description: isNewAddress 
          ? 'Первая отправка USDT на этот адрес (увеличенный расход)'
          : 'Стандартная отправка USDT'
      };
    } catch (error) {
      console.error('[CHAIN-PARAMS] Error getting USDT transfer energy:', error);
      return {
        energy: 65000,
        isNewAddress: false,
        description: 'Среднее значение (ошибка при определении)'
      };
    }
  }

  /**
   * Получает полную информацию для расчета стоимости транзакции
   */
  async getTransactionCostInfo(contractAddress, functionName, parameters = []) {
    try {
      const energyCost = await this.getEnergyCost();
      let energyRequired = 0;
      let description = '';

      // Специальная обработка для USDT
      if (contractAddress === 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' && functionName === 'transfer') {
        const toAddress = parameters[0];
        const usdtInfo = await this.getUSDTTransferEnergy(toAddress);
        energyRequired = usdtInfo.energy;
        description = usdtInfo.description;
      } else {
        // Для других контрактов используем оценку
        energyRequired = 50000; // Среднее значение
        description = 'Оценочное значение для смарт-контракта';
      }

      const costInTRX = (energyRequired * energyCost.energyFeeSun) / 1_000_000;
      const costInUSD = costInTRX * energyCost.trxPrice;

      return {
        energyRequired,
        energyCost: energyCost.energyCostTRX,
        energyCostUSD: energyCost.energyCostUSD,
        totalCostTRX: costInTRX,
        totalCostUSD: costInUSD,
        trxPrice: energyCost.trxPrice,
        energyPerTRX: energyCost.energyPerTRX,
        description,
        timestamp: energyCost.timestamp
      };
    } catch (error) {
      console.error('[CHAIN-PARAMS] Error getting transaction cost info:', error);
      throw error;
    }
  }

  /**
   * Проверяет валидность кеша
   */
  async isCacheValid() {
    try {
      if (!this.cache) {
        const data = await fs.readFile(this.cacheFile, 'utf8');
        this.cache = JSON.parse(data);
      }

      const cacheAge = Date.now() - new Date(this.cache.timestamp).getTime();
      return cacheAge < this.cacheExpiry;
    } catch {
      return false;
    }
  }

  /**
   * Сохраняет данные в кеш
   */
  async saveToCache(data) {
    try {
      this.cache = {
        ...data,
        timestamp: new Date().toISOString()
      };

      // Создаем директорию если не существует
      const cacheDir = path.dirname(this.cacheFile);
      await fs.mkdir(cacheDir, { recursive: true });

      await fs.writeFile(this.cacheFile, JSON.stringify(this.cache, null, 2));
    } catch (error) {
      console.error('[CHAIN-PARAMS] Error saving cache:', error);
    }
  }

  /**
   * Форматирует результат для пользователя
   */
  formatCostResult(costInfo, amount = 1, tokenName = 'USDT') {
    return `📊 **Расчет стоимости транзакции**

💰 **Операция:** Отправка ${amount} ${tokenName}
⚡ **Требуется энергии:** ${costInfo.energyRequired.toLocaleString()}
📝 **Тип операции:** ${costInfo.description}

💵 **Стоимость энергии:**
• 1 единица = ${costInfo.energyCost.toFixed(6)} TRX (${costInfo.energyCostUSD.toFixed(6)} USD)
• 1 TRX = ${costInfo.energyPerTRX.toFixed(0)} энергии

💸 **Общая стоимость:**
• В TRX: ${costInfo.totalCostTRX.toFixed(6)} TRX
• В USD: $${costInfo.totalCostUSD.toFixed(4)}

📈 **Курс TRX:** $${costInfo.trxPrice.toFixed(6)}
🕐 **Обновлено:** ${new Date(costInfo.timestamp).toLocaleString()}

⚠️ **Примечание:** Если у вас нет энергии, транзакция сожжет указанное количество TRX`;
  }
}

export default ChainParametersMonitor;
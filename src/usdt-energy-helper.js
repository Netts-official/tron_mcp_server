/**
 * USDT Energy Helper
 * Точный расчет энергии для USDT переводов на основе production данных netts.io
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class USDTEnergyHelper {
  constructor() {
    // Загружаем реальные данные из knowledge base
    const knowledgePath = path.join(__dirname, 'knowledge/usdt-energy-facts.json');
    try {
      const data = fs.readFileSync(knowledgePath, 'utf8');
      this.energyFacts = JSON.parse(data).usdt_transfer_energy;
    } catch (error) {
      console.error('Failed to load USDT energy facts:', error);
      // Fallback значения на основе тестов
      this.energyFacts = {
        energy_costs: {
          to_address_with_usdt: { energy: 64285 },
          to_address_without_usdt: { energy: 130285 }
        },
        cost_in_trx: {
          energy_price_sun: 420
        }
      };
    }
  }

  /**
   * Проверяет, есть ли USDT на адресе
   * @param {TronWeb} tronWeb - экземпляр TronWeb
   * @param {string} address - адрес для проверки
   * @returns {Promise<boolean>} true если есть USDT
   */
  async hasUSDT(tronWeb, address) {
    try {
      const contract = await tronWeb.contract().at('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
      const balance = await contract.balanceOf(address).call();
      return balance > 0;
    } catch (error) {
      console.error('Error checking USDT balance:', error);
      return false;
    }
  }

  /**
   * Получает точную оценку энергии для USDT перевода
   * @param {TronWeb} tronWeb - экземпляр TronWeb
   * @param {string} toAddress - адрес получателя
   * @param {number} amount - сумма USDT
   * @returns {Promise<Object>} детальная информация об энергии
   */
  async getUSDTTransferEnergy(tronWeb, toAddress, amount = 0.001) {
    try {
      // Проверяем, есть ли USDT на адресе получателя
      const hasUSDT = await this.hasUSDT(tronWeb, toAddress);
      
      // Выбираем правильное значение энергии
      const energyData = hasUSDT 
        ? this.energyFacts.energy_costs.to_address_with_usdt
        : this.energyFacts.energy_costs.to_address_without_usdt;
      
      const energyRequired = energyData.energy;
      const energyPriceSun = this.energyFacts.cost_in_trx.energy_price_sun;
      const costInTRX = (energyRequired * energyPriceSun) / 1_000_000;
      
      return {
        success: true,
        contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        tokenName: 'USDT',
        amount: amount,
        toAddress: toAddress,
        addressHasUSDT: hasUSDT,
        energyRequired: energyRequired,
        energyPriceSun: energyPriceSun,
        costInTRX: costInTRX,
        costInSUN: energyRequired * energyPriceSun,
        description: hasUSDT 
          ? `Отправка ${amount} USDT на адрес с существующим балансом USDT`
          : `Отправка ${amount} USDT на новый адрес (первая отправка USDT)`,
        note: hasUSDT
          ? 'Стандартная стоимость для адреса с USDT'
          : 'Увеличенная стоимость т.к. это первая отправка USDT на этот адрес',
        source: 'netts.io production data',
        lastVerified: this.energyFacts.last_verified
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        fallbackEnergy: 65000, // Среднее значение для безопасности
        note: 'Используется среднее значение из-за ошибки'
      };
    }
  }

  /**
   * Форматирует результат для пользователя
   * @param {Object} energyInfo - результат от getUSDTTransferEnergy
   * @returns {string} отформатированный текст
   */
  formatEnergyResult(energyInfo) {
    if (!energyInfo.success) {
      return `❌ Ошибка расчета: ${energyInfo.error}\nИспользуется примерное значение: ${energyInfo.fallbackEnergy} энергии`;
    }

    return `📊 **Расчет энергии для отправки USDT**

💰 **Сумма:** ${energyInfo.amount} USDT
📍 **Адрес получателя:** ${energyInfo.toAddress}
${energyInfo.addressHasUSDT ? '✅' : '⚠️'} **Статус адреса:** ${energyInfo.addressHasUSDT ? 'Есть USDT' : 'Нет USDT (первая отправка)'}

⚡ **Требуется энергии:** ${energyInfo.energyRequired.toLocaleString()}
💵 **Стоимость в TRX:** ${energyInfo.costInTRX.toFixed(6)} TRX
💸 **Стоимость в SUN:** ${energyInfo.costInSUN.toLocaleString()} SUN

📝 **Примечание:** ${energyInfo.note}

🔍 **Источник данных:** ${energyInfo.source}
📅 **Последняя проверка:** ${energyInfo.lastVerified}`;
  }
}

export default USDTEnergyHelper;
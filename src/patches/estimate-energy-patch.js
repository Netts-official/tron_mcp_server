/**
 * Патч для улучшения estimateEnergy функции
 * Добавляет поддержку точного расчета для USDT
 */

// Импортируем в начало файла (после других импортов):
// import { USDTEnergyHelper } from './usdt-energy-helper.js';

// Создаем экземпляр helper в конструкторе класса:
// this.usdtHelper = new USDTEnergyHelper();

// Заменяем функцию estimateEnergy на эту улучшенную версию:
async estimateEnergy({ contractAddress, functionName, parameters = [] }) {
  try {
    // Специальная обработка для USDT контракта
    if (contractAddress === 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' && functionName === 'transfer') {
      console.error('[TRON-MCP] Using USDT Energy Helper for accurate calculation');
      
      // Получаем адрес получателя и сумму из параметров
      const toAddress = parameters[0];
      const amount = parameters[1] ? parameters[1] / 1_000_000 : 0.001; // USDT имеет 6 decimals
      
      // Используем helper для точного расчета
      const energyInfo = await this.usdtHelper.getUSDTTransferEnergy(
        this.tronWeb,
        toAddress,
        amount
      );
      
      return {
        content: [
          {
            type: 'text',
            text: this.usdtHelper.formatEnergyResult(energyInfo),
          },
        ],
      };
    }
    
    // Для других контрактов используем стандартный метод
    const contract = await this.tronWeb.contract().at(contractAddress);
    const energy = await this.tronWeb.transactionBuilder.estimateEnergy(
      contract[functionName](...parameters),
      this.tronWeb.defaultAddress.base58,
      {
        feeLimit: 100000000,
      }
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            estimatedEnergy: energy,
            contractAddress,
            functionName,
            parameters,
            note: 'Для USDT используйте точные значения: 64,285 для адреса с USDT, 130,285 для нового адреса'
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    // Если ошибка связана с адресом, даем более понятное сообщение
    if (error.message.includes('Invalid address')) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Неверный формат адреса. Используйте base58 адрес начинающийся с T'
      );
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to estimate energy: ${error.message}`
    );
  }
}
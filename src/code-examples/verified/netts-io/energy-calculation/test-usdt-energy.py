#!/usr/bin/env python3
"""
Тестовый скрипт для расчета энергии при отправке USDT
Использует реальные адреса для точного тестирования
"""
import asyncio
import aiohttp
import base58
from decimal import Decimal

# Настройки
USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
TRON_NODE_URL = "https://api.trongrid.io"  # Или локальная нода

# Тестовые адреса
FROM_ADDRESS = "TTi1GbniVgqxoz5EaWTsr9T3DgAyVpsJnH"  # Адрес отправителя
TO_ADDRESS_WITH_USDT = "TSLbRevWFn3hktZmfDrzRbDLfEA6RQjNwK"  # Адрес с USDT
TO_ADDRESS_WITHOUT_USDT = "TF4RsPpv6yz2MU4EUZwoHND3p4S3kR3PWd"  # Адрес без USDT
TEST_AMOUNT = 0.001  # Сумма для теста

async def check_if_address_has_usdt(session, address, contract):
    """Проверяет, есть ли USDT на адресе"""
    try:
        url = f"{TRON_NODE_URL}/wallet/triggerconstantcontract"
        
        # Подготовка для вызова balanceOf
        address_bytes = base58.b58decode_check(address)
        address_hex = address_bytes[1:21].hex()
        parameter = address_hex.rjust(64, '0')
        
        payload = {
            "owner_address": address,
            "contract_address": contract,
            "function_selector": "balanceOf(address)",
            "parameter": parameter,
            "visible": True
        }
        
        async with session.post(url, json=payload) as resp:
            if resp.status == 200:
                data = await resp.json()
                if data.get("result", {}).get("result"):
                    balance_hex = data["constant_result"][0]
                    balance = int(balance_hex, 16) / 1000000  # USDT имеет 6 decimals
                    return balance > 0
        return False
    except:
        return False

async def estimate_transfer_energy(session, from_addr, to_addr, amount):
    """Оценивает энергию для перевода USDT"""
    try:
        # Конвертируем адрес получателя
        to_address_bytes = base58.b58decode_check(to_addr)
        to_address_hex = to_address_bytes[1:21].hex()
        
        # Конвертируем сумму (USDT = 6 decimals)
        amount_units = int(amount * 1_000_000)
        
        # Формируем параметры
        address_param = to_address_hex.rjust(64, '0')
        amount_param = hex(amount_units)[2:].rjust(64, '0')
        parameter_hex = address_param + amount_param
        
        # Делаем запрос
        url = f"{TRON_NODE_URL}/wallet/triggerconstantcontract"
        payload = {
            "owner_address": from_addr,
            "contract_address": USDT_CONTRACT,
            "function_selector": "transfer(address,uint256)",
            "parameter": parameter_hex,
            "visible": True
        }
        
        async with session.post(url, json=payload) as resp:
            if resp.status == 200:
                data = await resp.json()
                energy_used = data.get("energy_used", 0)
                return energy_used
    except Exception as e:
        print(f"Ошибка: {e}")
        return 0

async def main():
    """Главная функция для тестирования"""
    async with aiohttp.ClientSession() as session:
        print("="*70)
        print("ТЕСТИРОВАНИЕ РАСЧЕТА ЭНЕРГИИ ДЛЯ ОТПРАВКИ USDT")
        print("="*70)
        print(f"Отправитель: {FROM_ADDRESS}")
        print(f"Сумма: {TEST_AMOUNT} USDT")
        print("-"*70)
        
        # Тест 1: Отправка на адрес с USDT
        has_usdt = await check_if_address_has_usdt(session, TO_ADDRESS_WITH_USDT, USDT_CONTRACT)
        energy1 = await estimate_transfer_energy(session, FROM_ADDRESS, TO_ADDRESS_WITH_USDT, TEST_AMOUNT)
        
        print(f"\n1. Отправка на адрес С USDT: {TO_ADDRESS_WITH_USDT}")
        print(f"   Есть USDT на адресе: {'Да' if has_usdt else 'Нет'}")
        print(f"   Требуется энергии: {energy1:,}")
        
        # Тест 2: Отправка на адрес без USDT
        has_usdt2 = await check_if_address_has_usdt(session, TO_ADDRESS_WITHOUT_USDT, USDT_CONTRACT)
        energy2 = await estimate_transfer_energy(session, FROM_ADDRESS, TO_ADDRESS_WITHOUT_USDT, TEST_AMOUNT)
        
        print(f"\n2. Отправка на адрес БЕЗ USDT: {TO_ADDRESS_WITHOUT_USDT}")
        print(f"   Есть USDT на адресе: {'Да' if has_usdt2 else 'Нет'}")
        print(f"   Требуется энергии: {energy2:,}")
        
        # Сравнение
        print("\n" + "-"*70)
        print("РЕЗУЛЬТАТЫ:")
        print(f"Энергия для адреса с USDT: {energy1:,}")
        print(f"Энергия для адреса без USDT: {energy2:,}")
        print(f"Разница: {energy2 - energy1:,} энергии")
        print(f"Во сколько раз больше: {energy2/energy1:.2f}x" if energy1 > 0 else "")
        
        # Расчет стоимости в TRX (при стоимости ~420 SUN за единицу энергии)
        energy_fee_sun = 420
        cost_with_usdt = (energy1 * energy_fee_sun) / 1_000_000
        cost_without_usdt = (energy2 * energy_fee_sun) / 1_000_000
        
        print(f"\nСтоимость в TRX (при {energy_fee_sun} SUN за энергию):")
        print(f"Адрес с USDT: {cost_with_usdt:.6f} TRX")
        print(f"Адрес без USDT: {cost_without_usdt:.6f} TRX")
        print("="*70)

if __name__ == "__main__":
    asyncio.run(main())
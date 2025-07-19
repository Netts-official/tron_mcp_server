import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TronGridAPIParser {
  constructor() {
    this.baseUrl = 'https://developers.tron.network';
    this.apiReferenceUrl = `${this.baseUrl}/reference`;
    this.cacheDir = path.join(__dirname, '..', 'cache', 'trongrid');
    this.ensureCacheDir();
  }

  async ensureCacheDir() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create cache directory:', error);
    }
  }

  /**
   * Получает актуальную информацию о методе API из документации
   * @param {string} methodPath - Путь к методу (например, '/wallet/getcontract')
   * @returns {Object} Полная информация о методе
   */
  async getMethodDocumentation(methodPath) {
    try {
      const cacheFile = path.join(this.cacheDir, `${methodPath.replace(/\//g, '_')}.json`);
      
      // Проверяем кеш (6 часов TTL)
      try {
        const stats = await fs.stat(cacheFile);
        const age = Date.now() - stats.mtimeMs;
        if (age < 21600000) { // 6 hours
          const cached = await fs.readFile(cacheFile, 'utf8');
          return JSON.parse(cached);
        }
      } catch (error) {
        // Cache miss, continue
      }

      // Формируем URL для конкретного метода
      const methodUrl = `${this.apiReferenceUrl}${methodPath}`;
      
      // Используем puppeteer или playwright для динамического контента
      // Для примера используем axios + cheerio (может потребоваться puppeteer для SPA)
      const response = await axios.get(methodUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MCP-TRON-Server)',
          'Accept': 'text/html,application/xhtml+xml'
        }
      });

      const $ = cheerio.load(response.data);
      
      // Парсим структуру документации TronGrid
      const methodInfo = {
        path: methodPath,
        url: methodUrl,
        lastUpdated: new Date().toISOString(),
        method: this.extractMethod($),
        endpoint: this.extractEndpoint($),
        description: this.extractDescription($),
        parameters: this.extractParameters($),
        requestBody: this.extractRequestBody($),
        response: this.extractResponse($),
        examples: this.extractExamples($),
        errors: this.extractErrors($),
        notes: this.extractNotes($)
      };

      // Сохраняем в кеш
      await fs.writeFile(cacheFile, JSON.stringify(methodInfo, null, 2));
      
      return methodInfo;
    } catch (error) {
      throw new Error(`Failed to fetch documentation for ${methodPath}: ${error.message}`);
    }
  }

  extractMethod($) {
    // Ищем HTTP метод (POST, GET и т.д.)
    const methodElement = $('[data-testid="method-badge"], .method-badge, .http-method').first();
    return methodElement.text().trim() || 'POST';
  }

  extractEndpoint($) {
    // Извлекаем endpoint URL
    const endpointElement = $('[data-testid="endpoint-url"], .endpoint-url, code:contains("https://api")').first();
    return endpointElement.text().trim();
  }

  extractDescription($) {
    // Извлекаем описание метода
    const descElement = $('.method-description, .description, p:first').first();
    return descElement.text().trim();
  }

  extractParameters($) {
    const parameters = {};
    
    // Ищем таблицу с параметрами
    $('.parameters-table tr, .param-row, [data-testid="parameter-row"]').each((i, elem) => {
      const $row = $(elem);
      const name = $row.find('.param-name, td:first').text().trim();
      
      if (name && name !== 'Parameter' && name !== 'Name') {
        parameters[name] = {
          type: $row.find('.param-type, td:nth-child(2)').text().trim(),
          required: $row.find('.param-required, td:nth-child(3)').text().includes('required'),
          description: $row.find('.param-description, td:nth-child(4)').text().trim(),
          default: $row.find('.param-default, td:nth-child(5)').text().trim() || undefined
        };
      }
    });

    return parameters;
  }

  extractRequestBody($) {
    const requestBody = {};
    
    // Ищем секцию с телом запроса
    const bodySection = $('.request-body-section, [data-testid="request-body"], .body-params').first();
    
    if (bodySection.length) {
      // Парсим JSON Schema если есть
      const schemaCode = bodySection.find('code:contains("{"), pre:contains("{")').first();
      if (schemaCode.length) {
        try {
          const schemaText = schemaCode.text();
          const schema = JSON.parse(schemaText);
          return schema;
        } catch (e) {
          // Если не удалось распарсить, парсим как параметры
        }
      }

      // Альтернативный парсинг параметров тела запроса
      bodySection.find('.body-param, .parameter').each((i, elem) => {
        const $param = $(elem);
        const name = $param.find('.param-name').text().trim();
        
        if (name) {
          requestBody[name] = {
            type: $param.find('.param-type').text().trim(),
            required: $param.find('.required-badge').length > 0,
            description: $param.find('.param-desc').text().trim()
          };
        }
      });
    }

    return requestBody;
  }

  extractResponse($) {
    const responseStructure = {};
    
    // Ищем секцию с ответом
    const responseSection = $('.response-section, [data-testid="response"], .response-body').first();
    
    if (responseSection.length) {
      // Пытаемся найти пример ответа
      const responseExample = responseSection.find('code:contains("{"), pre:contains("{")').first();
      if (responseExample.length) {
        try {
          const exampleText = responseExample.text();
          const example = JSON.parse(exampleText);
          
          // Анализируем структуру примера для создания схемы
          responseStructure.example = example;
          responseStructure.fields = this.analyzeJsonStructure(example);
        } catch (e) {
          responseStructure.raw = responseExample.text();
        }
      }

      // Ищем описания полей ответа
      responseSection.find('.response-field, .field-description').each((i, elem) => {
        const $field = $(elem);
        const fieldName = $field.find('.field-name').text().trim();
        
        if (fieldName) {
          if (!responseStructure.fields) responseStructure.fields = {};
          responseStructure.fields[fieldName] = {
            type: $field.find('.field-type').text().trim(),
            description: $field.find('.field-desc').text().trim()
          };
        }
      });
    }

    return responseStructure;
  }

  extractExamples($) {
    const examples = [];
    
    // Ищем примеры кода
    $('.code-example, .example-section, [data-testid="code-example"]').each((i, elem) => {
      const $example = $(elem);
      const language = $example.find('.language-label, .code-language').text().trim() || 
                      $example.attr('data-language') || 'javascript';
      
      const code = $example.find('code, pre').text().trim();
      
      if (code) {
        examples.push({
          language,
          code,
          title: $example.find('.example-title').text().trim()
        });
      }
    });

    return examples;
  }

  extractErrors($) {
    const errors = [];
    
    // Ищем секцию с ошибками
    $('.errors-section, .error-codes, [data-testid="errors"]').find('.error-item, tr').each((i, elem) => {
      const $error = $(elem);
      const code = $error.find('.error-code, td:first').text().trim();
      const description = $error.find('.error-description, td:nth-child(2)').text().trim();
      
      if (code && description) {
        errors.push({ code, description });
      }
    });

    return errors;
  }

  extractNotes($) {
    const notes = [];
    
    // Ищем важные заметки
    $('.note, .warning, .important, [role="alert"]').each((i, elem) => {
      const noteText = $(elem).text().trim();
      if (noteText) {
        notes.push(noteText);
      }
    });

    return notes;
  }

  analyzeJsonStructure(obj, prefix = '') {
    const structure = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (value === null) {
        structure[fullKey] = { type: 'null' };
      } else if (Array.isArray(value)) {
        structure[fullKey] = { type: 'array' };
        if (value.length > 0) {
          structure[fullKey].items = this.analyzeJsonStructure(value[0], `${fullKey}[0]`);
        }
      } else if (typeof value === 'object') {
        structure[fullKey] = { type: 'object' };
        Object.assign(structure, this.analyzeJsonStructure(value, fullKey));
      } else {
        structure[fullKey] = { type: typeof value, example: value };
      }
    }
    
    return structure;
  }

  /**
   * Получает список всех доступных методов API
   */
  async getAllMethods() {
    try {
      const cacheFile = path.join(this.cacheDir, '_all_methods.json');
      
      // Проверяем кеш (24 часа TTL)
      try {
        const stats = await fs.stat(cacheFile);
        const age = Date.now() - stats.mtimeMs;
        if (age < 86400000) {
          const cached = await fs.readFile(cacheFile, 'utf8');
          return JSON.parse(cached);
        }
      } catch (error) {
        // Cache miss
      }

      // Загружаем страницу со списком всех методов
      const response = await axios.get(this.apiReferenceUrl);
      const $ = cheerio.load(response.data);
      
      const methods = [];
      
      // Парсим список методов
      $('.api-method-item, .method-link, [data-testid="api-method"]').each((i, elem) => {
        const $method = $(elem);
        const href = $method.attr('href') || $method.find('a').attr('href');
        const title = $method.text().trim();
        
        if (href && href.startsWith('/')) {
          methods.push({
            path: href.replace('/reference', ''),
            title,
            category: this.extractCategory($method)
          });
        }
      });

      // Сохраняем в кеш
      await fs.writeFile(cacheFile, JSON.stringify(methods, null, 2));
      
      return methods;
    } catch (error) {
      throw new Error(`Failed to fetch methods list: ${error.message}`);
    }
  }

  extractCategory($element) {
    // Пытаемся найти категорию метода
    const categoryElement = $element.closest('.category-section, .api-category')
                                   .find('.category-title, h2, h3').first();
    return categoryElement.text().trim() || 'Other';
  }

  /**
   * Обновляет кеш для всех методов
   */
  async updateAllCache() {
    const methods = await this.getAllMethods();
    const updates = [];

    for (const method of methods) {
      try {
        await this.getMethodDocumentation(method.path);
        updates.push({ path: method.path, status: 'success' });
      } catch (error) {
        updates.push({ path: method.path, status: 'error', error: error.message });
      }
      
      // Задержка между запросами чтобы не перегружать сервер
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return updates;
  }

  /**
   * Поиск методов по ключевым словам
   */
  async searchMethods(query) {
    const methods = await this.getAllMethods();
    const queryLower = query.toLowerCase();
    
    return methods.filter(method => 
      method.title.toLowerCase().includes(queryLower) ||
      method.path.toLowerCase().includes(queryLower) ||
      method.category.toLowerCase().includes(queryLower)
    );
  }
}
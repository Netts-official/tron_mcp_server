import { TronGridAPIParser } from '../parsers/trongrid-api.js';
import { CacheManager } from '../cache/cache-manager.js';
import { CodeExamplesManager } from '../../code-examples/manager.js';

export class UnifiedDocumentationAPI {
  constructor() {
    this.tronGridParser = new TronGridAPIParser();
    this.cacheManager = new CacheManager();
    this.examplesManager = new CodeExamplesManager();
  }

  /**
   * Получает полную документацию для API метода с примерами
   */
  async getAPIMethodDocs(methodPath, options = {}) {
    const {
      includeExamples = true,
      exampleLanguage = 'javascript',
      useCache = true
    } = options;

    try {
      // Получаем документацию метода
      const documentation = await this.tronGridParser.getMethodDocumentation(methodPath);

      // Получаем проверенные примеры
      let verifiedExamples = [];
      if (includeExamples) {
        verifiedExamples = await this.examplesManager.getExamplesForAPIMethod(methodPath);
      }

      // Ищем связанные паттерны и лучшие практики
      const relatedPatterns = await this.getRelatedPatterns(methodPath);

      return {
        documentation,
        verifiedExamples,
        relatedPatterns,
        lastUpdated: documentation.lastUpdated,
        source: 'trongrid-api'
      };
    } catch (error) {
      throw new Error(`Failed to get API documentation for ${methodPath}: ${error.message}`);
    }
  }

  /**
   * Получает только поля и параметры метода API
   */
  async getMethodFields(methodPath) {
    try {
      const documentation = await this.tronGridParser.getMethodDocumentation(methodPath);
      
      return {
        method: documentation.method,
        endpoint: documentation.endpoint,
        parameters: documentation.parameters,
        requestBody: documentation.requestBody,
        response: documentation.response,
        lastUpdated: documentation.lastUpdated
      };
    } catch (error) {
      throw new Error(`Failed to get method fields for ${methodPath}: ${error.message}`);
    }
  }

  /**
   * Расширенный поиск по всей документации
   */
  async searchDocumentation(query, options = {}) {
    const {
      source = 'all',
      includeExamples = true,
      exactMatch = false,
      limit = 10
    } = options;

    const results = {
      query,
      totalResults: 0,
      documentation: [],
      examples: [],
      suggestions: []
    };

    try {
      // Поиск в документации API
      if (source === 'all' || source === 'trongrid') {
        const apiMethods = await this.tronGridParser.searchMethods(query);
        results.documentation = apiMethods.slice(0, limit);
        results.totalResults += apiMethods.length;
      }

      // Поиск в примерах кода
      if (includeExamples) {
        const examples = await this.examplesManager.findExamples({
          query,
          limit: limit
        });
        results.examples = examples;
      }

      // Добавляем контекстные предложения
      results.suggestions = await this.generateSuggestions(query);

      return results;
    } catch (error) {
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Получает пример кода с контекстом документации
   */
  async getExampleWithContext(exampleId, options = {}) {
    const {
      includeRelatedDocs = true,
      language = 'javascript'
    } = options;

    try {
      const example = await this.examplesManager.getExampleWithCode(exampleId, language);
      
      let relatedDocs = [];
      if (includeRelatedDocs && example.relatedDocs.length > 0) {
        // Получаем связанную документацию
        for (const docUrl of example.relatedDocs) {
          const methodPath = this.extractMethodPathFromUrl(docUrl);
          if (methodPath) {
            const doc = await this.getAPIMethodDocs(methodPath, { includeExamples: false });
            relatedDocs.push(doc);
          }
        }
      }

      return {
        example,
        relatedDocs,
        context: {
          lastTested: example.lastTested,
          verified: example.verified,
          compatibility: this.getCompatibilityInfo(example)
        }
      };
    } catch (error) {
      throw new Error(`Failed to get example with context: ${error.message}`);
    }
  }

  /**
   * Добавляет новый проверенный пример
   */
  async addVerifiedExample(exampleData) {
    // Валидируем данные
    const validation = await this.examplesManager.validateExample(exampleData);
    if (!validation.valid) {
      throw new Error(`Invalid example data: ${validation.issues.join(', ')}`);
    }

    // Добавляем пример
    const example = await this.examplesManager.addExample(exampleData);
    
    // Обновляем связи с документацией
    await this.updateDocumentationLinks(example);

    return example;
  }

  /**
   * Обновляет кеш документации
   */
  async updateDocumentationCache(source = 'all') {
    const updates = {
      trongrid: null,
      examples: null,
      timestamp: new Date().toISOString()
    };

    try {
      if (source === 'all' || source === 'trongrid') {
        updates.trongrid = await this.tronGridParser.updateAllCache();
      }

      if (source === 'all' || source === 'examples') {
        // Обновляем индекс примеров
        await this.examplesManager.ensureStructure();
        updates.examples = 'Index updated';
      }

      // Очищаем устаревший кеш
      await this.cacheManager.cleanup();

      return updates;
    } catch (error) {
      throw new Error(`Failed to update documentation cache: ${error.message}`);
    }
  }

  /**
   * Получает статус документации
   */
  async getDocumentationStatus() {
    try {
      const cacheStats = await this.cacheManager.getStats();
      const examplesIndex = await this.examplesManager.loadIndex();
      
      return {
        cache: cacheStats,
        examples: {
          total: Object.keys(examplesIndex).length,
          byCategory: this.groupExamplesByCategory(examplesIndex)
        },
        lastUpdate: new Date().toISOString(),
        health: 'healthy'
      };
    } catch (error) {
      return {
        cache: null,
        examples: null,
        lastUpdate: new Date().toISOString(),
        health: 'error',
        error: error.message
      };
    }
  }

  /**
   * Получает рекомендации по использованию API
   */
  async getAPIRecommendations(methodPath) {
    try {
      const documentation = await this.getAPIMethodDocs(methodPath, { includeExamples: true });
      const recommendations = [];

      // Анализируем примеры использования
      if (documentation.verifiedExamples.length > 0) {
        recommendations.push({
          type: 'example',
          title: 'Проверенные примеры доступны',
          description: `Найдено ${documentation.verifiedExamples.length} проверенных примеров использования`
        });
      }

      // Анализируем частые ошибки
      if (documentation.documentation.errors.length > 0) {
        recommendations.push({
          type: 'warning',
          title: 'Частые ошибки',
          description: 'Обратите внимание на возможные ошибки в документации'
        });
      }

      // Анализируем производительность
      const performanceNotes = await this.getPerformanceNotes(methodPath);
      if (performanceNotes.length > 0) {
        recommendations.push({
          type: 'performance',
          title: 'Оптимизация производительности',
          description: performanceNotes.join('; ')
        });
      }

      return recommendations;
    } catch (error) {
      throw new Error(`Failed to get API recommendations: ${error.message}`);
    }
  }

  // Вспомогательные методы

  async getRelatedPatterns(methodPath) {
    // Поиск связанных паттернов и лучших практик
    const patterns = [];
    
    // Анализируем путь метода для определения категории
    if (methodPath.includes('/wallet/')) {
      patterns.push('Всегда проверяйте баланс перед выполнением транзакций');
    }
    
    if (methodPath.includes('/contract/')) {
      patterns.push('Устанавливайте адекватный fee limit для вызовов контрактов');
    }
    
    if (methodPath.includes('energy')) {
      patterns.push('Мониторьте потребление энергии для оптимизации затрат');
    }

    return patterns;
  }

  async generateSuggestions(query) {
    const suggestions = [];
    const queryLower = query.toLowerCase();

    // Контекстные предложения на основе запроса
    if (queryLower.includes('energy')) {
      suggestions.push('Рассмотрите использование делегирования энергии для снижения затрат');
    }

    if (queryLower.includes('contract')) {
      suggestions.push('Проверьте ABI контракта перед вызовом методов');
    }

    if (queryLower.includes('transaction')) {
      suggestions.push('Используйте правильный privateKey для подписи транзакций');
    }

    return suggestions;
  }

  extractMethodPathFromUrl(url) {
    const match = url.match(/\/reference(\/.+)$/);
    return match ? match[1] : null;
  }

  getCompatibilityInfo(example) {
    return {
      networks: example.testResults ? Object.keys(example.testResults) : [],
      lastTested: example.lastTested,
      dependencies: example.dependencies
    };
  }

  async updateDocumentationLinks(example) {
    // Обновляем связи между примерами и документацией
    // Эта функция может быть расширена для автоматического связывания
    return example;
  }

  groupExamplesByCategory(examplesIndex) {
    const groups = {};
    
    for (const example of Object.values(examplesIndex)) {
      if (!groups[example.category]) {
        groups[example.category] = 0;
      }
      groups[example.category]++;
    }
    
    return groups;
  }

  async getPerformanceNotes(methodPath) {
    const notes = [];
    
    // Анализ производительности на основе пути метода
    if (methodPath.includes('/wallet/getaccount')) {
      notes.push('Кешируйте информацию об аккаунте для часто используемых адресов');
    }
    
    if (methodPath.includes('/contract/')) {
      notes.push('Вызовы контрактов потребляют энергию, оптимизируйте частоту вызовов');
    }

    return notes;
  }
}
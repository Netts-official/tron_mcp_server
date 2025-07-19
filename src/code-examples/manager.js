import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class CodeExamplesManager {
  constructor() {
    this.examplesRoot = path.join(__dirname, 'verified');
    this.patternsFile = path.join(__dirname, 'patterns', 'patterns.json');
    this.indexFile = path.join(__dirname, 'index.json');
    this.ensureStructure();
  }

  async ensureStructure() {
    const dirs = [
      this.examplesRoot,
      path.join(this.examplesRoot, 'energy-rental'),
      path.join(this.examplesRoot, 'smart-contracts'),
      path.join(this.examplesRoot, 'transactions'),
      path.join(this.examplesRoot, 'trongrid-api'),
      path.join(this.examplesRoot, 'integrations'),
      path.join(__dirname, 'patterns'),
      path.join(__dirname, 'knowledge-base')
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true }).catch(() => {});
    }

    // Инициализируем индекс если его нет
    try {
      await fs.access(this.indexFile);
    } catch {
      await this.saveIndex({});
    }
  }

  /**
   * Добавляет новый проверенный пример кода
   */
  async addExample(exampleData) {
    const {
      title,
      description,
      category,
      tags = [],
      code,
      dependencies = {},
      relatedDocs = [],
      testResults = {},
      notes = [],
      errors = [],
      author = 'netts.io'
    } = exampleData;

    // Генерируем ID для примера
    const id = this.generateExampleId(title, category);
    
    // Подготавливаем данные примера
    const example = {
      id,
      title,
      description,
      category,
      tags,
      created: new Date().toISOString(),
      lastTested: new Date().toISOString(),
      author,
      dependencies,
      relatedDocs,
      code: this.normalizeCode(code),
      testResults,
      notes,
      errors,
      version: '1.0',
      verified: true
    };

    // Сохраняем файл примера
    const filePath = path.join(this.examplesRoot, category, `${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(example, null, 2));

    // Обновляем индекс
    await this.updateIndex(id, {
      title,
      category,
      tags,
      filePath,
      lastUpdated: Date.now()
    });

    return example;
  }

  /**
   * Получает пример по ID
   */
  async getExample(id) {
    const index = await this.loadIndex();
    const exampleMeta = index[id];
    
    if (!exampleMeta) {
      throw new Error(`Example with ID ${id} not found`);
    }

    try {
      const content = await fs.readFile(exampleMeta.filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load example ${id}: ${error.message}`);
    }
  }

  /**
   * Ищет примеры по критериям
   */
  async findExamples(criteria = {}) {
    const {
      category,
      tags = [],
      language,
      query,
      limit = 10
    } = criteria;

    const index = await this.loadIndex();
    const results = [];

    for (const [id, meta] of Object.entries(index)) {
      let matches = true;

      // Фильтр по категории
      if (category && meta.category !== category) {
        matches = false;
      }

      // Фильтр по тегам
      if (tags.length > 0) {
        const hasAllTags = tags.every(tag => meta.tags.includes(tag));
        if (!hasAllTags) {
          matches = false;
        }
      }

      // Фильтр по поисковому запросу
      if (query) {
        const queryLower = query.toLowerCase();
        const titleMatch = meta.title.toLowerCase().includes(queryLower);
        const tagMatch = meta.tags.some(tag => tag.toLowerCase().includes(queryLower));
        
        if (!titleMatch && !tagMatch) {
          matches = false;
        }
      }

      if (matches) {
        try {
          const example = await this.getExample(id);
          
          // Фильтр по языку программирования
          if (language && !example.code[language]) {
            continue;
          }

          results.push({
            id,
            title: example.title,
            description: example.description,
            category: example.category,
            tags: example.tags,
            languages: Object.keys(example.code),
            lastTested: example.lastTested,
            verified: example.verified
          });
        } catch (error) {
          console.error(`Failed to load example ${id}:`, error);
        }
      }

      if (results.length >= limit) {
        break;
      }
    }

    return results;
  }

  /**
   * Получает пример с кодом для конкретного языка
   */
  async getExampleWithCode(id, language = 'javascript') {
    const example = await this.getExample(id);
    
    if (!example.code[language]) {
      throw new Error(`Example ${id} doesn't have code for language ${language}`);
    }

    return {
      ...example,
      selectedCode: {
        language,
        code: example.code[language]
      }
    };
  }

  /**
   * Обновляет существующий пример
   */
  async updateExample(id, updates) {
    const example = await this.getExample(id);
    
    // Обновляем данные
    const updatedExample = {
      ...example,
      ...updates,
      lastUpdated: new Date().toISOString(),
      version: this.incrementVersion(example.version)
    };

    // Сохраняем обновленную версию
    const index = await this.loadIndex();
    const filePath = index[id].filePath;
    await fs.writeFile(filePath, JSON.stringify(updatedExample, null, 2));

    // Обновляем индекс
    await this.updateIndex(id, {
      ...index[id],
      lastUpdated: Date.now()
    });

    return updatedExample;
  }

  /**
   * Удаляет пример
   */
  async deleteExample(id) {
    const index = await this.loadIndex();
    const exampleMeta = index[id];
    
    if (!exampleMeta) {
      throw new Error(`Example with ID ${id} not found`);
    }

    // Удаляем файл
    await fs.unlink(exampleMeta.filePath);

    // Удаляем из индекса
    delete index[id];
    await this.saveIndex(index);

    return true;
  }

  /**
   * Валидирует пример кода
   */
  async validateExample(exampleData) {
    const issues = [];

    // Проверяем обязательные поля
    const requiredFields = ['title', 'description', 'category', 'code'];
    for (const field of requiredFields) {
      if (!exampleData[field]) {
        issues.push(`Missing required field: ${field}`);
      }
    }

    // Проверяем структуру кода
    if (exampleData.code) {
      if (typeof exampleData.code !== 'object') {
        issues.push('Code must be an object with language keys');
      } else {
        const languages = Object.keys(exampleData.code);
        if (languages.length === 0) {
          issues.push('At least one language code must be provided');
        }
        
        for (const lang of languages) {
          if (!exampleData.code[lang] || typeof exampleData.code[lang] !== 'string') {
            issues.push(`Code for language ${lang} must be a non-empty string`);
          }
        }
      }
    }

    // Проверяем теги
    if (exampleData.tags && !Array.isArray(exampleData.tags)) {
      issues.push('Tags must be an array');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Получает примеры для конкретного API метода
   */
  async getExamplesForAPIMethod(methodPath) {
    const examples = await this.findExamples({
      category: 'trongrid-api',
      tags: [methodPath.replace('/', '').replace('/', '_')]
    });

    return examples;
  }

  /**
   * Импортирует примеры из кода проекта netts.io
   */
  async importFromNettsProject(projectPath) {
    const importedExamples = [];

    try {
      // Ищем PHP файлы с примерами использования TRON API
      const phpFiles = await this.findPHPFiles(projectPath);
      
      for (const filePath of phpFiles) {
        const content = await fs.readFile(filePath, 'utf8');
        const examples = this.extractExamplesFromPHP(content, filePath);
        
        for (const example of examples) {
          const savedExample = await this.addExample({
            ...example,
            author: 'netts.io',
            tags: [...example.tags, 'imported', 'netts.io']
          });
          importedExamples.push(savedExample);
        }
      }
    } catch (error) {
      console.error('Failed to import examples:', error);
    }

    return importedExamples;
  }

  // Вспомогательные методы

  generateExampleId(title, category) {
    const base = `${category}-${title}`.toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    const hash = crypto.createHash('md5').update(base + Date.now()).digest('hex').substring(0, 8);
    return `${base}-${hash}`;
  }

  normalizeCode(code) {
    if (typeof code === 'string') {
      return { javascript: code };
    }
    return code;
  }

  incrementVersion(version) {
    const parts = version.split('.');
    const patch = parseInt(parts[2] || '0') + 1;
    return `${parts[0]}.${parts[1] || '0'}.${patch}`;
  }

  async loadIndex() {
    try {
      const content = await fs.readFile(this.indexFile, 'utf8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  async saveIndex(index) {
    await fs.writeFile(this.indexFile, JSON.stringify(index, null, 2));
  }

  async updateIndex(id, meta) {
    const index = await this.loadIndex();
    index[id] = {
      ...index[id],
      ...meta
    };
    await this.saveIndex(index);
  }

  async findPHPFiles(projectPath) {
    const phpFiles = [];
    
    async function scanDir(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          await scanDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.php')) {
          phpFiles.push(fullPath);
        }
      }
    }
    
    await scanDir(projectPath);
    return phpFiles;
  }

  extractExamplesFromPHP(content, filePath) {
    const examples = [];
    
    // Ищем комментарии с примерами
    const exampleRegex = /\/\*\*[\s\S]*?@example[\s\S]*?\*\//g;
    const matches = content.match(exampleRegex);
    
    if (matches) {
      for (const match of matches) {
        // Извлекаем информацию из комментария
        const titleMatch = match.match(/@title\s+(.+)/);
        const descMatch = match.match(/@description\s+(.+)/);
        const categoryMatch = match.match(/@category\s+(.+)/);
        
        if (titleMatch) {
          examples.push({
            title: titleMatch[1].trim(),
            description: descMatch ? descMatch[1].trim() : '',
            category: categoryMatch ? categoryMatch[1].trim() : 'general',
            tags: ['php', 'netts.io'],
            code: {
              php: this.extractCodeFromComment(match, content)
            },
            notes: [`Extracted from ${path.basename(filePath)}`]
          });
        }
      }
    }
    
    return examples;
  }

  extractCodeFromComment(comment, fullContent) {
    // Извлекаем код из комментария или следующей функции
    const codeMatch = comment.match(/```php\n([\s\S]*?)\n```/);
    if (codeMatch) {
      return codeMatch[1];
    }
    
    // Если нет кода в комментарии, ищем следующую функцию
    const commentIndex = fullContent.indexOf(comment);
    const afterComment = fullContent.substring(commentIndex + comment.length);
    const functionMatch = afterComment.match(/function\s+\w+[\s\S]*?(?=\n\s*function|\n\s*class|\n\s*\?>|$)/);
    
    return functionMatch ? functionMatch[0].trim() : '';
  }
}
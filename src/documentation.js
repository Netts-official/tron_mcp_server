import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TronDocumentation {
  constructor() {
    this.cacheDir = path.join(__dirname, '..', 'cache');
    this.ensureCacheDir();
    
    // Documentation sources
    this.sources = {
      javaTronReleases: 'https://api.github.com/repos/tronprotocol/java-tron/releases',
      javaTronRepo: 'https://api.github.com/repos/tronprotocol/java-tron',
      javaTronContents: 'https://api.github.com/repos/tronprotocol/java-tron/contents',
      javaTronRaw: 'https://raw.githubusercontent.com/tronprotocol/java-tron',
      devDocs: 'https://developers.tron.network/docs',
      tronWebDocs: 'https://tronweb.network/docu',
    };

    // Common documentation topics
    this.docTopics = {
      'getting-started': 'Getting Started with TRON development',
      'smart-contracts': 'Smart contract development and deployment',
      'trc20': 'TRC20 token standard implementation',
      'trc721': 'TRC721 NFT standard implementation',
      'energy': 'Energy and bandwidth management',
      'staking': 'Staking and resource delegation',
      'apis': 'TRON HTTP APIs documentation',
      'tronweb': 'TronWeb JavaScript library usage',
      'wallet': 'Wallet integration guide',
      'dapp': 'DApp development guide',
      'tvm': 'TRON Virtual Machine documentation',
      'consensus': 'DPoS consensus mechanism',
      'nodes': 'Running TRON nodes guide',
      'tools': 'Development tools and utilities',
    };
  }

  async ensureCacheDir() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create cache directory:', error);
    }
  }

  async getJavaTronReleases(limit = 10) {
    try {
      const cacheFile = path.join(this.cacheDir, 'java-tron-releases.json');
      
      // Check cache first (1 hour TTL)
      try {
        const stats = await fs.stat(cacheFile);
        const age = Date.now() - stats.mtimeMs;
        if (age < 3600000) {
          const cached = await fs.readFile(cacheFile, 'utf8');
          return JSON.parse(cached);
        }
      } catch (error) {
        // Cache miss, continue to fetch
      }

      // Fetch from GitHub API
      const response = await axios.get(this.sources.javaTronReleases, {
        params: { per_page: limit },
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'MCP-TRON-Server',
        },
      });

      const releases = response.data.map(release => ({
        version: release.tag_name,
        name: release.name,
        publishedAt: release.published_at,
        url: release.html_url,
        downloadUrl: release.assets.find(asset => 
          asset.name.includes('FullNode.jar')
        )?.browser_download_url,
        releaseNotes: release.body,
        isPrerelease: release.prerelease,
        assets: release.assets.map(asset => ({
          name: asset.name,
          size: asset.size,
          downloadUrl: asset.browser_download_url,
        })),
      }));

      // Cache the results
      await fs.writeFile(cacheFile, JSON.stringify(releases, null, 2));
      
      return releases;
    } catch (error) {
      throw new Error(`Failed to fetch java-tron releases: ${error.message}`);
    }
  }

  async searchDocumentation(query, topic = null) {
    try {
      const results = {
        query,
        topic,
        suggestions: [],
        resources: [],
        examples: [],
      };

      // Add topic-specific suggestions
      if (topic && this.docTopics[topic]) {
        results.topicDescription = this.docTopics[topic];
      }

      // Provide relevant documentation links based on query
      const queryLower = query.toLowerCase();

      // Smart contract related
      if (queryLower.includes('smart contract') || queryLower.includes('contract')) {
        results.resources.push({
          title: 'Smart Contract Development',
          url: 'https://developers.tron.network/docs/smart-contract-development',
          description: 'Complete guide to developing smart contracts on TRON',
        });
        results.examples.push({
          title: 'TRC20 Token Contract',
          code: `pragma solidity ^0.5.0;

contract TRC20Token {
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    
    uint256 private _totalSupply;
    string public name;
    string public symbol;
    uint8 public decimals;
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    
    constructor(string memory _name, string memory _symbol, uint8 _decimals, uint256 _supply) public {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        _totalSupply = _supply * 10**uint256(_decimals);
        _balances[msg.sender] = _totalSupply;
    }
}`,
        });
      }

      // Energy related
      if (queryLower.includes('energy') || queryLower.includes('bandwidth')) {
        results.resources.push({
          title: 'Resource Model',
          url: 'https://developers.tron.network/docs/resource-model',
          description: 'Understanding TRON energy and bandwidth system',
        });
        results.suggestions.push('Use freezeBalance to obtain energy for contract execution');
        results.suggestions.push('1 TRX = 1 bandwidth when frozen');
      }

      // TronWeb related
      if (queryLower.includes('tronweb') || queryLower.includes('javascript')) {
        results.resources.push({
          title: 'TronWeb Documentation',
          url: 'https://developers.tron.network/docs/tronweb-object',
          description: 'JavaScript library for TRON blockchain interaction',
        });
        results.examples.push({
          title: 'Initialize TronWeb',
          code: `const TronWeb = require('tronweb');

const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io',
    headers: { "TRON-PRO-API-KEY": 'your-api-key' },
    privateKey: 'your-private-key'
});`,
        });
      }

      // Node setup related
      if (queryLower.includes('node') || queryLower.includes('full node')) {
        results.resources.push({
          title: 'Deploy TRON Nodes',
          url: 'https://developers.tron.network/docs/deploy-tron-nodes',
          description: 'Guide to deploying FullNode and SolidityNode',
        });
        results.suggestions.push('Minimum requirements: 8 CPU, 16GB RAM, 500GB SSD');
        results.suggestions.push('Use official Docker images for easier deployment');
      }

      // API related
      if (queryLower.includes('api') || queryLower.includes('http')) {
        results.resources.push({
          title: 'HTTP API Documentation',
          url: 'https://developers.tron.network/reference/background',
          description: 'Complete HTTP API reference for TRON',
        });
        results.resources.push({
          title: 'TronGrid API',
          url: 'https://www.trongrid.io/docs/',
          description: 'Enhanced API service with historical data',
        });
      }

      // Add general resources if no specific matches
      if (results.resources.length === 0) {
        results.resources.push({
          title: 'TRON Developer Hub',
          url: 'https://developers.tron.network/docs/getting-start',
          description: 'Official TRON development documentation',
        });
        results.resources.push({
          title: 'TRON Whitepaper',
          url: 'https://tron.network/static/doc/white_paper_v_2_0.pdf',
          description: 'Technical whitepaper explaining TRON architecture',
        });
      }

      return results;
    } catch (error) {
      throw new Error(`Documentation search failed: ${error.message}`);
    }
  }

  async getQuickReference(topic) {
    const references = {
      'addresses': {
        title: 'TRON Address Format',
        content: `
- Base58 format starting with 'T' (mainnet)
- 34 characters long
- Example: TKyWtnzwBNiQ7aZc7drNjAULb65kDJSXeq
- Hex format: 41 prefix for mainnet`,
      },
      'units': {
        title: 'TRON Units',
        content: `
- 1 TRX = 1,000,000 SUN
- Energy: Consumed by smart contract execution
- Bandwidth: Consumed by transactions (1 byte = 1 bandwidth)
- 1 frozen TRX = 1 bandwidth or varies for energy`,
      },
      'fees': {
        title: 'TRON Fee Structure',
        content: `
- Bandwidth Points: 1,500 free daily
- Energy: No free allocation, must freeze TRX
- Fee Limit: Maximum TRX willing to pay for contract execution
- Burn Fee: 1,000 TRX for TRC10 token creation`,
      },
      'limits': {
        title: 'TRON System Limits',
        content: `
- Block Time: 3 seconds
- TPS: ~2,000 transactions per second
- Contract Size: Maximum 1MB
- Function Parameters: Maximum 256`,
      },
    };

    return references[topic] || {
      title: 'Topic Not Found',
      content: `Available topics: ${Object.keys(references).join(', ')}`,
    };
  }

  async getJavaTronReadme() {
    try {
      const cacheFile = path.join(this.cacheDir, 'java-tron-readme.md');
      
      // Check cache (24 hours TTL)
      try {
        const stats = await fs.stat(cacheFile);
        const age = Date.now() - stats.mtimeMs;
        if (age < 86400000) {
          const cached = await fs.readFile(cacheFile, 'utf8');
          return { content: cached, cached: true };
        }
      } catch (error) {
        // Cache miss
      }

      const response = await axios.get(`${this.sources.javaTronRaw}/master/README.md`);
      const content = response.data;
      
      // Cache the result
      await fs.writeFile(cacheFile, content);
      
      return { content, cached: false };
    } catch (error) {
      throw new Error(`Failed to fetch java-tron README: ${error.message}`);
    }
  }

  async getJavaTronFileContent(filePath) {
    try {
      const response = await axios.get(
        `${this.sources.javaTronContents}/${filePath}`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'MCP-TRON-Server',
          },
        }
      );

      if (response.data.type === 'file') {
        // Decode base64 content
        const content = Buffer.from(response.data.content, 'base64').toString('utf8');
        return {
          path: response.data.path,
          name: response.data.name,
          size: response.data.size,
          content,
          sha: response.data.sha,
          url: response.data.html_url,
        };
      } else {
        throw new Error('Path is not a file');
      }
    } catch (error) {
      throw new Error(`Failed to fetch file content: ${error.message}`);
    }
  }

  async searchJavaTronRepo(query, options = {}) {
    try {
      const { type = 'code', language = 'java', limit = 20 } = options;
      
      const searchQuery = `${query} repo:tronprotocol/java-tron`;
      const params = {
        q: searchQuery,
        per_page: limit,
      };

      if (language) {
        params.q += ` language:${language}`;
      }

      const response = await axios.get(
        `https://api.github.com/search/${type}`,
        {
          params,
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'MCP-TRON-Server',
          },
        }
      );

      return {
        total_count: response.data.total_count,
        items: response.data.items.map(item => ({
          name: item.name,
          path: item.path,
          url: item.html_url,
          repository: item.repository?.name,
          score: item.score,
          // For code search, include text matches
          text_matches: item.text_matches?.map(match => ({
            fragment: match.fragment,
            property: match.property,
          })),
        })),
      };
    } catch (error) {
      throw new Error(`Failed to search java-tron repository: ${error.message}`);
    }
  }

  async getProtocolBuffers() {
    try {
      const cacheFile = path.join(this.cacheDir, 'java-tron-protos.json');
      
      // Check cache (24 hours TTL)
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

      // Get list of proto files
      const response = await axios.get(
        `${this.sources.javaTronContents}/protocol/src/main/protos`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'MCP-TRON-Server',
          },
        }
      );

      const protoFiles = response.data
        .filter(file => file.name.endsWith('.proto'))
        .map(file => ({
          name: file.name,
          path: file.path,
          url: file.html_url,
        }));

      const result = {
        files: protoFiles,
        timestamp: Date.now(),
        info: 'Protocol Buffer definitions for TRON blockchain',
      };

      // Cache the result
      await fs.writeFile(cacheFile, JSON.stringify(result, null, 2));
      
      return result;
    } catch (error) {
      throw new Error(`Failed to fetch Protocol Buffers: ${error.message}`);
    }
  }

  async getJavaTronStructure() {
    try {
      const cacheFile = path.join(this.cacheDir, 'java-tron-structure.json');
      
      // Check cache (24 hours TTL)
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

      // Get main directories
      const mainDirs = [
        { path: 'actuator', description: 'Transaction executors and validators' },
        { path: 'framework', description: 'Core framework and modules' },
        { path: 'protocol', description: 'Protocol definitions and protobuf files' },
        { path: 'consensus', description: 'Consensus mechanism implementation' },
        { path: 'chainbase', description: 'Database and storage layer' },
        { path: 'common', description: 'Common utilities and helpers' },
        { path: 'crypto', description: 'Cryptographic functions' },
      ];

      const structure = {
        mainDirs,
        keyFiles: [
          { path: 'README.md', description: 'Project documentation' },
          { path: 'build.gradle', description: 'Build configuration' },
          { path: 'config.conf', description: 'Node configuration template' },
          { path: 'deploy.sh', description: 'Deployment script' },
        ],
        modules: [
          { name: 'actuator', description: 'Implements transaction processing logic' },
          { name: 'chainbase', description: 'Manages blockchain data storage' },
          { name: 'consensus', description: 'DPoS consensus implementation' },
          { name: 'crypto', description: 'Cryptographic operations' },
          { name: 'protocol', description: 'Protocol definitions' },
        ],
        timestamp: Date.now(),
      };

      // Cache the result
      await fs.writeFile(cacheFile, JSON.stringify(structure, null, 2));
      
      return structure;
    } catch (error) {
      throw new Error(`Failed to fetch java-tron structure: ${error.message}`);
    }
  }

  async getJavaTronCommits(limit = 10) {
    try {
      const response = await axios.get(
        `${this.sources.javaTronRepo}/commits`,
        {
          params: { per_page: limit },
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'MCP-TRON-Server',
          },
        }
      );

      return response.data.map(commit => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.commit.author.name,
        date: commit.commit.author.date,
        url: commit.html_url,
      }));
    } catch (error) {
      throw new Error(`Failed to fetch commits: ${error.message}`);
    }
  }

  async getJavaTronIssues(state = 'open', limit = 20) {
    try {
      const response = await axios.get(
        `${this.sources.javaTronRepo}/issues`,
        {
          params: { 
            state,
            per_page: limit,
            sort: 'updated',
            direction: 'desc',
          },
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'MCP-TRON-Server',
          },
        }
      );

      return response.data.map(issue => ({
        number: issue.number,
        title: issue.title,
        state: issue.state,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        url: issue.html_url,
        labels: issue.labels.map(label => label.name),
        author: issue.user.login,
      }));
    } catch (error) {
      throw new Error(`Failed to fetch issues: ${error.message}`);
    }
  }
}
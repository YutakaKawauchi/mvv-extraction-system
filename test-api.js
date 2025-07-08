#!/usr/bin/env node

/**
 * MVV抽出システム API統合テストスクリプト
 * 
 * Usage:
 *   node test-api.js local     # ローカル環境テスト
 *   node test-api.js prod      # プロダクション環境テスト
 *   node test-api.js both      # 両方の環境をテスト
 */

const readline = require('readline');

// 設定
const config = {
  local: {
    baseUrl: 'http://localhost:8888/.netlify/functions',
    name: 'ローカル環境'
  },
  prod: {
    baseUrl: 'https://comforting-sorbet-612b07.netlify.app/.netlify/functions',
    name: 'プロダクション環境'
  }
};

const API_KEY = 'mvv-extraction-2024-secure-key';

// テスト用企業データ
const testCompanies = [
  {
    id: 'test-cyberagent',
    name: 'サイバーエージェント',
    website: 'https://www.cyberagent.co.jp/',
    description: 'インターネット広告・ゲーム・メディア事業を展開するIT企業'
  },
  {
    id: 'test-m3',
    name: 'エムスリー株式会社',
    website: 'https://corporate.m3.com',
    description: '医療情報サービス'
  },
  {
    id: 'test-mercari',
    name: 'メルカリ',
    website: 'https://about.mercari.com/',
    description: 'フリマアプリ運営企業'
  }
];

// APIクライアント
class ApiClient {
  constructor(baseUrl, environment) {
    this.baseUrl = baseUrl;
    this.environment = environment;
  }

  async makeRequest(endpoint, data = null, timeout = 30000) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method: data ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      }
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    console.log(`📡 [${this.environment}] ${options.method} ${endpoint}`);
    
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      
      const responseText = await response.text();
      let responseData;
      
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = { rawResponse: responseText };
      }

      return {
        success: response.ok,
        status: response.status,
        data: responseData,
        responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        success: false,
        status: 0,
        error: error.message,
        responseTime
      };
    }
  }

  async testHealth() {
    console.log(`\n🏥 ヘルスチェック [${this.environment}]`);
    console.log('─'.repeat(50));
    
    const result = await this.makeRequest('/health');
    
    if (result.success) {
      console.log(`✅ ステータス: ${result.status}`);
      console.log(`⏱️  応答時間: ${result.responseTime}ms`);
      console.log(`📊 データ:`, JSON.stringify(result.data, null, 2));
    } else {
      console.log(`❌ エラー: ${result.status} - ${result.error}`);
      console.log(`⏱️  応答時間: ${result.responseTime}ms`);
    }
    
    return result;
  }

  async testMVVExtraction(company, provider = 'perplexity') {
    const endpoint = provider === 'perplexity' ? '/extract-mvv-perplexity' : '/extract-mvv';
    
    console.log(`\n🔍 MVV抽出テスト [${this.environment}] - ${provider.toUpperCase()}`);
    console.log(`企業: ${company.name}`);
    console.log('─'.repeat(50));
    
    const requestData = {
      companyId: company.id,
      companyName: company.name,
      companyWebsite: company.website,
      companyDescription: company.description
    };

    const result = await this.makeRequest(endpoint, requestData, 45000); // 45秒タイムアウト
    
    if (result.success) {
      console.log(`✅ ステータス: ${result.status}`);
      console.log(`⏱️  応答時間: ${result.responseTime}ms`);
      
      const data = result.data;
      if (data.success && data.data) {
        console.log(`📋 Mission: ${data.data.mission || 'なし'}`);
        console.log(`🎯 Vision: ${data.data.vision || 'なし'}`);
        console.log(`💎 Values: [${data.data.values?.join(', ') || 'なし'}]`);
        console.log(`🎯 信頼度: M:${data.data.confidence_scores?.mission || 0} V:${data.data.confidence_scores?.vision || 0} V:${data.data.confidence_scores?.values || 0}`);
        console.log(`🔗 情報源: ${data.data.extracted_from}`);
        console.log(`⚡ 処理時間: ${data.metadata?.processingTime || 'N/A'}ms`);
      } else {
        console.log(`❌ API エラー: ${data.error || '不明なエラー'}`);
      }
    } else {
      console.log(`❌ エラー: ${result.status} - ${result.error}`);
      console.log(`⏱️  応答時間: ${result.responseTime}ms`);
    }
    
    return result;
  }

  async runFullTest() {
    console.log(`\n🚀 ${this.environment} 統合テスト開始`);
    console.log('='.repeat(60));

    // ヘルスチェック
    const healthResult = await this.testHealth();
    
    if (!healthResult.success) {
      console.log(`❌ ${this.environment} のヘルスチェックが失敗しました。テストを中止します。`);
      return false;
    }

    // MVV抽出テスト (Perplexity)
    for (const company of testCompanies.slice(0, 2)) { // 最初の2社のみテスト
      await this.testMVVExtraction(company, 'perplexity');
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2秒待機
    }

    // MVV抽出テスト (OpenAI) - 1社のみ
    await this.testMVVExtraction(testCompanies[0], 'openai');

    console.log(`\n✅ ${this.environment} テスト完了`);
    return true;
  }
}

// ユーザー入力処理
function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// メイン実行関数
async function main() {
  const args = process.argv.slice(2);
  let environment = args[0];

  console.log('🧪 MVV抽出システム API統合テスト');
  console.log('='.repeat(60));

  if (!environment || !['local', 'prod', 'both'].includes(environment)) {
    console.log('📝 使用方法:');
    console.log('  node test-api.js local     # ローカル環境テスト');
    console.log('  node test-api.js prod      # プロダクション環境テスト');
    console.log('  node test-api.js both      # 両方の環境をテスト');
    console.log('');
    
    environment = await askQuestion('テスト環境を選択してください (local/prod/both): ');
  }

  if (!['local', 'prod', 'both'].includes(environment)) {
    console.log('❌ 無効な環境が指定されました。');
    process.exit(1);
  }

  try {
    if (environment === 'local' || environment === 'both') {
      const localClient = new ApiClient(config.local.baseUrl, config.local.name);
      const localResult = await localClient.runFullTest();
      
      if (!localResult && environment === 'local') {
        process.exit(1);
      }
    }

    if (environment === 'prod' || environment === 'both') {
      if (environment === 'both') {
        console.log('\n' + '='.repeat(60));
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3秒待機
      }
      
      const prodClient = new ApiClient(config.prod.baseUrl, config.prod.name);
      const prodResult = await prodClient.runFullTest();
      
      if (!prodResult) {
        process.exit(1);
      }
    }

    console.log('\n🎉 全テスト完了！');
    
  } catch (error) {
    console.error('❌ テスト実行中にエラーが発生しました:', error.message);
    process.exit(1);
  }
}

// Node.js環境でfetchが利用できない場合の対応
if (typeof fetch === 'undefined') {
  try {
    global.fetch = require('node-fetch');
  } catch (e) {
    console.error('❌ node-fetchがインストールされていません。以下のコマンドでインストールしてください:');
    console.error('npm install node-fetch');
    process.exit(1);
  }
}

// スクリプト実行
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { ApiClient, testCompanies };
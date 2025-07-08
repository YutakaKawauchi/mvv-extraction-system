#!/usr/bin/env node

/**
 * MVV抽出システム クイックテスト
 * 
 * Usage:
 *   node quick-test.js                    # Perplexity APIをローカルでテスト
 *   node quick-test.js prod               # Perplexity APIをプロダクションでテスト
 *   node quick-test.js openai             # OpenAI APIをローカルでテスト
 *   node quick-test.js openai prod        # OpenAI APIをプロダクションでテスト
 */

// Node.js環境でfetchが利用できない場合の対応
if (typeof fetch === 'undefined') {
  try {
    global.fetch = require('node-fetch');
  } catch (e) {
    console.error('❌ node-fetchがインストールされていません。');
    console.error('npm install node-fetch');
    process.exit(1);
  }
}

const args = process.argv.slice(2);
const provider = args.includes('openai') ? 'openai' : 'perplexity';
const environment = args.includes('prod') ? 'prod' : 'local';

const config = {
  local: 'http://localhost:8888/.netlify/functions',
  prod: 'https://comforting-sorbet-612b07.netlify.app/.netlify/functions'
};

const endpoint = provider === 'openai' ? '/extract-mvv' : '/extract-mvv-perplexity';
const url = config[environment] + endpoint;

console.log(`🚀 ${provider.toUpperCase()} API クイックテスト [${environment}]`);
console.log(`📡 URL: ${url}`);
console.log('─'.repeat(60));

const testData = {
  companyId: 'quick-test-001',
  companyName: 'サイバーエージェント',
  companyWebsite: 'https://www.cyberagent.co.jp/',
  companyDescription: 'インターネット広告・ゲーム・メディア事業を展開するIT企業'
};

async function quickTest() {
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'mvv-extraction-2024-secure-key'
      },
      body: JSON.stringify(testData)
    });

    const responseTime = Date.now() - startTime;
    const data = await response.json();

    console.log(`✅ ステータス: ${response.status}`);
    console.log(`⏱️  応答時間: ${responseTime}ms`);
    
    if (data.success && data.data) {
      console.log(`📋 Mission: ${data.data.mission || 'なし'}`);
      console.log(`🎯 Vision: ${data.data.vision || 'なし'}`);
      console.log(`💎 Values: [${data.data.values?.join(', ') || 'なし'}]`);
      console.log(`🎯 信頼度: M:${data.data.confidence_scores?.mission || 0} V:${data.data.confidence_scores?.vision || 0} V:${data.data.confidence_scores?.values || 0}`);
      console.log(`🔗 情報源: ${data.data.extracted_from}`);
      console.log(`⚡ 処理時間: ${data.metadata?.processingTime || 'N/A'}ms`);
    } else {
      console.log(`❌ エラー: ${data.error || JSON.stringify(data)}`);
    }

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.log(`❌ リクエストエラー: ${error.message}`);
    console.log(`⏱️  応答時間: ${responseTime}ms`);
  }
}

quickTest();
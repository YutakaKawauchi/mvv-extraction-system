#!/usr/bin/env node
/**
 * Embedding生成のテストスクリプト
 * 本番実行前に少数のサンプルでテストを行う
 */

const fs = require('fs');
const path = require('path');

// .envファイルから環境変数を読み込み
const dotenvPath = path.join(__dirname, '../../backend/.env');
if (fs.existsSync(dotenvPath)) {
  require('dotenv').config({ path: dotenvPath });
}

const { EmbeddingGenerator } = require('./embedding_generator');

async function testEmbedding() {
  console.log('🧪 OpenAI Embedding APIテスト\n');

  // 環境変数からAPIキー取得
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY 環境変数が設定されていません');
    process.exit(1);
  }

  // 前処理済みデータから最初の3社を取得
  const inputPath = path.join(__dirname, '../../data/analysis-data/processed/preprocessed_mvv_data.json');
  const preprocessedData = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  const testCompanies = preprocessedData.companies.slice(0, 3);

  console.log(`📋 テスト対象: ${testCompanies.length}社`);
  testCompanies.forEach(company => {
    console.log(`  - ${company.name} (${company.category})`);
  });

  try {
    const generator = new EmbeddingGenerator(apiKey);
    
    // コスト概算
    const costEstimate = generator.estimateCost(testCompanies);
    console.log(`\n💰 テストコスト: $${costEstimate.estimatedCost.toFixed(4)}`);

    console.log('\n🚀 テスト実行中...');
    
    // 1社のみテスト
    const testCompany = testCompanies[0];
    console.log(`\n🔍 ${testCompany.name} のMVVテキスト:`);
    console.log(`Mission: ${testCompany.mission.substring(0, 50)}...`);
    console.log(`Vision: ${testCompany.vision.substring(0, 50)}...`);
    console.log(`Values: ${testCompany.values.substring(0, 50)}...`);

    // Embedding生成テスト
    const embedding = await generator.generateEmbedding(testCompany.combinedMVV);
    
    console.log('\n✅ Embedding生成成功!');
    console.log(`  ベクトル次元数: ${embedding.length}`);
    console.log(`  最初の10要素: [${embedding.slice(0, 10).map(v => v.toFixed(4)).join(', ')}...]`);

    // ベクトルの統計情報
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    const mean = embedding.reduce((sum, val) => sum + val, 0) / embedding.length;
    const max = Math.max(...embedding);
    const min = Math.min(...embedding);

    console.log('\n📊 ベクトル統計:');
    console.log(`  大きさ(magnitude): ${magnitude.toFixed(4)}`);
    console.log(`  平均値: ${mean.toFixed(6)}`);
    console.log(`  最大値: ${max.toFixed(4)}`);
    console.log(`  最小値: ${min.toFixed(4)}`);

    console.log('\n✅ APIテスト成功! 本番実行の準備ができています。');
    console.log('\n💡 本番実行コマンド:');
    console.log('   node embedding_generator.js');

  } catch (error) {
    console.error(`\n❌ テスト失敗: ${error.message}`);
    console.error('詳細:', error);
    process.exit(1);
  }
}

// 実行
testEmbedding();
#!/usr/bin/env node
/**
 * OpenAI Embedding API ベクトル埋め込み生成スクリプト
 * 前処理済みMVVデータをベクトル化して類似性分析の準備を行う
 */

const fs = require('fs');
const path = require('path');

// .envファイルから環境変数を読み込み
const dotenvPath = path.join(__dirname, '../../backend/.env');
if (fs.existsSync(dotenvPath)) {
  require('dotenv').config({ path: dotenvPath });
}

class EmbeddingGenerator {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.openai.com/v1/embeddings';
    this.model = 'text-embedding-3-small'; // コスト効率重視
  }

  /**
   * OpenAI Embedding API を呼び出してベクトル埋め込みを生成
   */
  async generateEmbedding(text) {
    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          input: text,
          encoding_format: 'float'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      return data.data[0].embedding;

    } catch (error) {
      console.error(`❌ Embedding生成エラー: ${error.message}`);
      throw error;
    }
  }

  /**
   * 既存のEmbeddingキャッシュをチェック
   */
  loadExistingEmbeddings(cachePath) {
    try {
      if (fs.existsSync(cachePath)) {
        const existingData = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
        console.log(`📂 既存のEmbeddingキャッシュを発見: ${existingData.companies?.length || 0}社`);
        
        // 既存データをマップに変換（高速検索用）
        const embeddingMap = new Map();
        if (existingData.companies) {
          existingData.companies.forEach(company => {
            if (company.embeddings && company.embeddings.combined) {
              embeddingMap.set(company.id, company);
            }
          });
        }
        
        return embeddingMap;
      }
    } catch (error) {
      console.warn(`⚠️  キャッシュ読み込みエラー: ${error.message}`);
    }
    
    return new Map();
  }

  /**
   * バッチでEmbeddingを生成（レート制限対応・キャッシュ活用）
   */
  async generateEmbeddingsBatch(companies, delay = 1000, cachePath = null) {
    console.log(`🔄 ${companies.length}社のEmbedding生成開始...`);
    
    // 既存のEmbeddingをロード
    const existingEmbeddings = cachePath ? this.loadExistingEmbeddings(cachePath) : new Map();
    console.log(`💾 キャッシュ済み: ${existingEmbeddings.size}社`);
    
    const results = [];
    const totalCount = companies.length;
    let apiCallCount = 0;
    let cachedCount = 0;
    
    for (let i = 0; i < companies.length; i++) {
      const company = companies[i];
      
      // キャッシュチェック
      const cached = existingEmbeddings.get(company.id);
      if (cached && cached.embeddings && cached.embeddings.combined) {
        console.log(`📦 キャッシュ使用: ${i + 1}/${totalCount} - ${company.name}`);
        results.push(cached);
        cachedCount++;
        continue;
      }
      
      try {
        console.log(`📊 API呼び出し: ${i + 1}/${totalCount} - ${company.name}`);
        
        // Mission, Vision, Values個別のEmbedding
        const missionEmbedding = company.mission ? 
          await this.generateEmbedding(company.mission) : null;
        
        const visionEmbedding = company.vision ? 
          await this.generateEmbedding(company.vision) : null;
        
        const valuesEmbedding = company.values ? 
          await this.generateEmbedding(company.values) : null;
        
        // 統合MVVのEmbedding
        const combinedEmbedding = await this.generateEmbedding(company.combinedMVV);
        
        const embeddingData = {
          ...company,
          embeddings: {
            mission: missionEmbedding,
            vision: visionEmbedding,
            values: valuesEmbedding,
            combined: combinedEmbedding
          },
          embeddingGeneratedAt: new Date().toISOString()
        };
        
        results.push(embeddingData);
        apiCallCount++;
        
        // 中間保存（5社ごと）
        if (apiCallCount % 5 === 0 && cachePath) {
          this.saveIntermediateResults(results, cachePath);
          console.log(`💾 中間保存完了: ${results.length}社`);
        }
        
        // レート制限対策（最後の企業以外）
        if (i < companies.length - 1 && !existingEmbeddings.has(companies[i + 1].id)) {
          console.log(`⏱️  ${delay}ms 待機中...`);
          await this.sleep(delay);
        }
        
      } catch (error) {
        console.error(`⚠️  ${company.name} のEmbedding生成失敗: ${error.message}`);
        // エラーが発生した企業もnull embeddingで記録
        const errorData = {
          ...company,
          embeddings: {
            mission: null,
            vision: null,
            values: null,
            combined: null
          },
          embeddingError: error.message,
          embeddingGeneratedAt: new Date().toISOString()
        };
        results.push(errorData);
        
        // エラー時も保存
        if (cachePath) {
          this.saveIntermediateResults(results, cachePath);
        }
      }
    }
    
    console.log(`\n✅ Embedding生成完了:`);
    console.log(`  総数: ${results.length}/${totalCount} 社`);
    console.log(`  新規API呼び出し: ${apiCallCount}回`);
    console.log(`  キャッシュ利用: ${cachedCount}社`);
    
    return results;
  }

  /**
   * 中間結果を保存（障害対策）
   */
  saveIntermediateResults(results, outputPath) {
    try {
      const embeddingData = {
        model: this.model,
        totalCompanies: results.length,
        successfulEmbeddings: results.filter(e => e.embeddings.combined !== null).length,
        generatedAt: new Date().toISOString(),
        companies: results
      };

      const tempPath = outputPath + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(embeddingData, null, 2), 'utf-8');
      
      // アトミックに置き換え
      if (fs.existsSync(outputPath)) {
        fs.renameSync(outputPath, outputPath + '.backup');
      }
      fs.renameSync(tempPath, outputPath);
      
    } catch (error) {
      console.error(`⚠️  中間保存エラー: ${error.message}`);
    }
  }

  /**
   * 指定時間待機するユーティリティ関数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Embedding生成のコスト概算を計算
   */
  estimateCost(companies) {
    // text-embedding-3-small の料金: $0.02 per 1M tokens
    const pricePerToken = 0.02 / 1000000;
    
    let totalTokens = 0;
    companies.forEach(company => {
      // 日本語テキストの概算: 1文字 ≈ 1.5トークン
      const missionTokens = company.mission ? company.mission.length * 1.5 : 0;
      const visionTokens = company.vision ? company.vision.length * 1.5 : 0;
      const valuesTokens = company.values ? company.values.length * 1.5 : 0;
      const combinedTokens = company.combinedMVV.length * 1.5;
      
      totalTokens += missionTokens + visionTokens + valuesTokens + combinedTokens;
    });
    
    const estimatedCost = totalTokens * pricePerToken;
    
    console.log('\n💰 コスト概算:');
    console.log(`  推定トークン数: ${Math.round(totalTokens).toLocaleString()}`);
    console.log(`  推定コスト: $${estimatedCost.toFixed(4)} (約${(estimatedCost * 150).toFixed(2)}円)`);
    
    return { totalTokens: Math.round(totalTokens), estimatedCost };
  }

  /**
   * 結果をファイルに保存
   */
  saveEmbeddings(embeddings, outputPath) {
    try {
      // 出力ディレクトリ作成
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const embeddingData = {
        model: this.model,
        totalCompanies: embeddings.length,
        successfulEmbeddings: embeddings.filter(e => e.embeddings.combined !== null).length,
        generatedAt: new Date().toISOString(),
        companies: embeddings
      };

      fs.writeFileSync(outputPath, JSON.stringify(embeddingData, null, 2), 'utf-8');
      console.log(`💾 Embedding保存完了: ${outputPath}`);

    } catch (error) {
      console.error(`❌ Embedding保存エラー: ${error.message}`);
      throw error;
    }
  }
}

/**
 * メイン実行関数
 */
async function main() {
  console.log('🚀 OpenAI Embedding 生成スクリプト開始\n');

  // 環境変数からAPIキー取得
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY 環境変数が設定されていません');
    console.log('💡 以下のコマンドでAPIキーを設定してください:');
    console.log('   export OPENAI_API_KEY="your-api-key-here"');
    process.exit(1);
  }

  // ファイルパス設定
  const inputPath = path.join(__dirname, '../../data/analysis-data/processed/preprocessed_mvv_data.json');
  const outputPath = path.join(__dirname, '../../data/analysis-data/processed/mvv_embeddings.json');

  try {
    // 前処理済みデータ読み込み
    console.log('📂 前処理済みデータ読み込み中...');
    const preprocessedData = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
    const companies = preprocessedData.companies;
    
    console.log(`✅ ${companies.length}社の完全MVVデータを読み込み`);

    // Embedding生成器初期化
    const generator = new EmbeddingGenerator(apiKey);

    // コスト概算表示
    const costEstimate = generator.estimateCost(companies);

    // ユーザー確認（実際の処理では自動実行）
    console.log('\n🤖 OpenAI text-embedding-3-small を使用してEmbedding生成を開始します');
    console.log('⏱️  レート制限対策で1秒間隔で処理します');

    // Embedding生成実行（キャッシュ機能付き）
    const embeddings = await generator.generateEmbeddingsBatch(companies, 1000, outputPath);

    // 結果保存
    generator.saveEmbeddings(embeddings, outputPath);

    console.log('\n🎉 Embedding生成完了! 次のステップ:');
    console.log(`  1. ${outputPath} でEmbedding結果を確認`);
    console.log('  2. similarity_analyzer.js で類似性分析実行');
    console.log('  3. フロントエンド可視化コンポーネント実装');

  } catch (error) {
    console.error(`\n❌ 処理失敗: ${error.message}`);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみmain()を呼び出し
if (require.main === module) {
  main();
}

module.exports = { EmbeddingGenerator };
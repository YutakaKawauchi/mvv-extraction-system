#!/usr/bin/env node
/**
 * MVV類似性分析スクリプト
 * Embeddingベクトルを使用してコサイン類似度による企業間類似性を計算
 */

const fs = require('fs');
const path = require('path');

class SimilarityAnalyzer {
  constructor() {
    this.embeddings = null;
    this.similarityMatrix = null;
  }

  /**
   * Embeddingデータを読み込み
   */
  loadEmbeddings(embeddingsPath) {
    try {
      const embeddingData = JSON.parse(fs.readFileSync(embeddingsPath, 'utf-8'));
      this.embeddings = embeddingData.companies.filter(company => 
        company.embeddings.combined !== null
      );
      
      console.log(`✅ ${this.embeddings.length}社のEmbeddingデータを読み込み`);
      return this.embeddings;
      
    } catch (error) {
      console.error(`❌ Embeddingデータ読み込みエラー: ${error.message}`);
      throw error;
    }
  }

  /**
   * コサイン類似度を計算
   */
  cosineSimilarity(vectorA, vectorB) {
    if (vectorA.length !== vectorB.length) {
      throw new Error('ベクトルの次元が一致しません');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 全企業間の類似度マトリックスを計算
   */
  calculateSimilarityMatrix() {
    console.log('🔄 類似度マトリックス計算開始...');
    
    const companies = this.embeddings;
    const matrix = [];
    
    for (let i = 0; i < companies.length; i++) {
      const row = [];
      
      for (let j = 0; j < companies.length; j++) {
        if (i === j) {
          row.push(1.0); // 自己類似度は1.0
        } else {
          const similarity = this.cosineSimilarity(
            companies[i].embeddings.combined,
            companies[j].embeddings.combined
          );
          row.push(similarity);
        }
      }
      
      matrix.push(row);
      
      if ((i + 1) % 10 === 0) {
        console.log(`📊 進捗: ${i + 1}/${companies.length} 完了`);
      }
    }
    
    this.similarityMatrix = matrix;
    console.log(`✅ ${companies.length}x${companies.length} 類似度マトリックス計算完了`);
    
    return matrix;
  }

  /**
   * 各企業の最も類似する企業を特定
   */
  findMostSimilarCompanies(topN = 5) {
    if (!this.similarityMatrix) {
      throw new Error('類似度マトリックスが計算されていません');
    }

    const companies = this.embeddings;
    const results = [];

    for (let i = 0; i < companies.length; i++) {
      const similarities = [];
      
      for (let j = 0; j < companies.length; j++) {
        if (i !== j) { // 自分自身は除外
          similarities.push({
            company: companies[j],
            similarity: this.similarityMatrix[i][j]
          });
        }
      }

      // 類似度で降順ソート
      similarities.sort((a, b) => b.similarity - a.similarity);

      results.push({
        company: companies[i],
        mostSimilar: similarities.slice(0, topN)
      });
    }

    return results;
  }

  /**
   * 業界内・業界間類似性分析
   */
  analyzeCategorySimilarity() {
    const companies = this.embeddings;
    const categoryAnalysis = {};

    // 業界別グループ化
    companies.forEach(company => {
      const category = company.category;
      if (!categoryAnalysis[category]) {
        categoryAnalysis[category] = {
          companies: [],
          internalSimilarities: [],
          externalSimilarities: []
        };
      }
      categoryAnalysis[category].companies.push(company);
    });

    // 業界内・業界間類似度計算
    Object.keys(categoryAnalysis).forEach(category => {
      const categoryCompanies = categoryAnalysis[category].companies;
      
      // 業界内類似度
      const internalSims = [];
      for (let i = 0; i < categoryCompanies.length; i++) {
        for (let j = i + 1; j < categoryCompanies.length; j++) {
          const companyA = categoryCompanies[i];
          const companyB = categoryCompanies[j];
          const similarity = this.cosineSimilarity(
            companyA.embeddings.combined,
            companyB.embeddings.combined
          );
          internalSims.push(similarity);
        }
      }

      // 業界間類似度（他業界との比較）
      const externalSims = [];
      categoryCompanies.forEach(companyA => {
        companies.forEach(companyB => {
          if (companyA.category !== companyB.category) {
            const similarity = this.cosineSimilarity(
              companyA.embeddings.combined,
              companyB.embeddings.combined
            );
            externalSims.push(similarity);
          }
        });
      });

      categoryAnalysis[category].internalSimilarities = internalSims;
      categoryAnalysis[category].externalSimilarities = externalSims;
      categoryAnalysis[category].avgInternalSimilarity = 
        internalSims.length > 0 ? internalSims.reduce((a, b) => a + b, 0) / internalSims.length : 0;
      categoryAnalysis[category].avgExternalSimilarity = 
        externalSims.length > 0 ? externalSims.reduce((a, b) => a + b, 0) / externalSims.length : 0;
    });

    return categoryAnalysis;
  }

  /**
   * 分析結果のサマリーを生成
   */
  generateSummary() {
    const companies = this.embeddings;
    const similarCompanies = this.findMostSimilarCompanies(3);
    const categoryAnalysis = this.analyzeCategorySimilarity();

    // 全体統計
    let totalSimilarity = 0;
    let count = 0;
    
    for (let i = 0; i < this.similarityMatrix.length; i++) {
      for (let j = i + 1; j < this.similarityMatrix[i].length; j++) {
        totalSimilarity += this.similarityMatrix[i][j];
        count++;
      }
    }
    
    const avgSimilarity = count > 0 ? totalSimilarity / count : 0;

    // 最も類似度の高いペア
    let maxSimilarity = 0;
    let maxPair = null;
    
    for (let i = 0; i < companies.length; i++) {
      for (let j = i + 1; j < companies.length; j++) {
        const similarity = this.similarityMatrix[i][j];
        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
          maxPair = [companies[i], companies[j]];
        }
      }
    }

    const summary = {
      totalCompanies: companies.length,
      avgSimilarity: avgSimilarity,
      maxSimilarity: maxSimilarity,
      maxSimilarPair: maxPair,
      categoryAnalysis: categoryAnalysis,
      topSimilarCompanies: similarCompanies.slice(0, 10), // 上位10社のみ
      generatedAt: new Date().toISOString()
    };

    return summary;
  }

  /**
   * 分析結果を保存
   */
  saveAnalysisResults(outputPath) {
    try {
      const summary = this.generateSummary();
      const fullResults = {
        summary: summary,
        similarityMatrix: this.similarityMatrix,
        companies: this.embeddings,
        model: 'text-embedding-3-small',
        analysis: {
          mostSimilarCompanies: this.findMostSimilarCompanies(5),
          categoryAnalysis: this.analyzeCategorySimilarity()
        },
        generatedAt: new Date().toISOString()
      };

      // 出力ディレクトリ作成
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(outputPath, JSON.stringify(fullResults, null, 2), 'utf-8');
      console.log(`💾 分析結果保存完了: ${outputPath}`);

      // サマリー表示
      this.displaySummary(summary);

    } catch (error) {
      console.error(`❌ 分析結果保存エラー: ${error.message}`);
      throw error;
    }
  }

  /**
   * 分析結果サマリーを表示
   */
  displaySummary(summary) {
    console.log('\n📊 MVV類似性分析結果サマリー:');
    console.log(`  対象企業数: ${summary.totalCompanies}社`);
    console.log(`  平均類似度: ${summary.avgSimilarity.toFixed(4)}`);
    console.log(`  最高類似度: ${summary.maxSimilarity.toFixed(4)}`);
    
    if (summary.maxSimilarPair) {
      console.log(`  最類似ペア: ${summary.maxSimilarPair[0].name} ⟷ ${summary.maxSimilarPair[1].name}`);
    }

    console.log('\n🏢 業界別類似度分析:');
    Object.entries(summary.categoryAnalysis).forEach(([category, analysis]) => {
      console.log(`  ${category}:`);
      console.log(`    企業数: ${analysis.companies.length}社`);
      console.log(`    業界内平均類似度: ${analysis.avgInternalSimilarity.toFixed(4)}`);
      console.log(`    業界間平均類似度: ${analysis.avgExternalSimilarity.toFixed(4)}`);
    });
  }
}

/**
 * メイン実行関数
 */
async function main() {
  console.log('🚀 MVV類似性分析スクリプト開始\n');

  // ファイルパス設定
  const embeddingsPath = path.join(__dirname, '../../data/analysis-data/processed/mvv_embeddings.json');
  const outputPath = path.join(__dirname, '../../data/analysis-data/processed/similarity_analysis.json');

  try {
    // 類似性分析実行
    const analyzer = new SimilarityAnalyzer();
    analyzer.loadEmbeddings(embeddingsPath);
    analyzer.calculateSimilarityMatrix();
    analyzer.saveAnalysisResults(outputPath);

    console.log('\n🎉 類似性分析完了! 次のステップ:');
    console.log(`  1. ${outputPath} で詳細結果を確認`);
    console.log('  2. フロントエンド可視化コンポーネント実装');
    console.log('  3. Netlify Functions API実装');

  } catch (error) {
    console.error(`\n❌ 分析失敗: ${error.message}`);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみmain()を呼び出し
if (require.main === module) {
  main();
}

module.exports = { SimilarityAnalyzer };
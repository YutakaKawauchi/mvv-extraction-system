#!/usr/bin/env node
/**
 * MVV データ前処理スクリプト (Node.js版)
 * 95社のMVVデータを読み込み、分析用に前処理を実行
 */

const fs = require('fs');
const path = require('path');

class MVVDataProcessor {
  constructor(csvPath) {
    this.csvPath = csvPath;
    this.data = null;
    this.processedData = null;
  }

  /**
   * CSVファイルを読み込み、基本的なデータクリーニングを実行
   */
  loadData() {
    try {
      const csvContent = fs.readFileSync(this.csvPath, 'utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      // ヘッダー行の解析
      const headers = this.parseCSVLine(lines[0]);
      console.log('📊 CSVヘッダー:', headers);
      
      // データ行の解析
      const dataRows = [];
      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i]);
        if (values.length === headers.length) {
          const rowData = {};
          headers.forEach((header, index) => {
            rowData[header] = values[index] || '';
          });
          dataRows.push(rowData);
        }
      }
      
      this.data = dataRows;
      console.log(`✅ データ読み込み完了: ${this.data.length} 社`);
      
      this.printBasicStats();
      return this.data;
      
    } catch (error) {
      console.error(`❌ データ読み込みエラー: ${error.message}`);
      throw error;
    }
  }

  /**
   * CSV行をパースする（引用符とカンマを適切に処理）
   */
  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // 次の引用符をスキップ
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  /**
   * 基本統計情報を表示
   */
  printBasicStats() {
    console.log('\n📈 基本統計情報:');
    console.log(`・総企業数: ${this.data.length}`);
    
    // ステータス集計
    const completedCount = this.data.filter(row => row.status === 'completed').length;
    console.log(`・完了ステータス: ${completedCount}`);
    
    // 業界カテゴリ集計
    const categories = {};
    this.data.forEach(row => {
      const category = row.category || 'その他';
      categories[category] = (categories[category] || 0) + 1;
    });
    
    console.log(`・業界カテゴリ数: ${Object.keys(categories).length}`);
    console.log('\n🏢 業界別企業数:');
    Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([category, count]) => {
        console.log(`  ${category}: ${count}社`);
      });
    
    // MVVデータ完全性チェック
    const missionFilled = this.data.filter(row => row.mission && row.mission.trim() !== '').length;
    const visionFilled = this.data.filter(row => row.vision && row.vision.trim() !== '').length;
    const valuesFilled = this.data.filter(row => row.values && row.values.trim() !== '').length;
    
    console.log('\n📝 MVVデータ完全性:');
    console.log(`  Mission: ${missionFilled}/${this.data.length} (${(missionFilled/this.data.length*100).toFixed(1)}%)`);
    console.log(`  Vision: ${visionFilled}/${this.data.length} (${(visionFilled/this.data.length*100).toFixed(1)}%)`);
    console.log(`  Values: ${valuesFilled}/${this.data.length} (${(valuesFilled/this.data.length*100).toFixed(1)}%)`);
  }

  /**
   * MVVデータを分析用形式に前処理
   */
  preprocessMVVData() {
    const processedCompanies = [];
    
    this.data.forEach((row, index) => {
      try {
        // MVVテキストのクリーニング
        const mission = this.cleanText(row.mission || '');
        const vision = this.cleanText(row.vision || '');
        const values = this.cleanText(row.values || '');
        
        // 統合MVVテキスト作成
        const combinedMVV = this.createCombinedMVV(mission, vision, values);
        
        const companyData = {
          id: `company_${index + 1}`,
          name: row.companyName || '',
          website: row.website || '',
          category: row.category || '',
          mission: mission,
          vision: vision,
          values: values,
          combinedMVV: combinedMVV,
          confidenceScores: {
            mission: parseFloat(row.missionConfidence || '0.0'),
            vision: parseFloat(row.visionConfidence || '0.0'),
            values: parseFloat(row.valuesConfidence || '0.0')
          },
          extractionSource: row.extractionSource || '',
          extractedFrom: row.extractedFrom || '',
          hasCompleteMVV: !!(mission && vision && values)
        };
        
        processedCompanies.push(companyData);
        
      } catch (error) {
        console.warn(`⚠️ 企業データ処理エラー (行 ${index + 1}): ${error.message}`);
      }
    });
    
    this.processedData = processedCompanies;
    console.log(`\n✅ 前処理完了: ${processedCompanies.length} 社のデータを処理`);
    
    return processedCompanies;
  }

  /**
   * テキストのクリーニング処理
   */
  cleanText(text) {
    if (!text || text.trim() === '') {
      return '';
    }
    
    // 基本的なクリーニング
    text = text.trim();
    // セミコロンで区切られたValues等の処理
    if (text.includes(';')) {
      text = text.replace(/;/g, '、');
    }
    
    return text;
  }

  /**
   * Mission, Vision, Valuesを結合したテキストを作成
   */
  createCombinedMVV(mission, vision, values) {
    const parts = [];
    
    if (mission) parts.push(`Mission: ${mission}`);
    if (vision) parts.push(`Vision: ${vision}`);
    if (values) parts.push(`Values: ${values}`);
    
    return parts.join(' | ');
  }

  /**
   * 分析用データ形式で返却
   */
  getAnalysisReadyData() {
    if (!this.processedData) {
      throw new Error('データが前処理されていません。preprocessMVVData()を先に実行してください。');
    }
    
    // 完全なMVVデータを持つ企業のみフィルタ
    const completeMVVCompanies = this.processedData.filter(
      company => company.hasCompleteMVV
    );
    
    // 業界別グループ化
    const byCategory = {};
    completeMVVCompanies.forEach(company => {
      const category = company.category;
      if (!byCategory[category]) {
        byCategory[category] = [];
      }
      byCategory[category].push(company);
    });
    
    const analysisData = {
      totalCompanies: this.processedData.length,
      completeMVVCompanies: completeMVVCompanies.length,
      companies: completeMVVCompanies,
      byCategory: byCategory,
      categories: Object.keys(byCategory),
      processedAt: new Date().toISOString()
    };
    
    console.log('\n📊 分析用データ準備完了:');
    console.log(`  完全MVVデータ: ${completeMVVCompanies.length}/${this.processedData.length} 社`);
    console.log(`  業界カテゴリ: ${Object.keys(byCategory).length} 種類`);
    
    return analysisData;
  }

  /**
   * 前処理済みデータをJSONファイルに保存
   */
  saveProcessedData(outputPath) {
    try {
      const analysisData = this.getAnalysisReadyData();
      
      // 出力ディレクトリ作成
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      fs.writeFileSync(outputPath, JSON.stringify(analysisData, null, 2), 'utf-8');
      console.log(`💾 前処理済みデータ保存完了: ${outputPath}`);
      
    } catch (error) {
      console.error(`❌ データ保存エラー: ${error.message}`);
      throw error;
    }
  }
}

/**
 * メイン実行関数
 */
function main() {
  console.log('🚀 MVV データ前処理スクリプト開始\n');
  
  // ファイルパス設定
  const csvPath = path.join(__dirname, '../../data/analysis-data/mvv-data-95companies.csv');
  const outputPath = path.join(__dirname, '../../data/analysis-data/processed/preprocessed_mvv_data.json');
  
  try {
    // データ処理実行
    const processor = new MVVDataProcessor(csvPath);
    processor.loadData();
    processor.preprocessMVVData();
    processor.saveProcessedData(outputPath);
    
    console.log('\n🎉 前処理完了! 次のステップ:');
    console.log(`  1. ${outputPath} で前処理結果を確認`);
    console.log('  2. OpenAI Embedding API でベクトル埋め込み生成');
    console.log('  3. 類似性分析実行');
    
    process.exit(0);
    
  } catch (error) {
    console.error(`\n❌ 処理失敗: ${error.message}`);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみmain()を呼び出し
if (require.main === module) {
  main();
}

module.exports = { MVVDataProcessor };
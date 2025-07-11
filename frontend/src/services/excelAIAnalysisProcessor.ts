/**
 * AI分析結果のExcelエクスポート処理
 * MVV分析画面のデータをビジネスレポート形式でExcel化
 */

import ExcelJS from 'exceljs';
import type { Company, MVVData, CompanyInfo } from '../types';
// import { SimilarityCalculator } from './similarityCalculator'; // Not used in current implementation
import { enhancedSegmentationService } from './enhancedSegmentationService';

interface AIAnalysisData {
  similarityMatrix: SimilarityMatrixEntry[];
  trendKeywords: TrendKeywordData[];
  qualityScores: QualityScoreData[];
  positioningData: PositioningData[];
  wordCloudData: WordCloudEntry[];
}

interface SimilarityMatrixEntry {
  companyName: string;
  category: string;
  topSimilarCompanies: {
    name: string;
    score: number;
    category: string;
  }[];
}

interface TrendKeywordData {
  category: string;
  keywords: {
    word: string;
    frequency: number;
    companyCount: number;
  }[];
}

interface QualityScoreData {
  companyName: string;
  category: string;
  missionScore: number;
  visionScore: number;
  valuesScore: number;
  overallScore: number;
}

interface PositioningData {
  companyName: string;
  category: string;
  x: number;
  y: number;
  size: number; // 従業員数ベース
}

interface WordCloudEntry {
  word: string;
  frequency: number;
  categories: string[];
}

export class ExcelAIAnalysisProcessor {
  /**
   * AI分析データを収集
   */
  async collectAIAnalysisData(
    companies: Company[],
    mvvDataMap: Map<string, MVVData>,
    companyInfoMap: Map<string, CompanyInfo>
  ): Promise<AIAnalysisData> {
    console.log('🤖 AI分析データ収集開始...');

    // 類似企業マトリックスの生成
    const similarityMatrix = await this.generateSimilarityMatrix(
      companies,
      mvvDataMap
    );

    // トレンドキーワードの抽出
    const trendKeywords = await this.extractTrendKeywords(
      companies,
      mvvDataMap
    );

    // 品質スコアの計算
    const qualityScores = this.calculateQualityScores(
      companies,
      mvvDataMap
    );

    // ポジショニングデータの生成（簡易版）
    const positioningData = await this.generatePositioningData(
      companies,
      mvvDataMap,
      companyInfoMap
    );

    // ワードクラウドデータの生成
    const wordCloudData = this.generateWordCloudData(
      companies,
      mvvDataMap
    );

    return {
      similarityMatrix,
      trendKeywords,
      qualityScores,
      positioningData,
      wordCloudData
    };
  }

  /**
   * AI分析シートを追加
   */
  async addAIAnalysisSheets(
    workbook: ExcelJS.Workbook,
    analysisData: AIAnalysisData
  ): Promise<void> {
    // 1. 類似企業マトリックスシート
    await this.addSimilarityMatrixSheet(workbook, analysisData.similarityMatrix);

    // 2. トレンド分析シート
    await this.addTrendAnalysisSheet(workbook, analysisData.trendKeywords);

    // 3. 品質スコア分析シート
    await this.addQualityScoreSheet(workbook, analysisData.qualityScores);

    // 4. 競合ポジショニングシート
    await this.addPositioningSheet(workbook, analysisData.positioningData);

    // 5. ワードクラウド分析シート
    await this.addWordCloudSheet(workbook, analysisData.wordCloudData);
  }

  /**
   * 類似企業マトリックスの生成
   */
  private async generateSimilarityMatrix(
    companies: Company[],
    mvvDataMap: Map<string, MVVData>
  ): Promise<SimilarityMatrixEntry[]> {
    const matrix: SimilarityMatrixEntry[] = [];
    
    // MVVデータがある企業のみ対象
    const companiesWithMVV = companies.filter(c => mvvDataMap.has(c.id));
    
    // 簡素化：最初の30社を取得
    const sortedCompanies = companiesWithMVV;

    // 上位30社程度で計算（パフォーマンスのため）
    const targetCompanies = sortedCompanies.slice(0, 30);

    for (const company of targetCompanies) {
      const mvv = mvvDataMap.get(company.id);
      if (!mvv) continue;

      // 簡易的な類似度計算（テキストベース）
      const similarities = this.calculateTextSimilarities(
        company,
        mvv,
        targetCompanies.filter(c => c.id !== company.id),
        mvvDataMap
      );

      matrix.push({
        companyName: company.name,
        category: company.category || '未分類',
        topSimilarCompanies: similarities.slice(0, 5).map(sim => ({
          name: sim.company.name,
          score: sim.similarity,
          category: sim.company.category || '未分類'
        }))
      });
    }

    return matrix;
  }

  /**
   * テキストベースの簡易類似度計算
   */
  private calculateTextSimilarities(
    _targetCompany: Company,
    targetMVV: MVVData,
    otherCompanies: Company[],
    mvvDataMap: Map<string, MVVData>
  ): Array<{ company: Company; similarity: number }> {
    const results: Array<{ company: Company; similarity: number }> = [];
    
    const targetText = [
      targetMVV.mission || '',
      targetMVV.vision || '',
      ...(targetMVV.values || [])
    ].join(' ').toLowerCase();
    
    const targetKeywords = new Set(
      enhancedSegmentationService.segmentWithCompounds(targetText, {
        preserveCompounds: true,
        enableCustomRules: true,
        industryFocus: 'general' as const
      }).segments.filter(w => w.length >= 2 && !/^[0-9]+$/.test(w) && !/^[ぁ-ん]+$/.test(w))
    );

    for (const company of otherCompanies) {
      const mvv = mvvDataMap.get(company.id);
      if (!mvv) continue;

      const text = [
        mvv.mission || '',
        mvv.vision || '',
        ...(mvv.values || [])
      ].join(' ').toLowerCase();
      
      const keywords = new Set(
        enhancedSegmentationService.segmentWithCompounds(text, {
          preserveCompounds: true,
          enableCustomRules: true,
          industryFocus: 'general' as const
        }).segments.filter(w => w.length >= 2 && !/^[0-9]+$/.test(w) && !/^[ぁ-ん]+$/.test(w))
      );

      // Jaccard similarity
      const intersection = new Set([...targetKeywords].filter(x => keywords.has(x)));
      const union = new Set([...targetKeywords, ...keywords]);
      const similarity = union.size > 0 ? intersection.size / union.size : 0;

      results.push({ company, similarity });
    }

    return results.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * トレンドキーワードの抽出
   */
  private async extractTrendKeywords(
    companies: Company[],
    mvvDataMap: Map<string, MVVData>
  ): Promise<TrendKeywordData[]> {
    const categoryKeywords = new Map<string, Map<string, { frequency: number; companies: Set<string> }>>();

    // カテゴリ別にキーワードを集計
    for (const company of companies) {
      const mvv = mvvDataMap.get(company.id);
      if (!mvv) continue;

      const category = company.category || '未分類';
      if (!categoryKeywords.has(category)) {
        categoryKeywords.set(category, new Map());
      }

      const categoryMap = categoryKeywords.get(category)!;

      // MVVテキストを結合して解析
      const text = [
        mvv.mission || '',
        mvv.vision || '',
        ...(mvv.values || [])
      ].join(' ');

      const segmentResult = enhancedSegmentationService.segmentWithCompounds(text, {
        preserveCompounds: true,
        enableCustomRules: true,
        industryFocus: 'general' as const
      });
      const keywords = segmentResult.segments.filter(token => 
        token.length >= 2 && 
        !['です', 'ます', 'である', 'として', 'により', 'という', 'こと', 'もの', 'ため', 'など'].includes(token) &&
        !/^[0-9]+$/.test(token) && // 数字のみ除外
        !/^[ぁ-ん]+$/.test(token)   // ひらがなのみ除外
      );

      for (const keyword of keywords) {
        if (!categoryMap.has(keyword)) {
          categoryMap.set(keyword, { frequency: 0, companies: new Set() });
        }
        const data = categoryMap.get(keyword)!;
        data.frequency++;
        data.companies.add(company.id);
      }
    }

    // 結果を整形
    const result: TrendKeywordData[] = [];
    for (const [category, keywordMap] of categoryKeywords) {
      const keywords = Array.from(keywordMap.entries())
        .map(([word, data]) => ({
          word,
          frequency: data.frequency,
          companyCount: data.companies.size
        }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10); // トップ10

      result.push({ category, keywords });
    }

    return result;
  }

  /**
   * 品質スコアの計算
   */
  private calculateQualityScores(
    companies: Company[],
    mvvDataMap: Map<string, MVVData>
  ): QualityScoreData[] {
    const scores: QualityScoreData[] = [];

    for (const company of companies) {
      const mvv = mvvDataMap.get(company.id);
      if (!mvv) continue;

      // 簡易的な品質スコア計算
      const missionScore = this.calculateTextQuality(mvv.mission);
      const visionScore = this.calculateTextQuality(mvv.vision);
      const valuesScore = mvv.values?.length ? 
        mvv.values.reduce((sum, v) => sum + this.calculateTextQuality(v), 0) / mvv.values.length : 0;

      scores.push({
        companyName: company.name,
        category: company.category || '未分類',
        missionScore,
        visionScore,
        valuesScore,
        overallScore: (missionScore + visionScore + valuesScore) / 3
      });
    }

    return scores.sort((a, b) => b.overallScore - a.overallScore);
  }

  /**
   * テキスト品質スコアの計算（簡易版）
   */
  private calculateTextQuality(text?: string | null): number {
    if (!text) return 0;
    
    let score = 0;
    
    // 長さ
    if (text.length > 20) score += 20;
    if (text.length > 50) score += 10;
    
    // 具体性（数字の含有）
    if (/\d/.test(text)) score += 15;
    
    // アクション指向（動詞の存在）
    if (/する|します|実現|創造|提供|貢献/.test(text)) score += 20;
    
    // 未来志向
    if (/未来|将来|成長|発展|革新/.test(text)) score += 15;
    
    // 価値提供
    if (/価値|顧客|社会|世界|地域/.test(text)) score += 20;
    
    return Math.min(score, 100);
  }

  /**
   * ポジショニングデータの生成（簡易MDS）
   */
  private async generatePositioningData(
    companies: Company[],
    mvvDataMap: Map<string, MVVData>,
    companyInfoMap: Map<string, CompanyInfo>
  ): Promise<PositioningData[]> {
    const positions: PositioningData[] = [];
    
    // 簡易的な2次元配置（実際のMDSは計算量が多いため）
    const companiesWithMVV = companies.filter(c => mvvDataMap.has(c.id));
    const angleStep = (2 * Math.PI) / companiesWithMVV.length;
    
    companiesWithMVV.forEach((company, index) => {
      const companyInfo = companyInfoMap.get(company.id);
      const employeeCount = companyInfo?.employeeCount || 100;
      
      // 円形配置にランダム性を加える
      const radius = 50 + Math.random() * 30;
      const angle = index * angleStep + (Math.random() - 0.5) * 0.3;
      
      positions.push({
        companyName: company.name,
        category: company.category || '未分類',
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
        size: Math.log10(employeeCount + 1) * 10
      });
    });
    
    return positions;
  }

  /**
   * ワードクラウドデータの生成
   */
  private generateWordCloudData(
    companies: Company[],
    mvvDataMap: Map<string, MVVData>
  ): WordCloudEntry[] {
    const wordFrequency = new Map<string, { count: number; categories: Set<string> }>();
    
    for (const company of companies) {
      const mvv = mvvDataMap.get(company.id);
      if (!mvv) continue;
      
      const text = [
        mvv.mission || '',
        mvv.vision || '',
        ...(mvv.values || [])
      ].join(' ');
      
      const segmentResult = enhancedSegmentationService.segmentWithCompounds(text, {
        preserveCompounds: true,
        enableCustomRules: true,
        industryFocus: 'general' as const
      });
      const keywords = segmentResult.segments.filter(token => 
        token.length >= 2 && 
        !['です', 'ます', 'である', 'として', 'により', 'という', 'こと', 'もの', 'ため', 'など'].includes(token) &&
        !/^[0-9]+$/.test(token) && // 数字のみ除外
        !/^[ぁ-ん]+$/.test(token)   // ひらがなのみ除外
      );
      
      for (const keyword of keywords) {
        if (!wordFrequency.has(keyword)) {
          wordFrequency.set(keyword, { count: 0, categories: new Set() });
        }
        const data = wordFrequency.get(keyword)!;
        data.count++;
        data.categories.add(company.category || '未分類');
      }
    }
    
    return Array.from(wordFrequency.entries())
      .map(([word, data]) => ({
        word,
        frequency: data.count,
        categories: Array.from(data.categories)
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 100); // トップ100
  }

  /**
   * 類似企業マトリックスシートの追加
   */
  private async addSimilarityMatrixSheet(
    workbook: ExcelJS.Workbook,
    data: SimilarityMatrixEntry[]
  ): Promise<void> {
    const sheet = workbook.addWorksheet('AI分析_類似企業マトリックス');
    
    // ヘッダー設定
    sheet.columns = [
      { header: '企業名', key: 'company', width: 30 },
      { header: '業界', key: 'category', width: 20 },
      { header: '類似企業1', key: 'similar1', width: 25 },
      { header: '類似度1', key: 'score1', width: 12 },
      { header: '類似企業2', key: 'similar2', width: 25 },
      { header: '類似度2', key: 'score2', width: 12 },
      { header: '類似企業3', key: 'similar3', width: 25 },
      { header: '類似度3', key: 'score3', width: 12 },
      { header: '類似企業4', key: 'similar4', width: 25 },
      { header: '類似度4', key: 'score4', width: 12 },
      { header: '類似企業5', key: 'similar5', width: 25 },
      { header: '類似度5', key: 'score5', width: 12 }
    ];
    
    // データ追加
    for (const entry of data) {
      const row: any = {
        company: entry.companyName,
        category: entry.category
      };
      
      entry.topSimilarCompanies.forEach((similar, index) => {
        row[`similar${index + 1}`] = similar.name;
        row[`score${index + 1}`] = similar.score;
      });
      
      sheet.addRow(row);
    }
    
    // スタイリング
    this.styleMatrixSheet(sheet);
  }

  /**
   * マトリックスシートのスタイリング
   */
  private styleMatrixSheet(sheet: ExcelJS.Worksheet): void {
    // ヘッダースタイル
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2E86AB' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;
    
    // 類似度セルに条件付き書式（ヒートマップ）
    const scoreColumns = ['D', 'F', 'H', 'J', 'L'];
    for (const col of scoreColumns) {
      for (let row = 2; row <= sheet.rowCount; row++) {
        const cell = sheet.getCell(`${col}${row}`);
        const value = cell.value as number;
        if (value) {
          cell.numFmt = '0.00';
          // スコアに応じて背景色を設定
          const intensity = Math.floor(value * 255);
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: `FF${intensity.toString(16).padStart(2, '0')}FF${intensity.toString(16).padStart(2, '0')}` }
          };
        }
      }
    }
    
    // 枠線
    sheet.eachRow((row, _rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });
    
    // ウィンドウ枠の固定
    sheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }];
  }

  /**
   * トレンド分析シートの追加
   */
  private async addTrendAnalysisSheet(
    workbook: ExcelJS.Workbook,
    data: TrendKeywordData[]
  ): Promise<void> {
    const sheet = workbook.addWorksheet('AI分析_業界トレンドキーワード');
    
    let currentRow = 1;
    
    for (const categoryData of data) {
      // カテゴリヘッダー
      sheet.mergeCells(currentRow, 1, currentRow, 4);
      const categoryCell = sheet.getCell(currentRow, 1);
      categoryCell.value = `【${categoryData.category}】`;
      categoryCell.font = { bold: true, size: 14 };
      categoryCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8F4F8' }
      };
      categoryCell.alignment = { vertical: 'middle', horizontal: 'center' };
      currentRow++;
      
      // サブヘッダー
      sheet.getCell(currentRow, 1).value = '順位';
      sheet.getCell(currentRow, 2).value = 'キーワード';
      sheet.getCell(currentRow, 3).value = '出現頻度';
      sheet.getCell(currentRow, 4).value = '企業数';
      
      const subHeaderRow = sheet.getRow(currentRow);
      subHeaderRow.font = { bold: true };
      subHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0F0F0' }
      };
      currentRow++;
      
      // データ追加
      categoryData.keywords.forEach((keyword, index) => {
        sheet.getCell(currentRow, 1).value = index + 1;
        sheet.getCell(currentRow, 2).value = keyword.word;
        sheet.getCell(currentRow, 3).value = keyword.frequency;
        sheet.getCell(currentRow, 4).value = keyword.companyCount;
        currentRow++;
      });
      
      currentRow++; // カテゴリ間のスペース
    }
    
    // 列幅調整
    sheet.getColumn(1).width = 10;
    sheet.getColumn(2).width = 25;
    sheet.getColumn(3).width = 15;
    sheet.getColumn(4).width = 15;
  }

  /**
   * 品質スコアシートの追加
   */
  private async addQualityScoreSheet(
    workbook: ExcelJS.Workbook,
    data: QualityScoreData[]
  ): Promise<void> {
    const sheet = workbook.addWorksheet('AI分析_MVV品質スコア');
    
    // ヘッダー設定
    sheet.columns = [
      { header: '順位', key: 'rank', width: 10 },
      { header: '企業名', key: 'company', width: 30 },
      { header: '業界', key: 'category', width: 20 },
      { header: 'Mission\nスコア', key: 'missionScore', width: 12 },
      { header: 'Vision\nスコア', key: 'visionScore', width: 12 },
      { header: 'Values\nスコア', key: 'valuesScore', width: 12 },
      { header: '総合\nスコア', key: 'overallScore', width: 12 }
    ];
    
    // データ追加
    data.forEach((item, index) => {
      sheet.addRow({
        rank: index + 1,
        company: item.companyName,
        category: item.category,
        missionScore: item.missionScore,
        visionScore: item.visionScore,
        valuesScore: item.valuesScore,
        overallScore: item.overallScore
      });
    });
    
    // スタイリング
    this.styleQualityScoreSheet(sheet);
  }

  /**
   * 品質スコアシートのスタイリング
   */
  private styleQualityScoreSheet(sheet: ExcelJS.Worksheet): void {
    // ヘッダースタイル
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4CAF50' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.height = 30;
    
    // スコアセルの書式設定と条件付き書式
    for (let row = 2; row <= sheet.rowCount; row++) {
      for (let col = 4; col <= 7; col++) {
        const cell = sheet.getCell(row, col);
        if (cell.value) {
          cell.numFmt = '0.0';
          const score = cell.value as number;
          
          // スコアに基づく色分け
          if (score >= 80) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFC8E6C9' } // 緑
            };
          } else if (score >= 60) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFF9C4' } // 黄
            };
          } else {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFCCBC' } // 赤
            };
          }
        }
      }
    }
    
    // 枠線とゼブラストライプ
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1 && rowNumber % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF5F5F5' }
        };
      }
      
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });
    
    // ウィンドウ枠の固定
    sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
  }

  /**
   * ポジショニングシートの追加
   */
  private async addPositioningSheet(
    workbook: ExcelJS.Workbook,
    data: PositioningData[]
  ): Promise<void> {
    const sheet = workbook.addWorksheet('AI分析_競合ポジショニング');
    
    // データテーブル
    sheet.columns = [
      { header: '企業名', key: 'company', width: 30 },
      { header: '業界', key: 'category', width: 20 },
      { header: 'X座標', key: 'x', width: 12 },
      { header: 'Y座標', key: 'y', width: 12 },
      { header: '規模', key: 'size', width: 12 }
    ];
    
    // データ追加
    data.forEach(item => {
      sheet.addRow({
        company: item.companyName,
        category: item.category,
        x: Math.round(item.x * 100) / 100,
        y: Math.round(item.y * 100) / 100,
        size: Math.round(item.size * 100) / 100
      });
    });
    
    // チャート説明を追加
    const explanationRow = sheet.rowCount + 3;
    sheet.mergeCells(explanationRow, 1, explanationRow, 5);
    const explanationCell = sheet.getCell(explanationRow, 1);
    explanationCell.value = '※ X/Y座標は企業間の相対的な位置関係を表し、規模は従業員数に基づきます';
    explanationCell.font = { italic: true, color: { argb: 'FF666666' } };
    
    // スタイリング
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF9C27B0' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  }

  /**
   * ワードクラウドシートの追加
   */
  private async addWordCloudSheet(
    workbook: ExcelJS.Workbook,
    data: WordCloudEntry[]
  ): Promise<void> {
    const sheet = workbook.addWorksheet('AI分析_キーワードクラウド');
    
    // ヘッダー設定
    sheet.columns = [
      { header: '順位', key: 'rank', width: 10 },
      { header: 'キーワード', key: 'word', width: 25 },
      { header: '出現頻度', key: 'frequency', width: 15 },
      { header: '出現業界', key: 'categories', width: 50 }
    ];
    
    // データ追加（トップ50）
    data.slice(0, 50).forEach((item, index) => {
      sheet.addRow({
        rank: index + 1,
        word: item.word,
        frequency: item.frequency,
        categories: item.categories.join(', ')
      });
    });
    
    // フォントサイズで頻度を表現
    for (let row = 2; row <= Math.min(sheet.rowCount, 11); row++) { // トップ10
      const wordCell = sheet.getCell(row, 2);
      const frequencyValue = sheet.getCell(row, 3).value as number;
      wordCell.font = {
        bold: true,
        size: Math.min(20, 10 + Math.floor(frequencyValue / 10))
      };
    }
    
    // スタイリング
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF5722' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    
    // 枠線
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });
  }
}

// シングルトンインスタンス
export const excelAIAnalysisProcessor = new ExcelAIAnalysisProcessor();
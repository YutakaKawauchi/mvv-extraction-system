/**
 * ExcelProcessor Service
 * 統合型プレミアムExcelレポートシステム
 * Phase 1: データエクスポート基盤
 */

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { Company, MVVData, CompanyInfo } from '../types';
import { formatDate } from '../utils/formatters';
import { excelAIAnalysisProcessor } from './excelAIAnalysisProcessor';

export interface ExcelReportOptions {
  includeExecutiveSummary?: boolean;
  includeMVVPivot?: boolean;
  includeMVVDetail?: boolean;
  includeCompanyMaster?: boolean;
  includeDetailedProfiles?: boolean;
  includeVisualAnalytics?: boolean; // Phase 2 機能
  includeAIAnalysis?: boolean; // AI分析シート
  
  // フィルター・オプション
  selectedCategories?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  dataQualityFilter?: 'all' | 'high' | 'medium';
  
  // 外観オプション
  corporateTheme?: 'default' | 'professional' | 'modern';
  includeCharts?: boolean;
  highResolution?: boolean;
}

export interface ReportMetadata {
  generatedAt: Date;
  totalCompanies: number;
  mvvCompletedCompanies: number;
  categories: string[];
  dataQualityStats: {
    high: number;
    medium: number;
    low: number;
  };
}

export class ExcelProcessor {
  private workbook: ExcelJS.Workbook;
  private options: ExcelReportOptions;
  private metadata!: ReportMetadata;

  constructor(options: ExcelReportOptions = {}) {
    this.workbook = new ExcelJS.Workbook();
    this.options = {
      includeExecutiveSummary: true,
      includeMVVPivot: true,
      includeMVVDetail: true,
      includeCompanyMaster: true,
      includeDetailedProfiles: true,
      includeVisualAnalytics: false, // Phase 2
      includeAIAnalysis: true, // AI分析シート
      corporateTheme: 'professional',
      includeCharts: true,
      highResolution: true,
      ...options
    };
    
    this.setupWorkbookProperties();
  }

  /**
   * メインエクスポート関数
   */
  public async generatePremiumReport(
    companies: Company[],
    mvvDataMap: Map<string, MVVData>,
    companyInfoMap?: Map<string, CompanyInfo>
  ): Promise<void> {
    console.log('🚀 プレミアムExcelレポート生成開始...');
    const startTime = performance.now();

    // メタデータ計算
    this.metadata = this.calculateMetadata(companies, mvvDataMap);
    
    try {
      // Phase 1: 基本データシート生成
      if (this.options.includeExecutiveSummary) {
        await this.generateExecutiveSummary(companies, mvvDataMap);
      }
      
      if (this.options.includeMVVPivot) {
        await this.generateMVVAnalysisSimple(companies, mvvDataMap);
      }
      
      if (this.options.includeMVVDetail && companyInfoMap) {
        await this.generateMVVAnalysisDetail(companies, mvvDataMap, companyInfoMap);
      }
      
      if (this.options.includeCompanyMaster) {
        await this.generateCompanyMasterData(companies);
      }
      
      if (this.options.includeDetailedProfiles && companyInfoMap) {
        await this.generateCompanyDetailedProfiles(companies, companyInfoMap, mvvDataMap);
      }
      

      // Phase 2: AI分析シート
      if (this.options.includeAIAnalysis && companyInfoMap) {
        console.log('🤖 AI分析シート生成中...');
        const aiAnalysisData = await excelAIAnalysisProcessor.collectAIAnalysisData(
          companies,
          mvvDataMap,
          companyInfoMap,
          this.options.includeVisualAnalytics // 保存済みスクリーンショット使用
        );
        await excelAIAnalysisProcessor.addAIAnalysisSheets(this.workbook, aiAnalysisData);
      }

      // Excel ファイルをダウンロード
      await this.downloadWorkbook();

      const endTime = performance.now();
      console.log(`✅ プレミアムExcelレポート生成完了 (${Math.round(endTime - startTime)}ms)`);
      
    } catch (error) {
      console.error('❌ Excelレポート生成エラー:', error);
      throw new Error(`Excelレポート生成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * ワークブック基本設定
   */
  private setupWorkbookProperties(): void {
    this.workbook.creator = 'MVV Extraction System';
    this.workbook.lastModifiedBy = 'MVV Analysis Engine';
    this.workbook.created = new Date();
    this.workbook.modified = new Date();
    this.workbook.properties.date1904 = false;
    
    // Corporate theme application
    this.workbook.views = [
      {
        x: 0, y: 0, width: 10000, height: 20000,
        firstSheet: 0, activeTab: 0, visibility: 'visible'
      }
    ];
  }

  /**
   * メタデータ計算
   */
  private calculateMetadata(
    companies: Company[],
    mvvDataMap: Map<string, MVVData>
  ): ReportMetadata {
    const mvvCompletedCompanies = companies.filter(c => mvvDataMap.has(c.id)).length;
    const categories = [...new Set(companies.map(c => c.category).filter(Boolean))] as string[];
    
    // データ品質統計
    const qualityStats = { high: 0, medium: 0, low: 0 };
    mvvDataMap.forEach(mvv => {
      const avgConfidence = (
        mvv.confidenceScores.mission + 
        mvv.confidenceScores.vision + 
        mvv.confidenceScores.values
      ) / 3;
      
      if (avgConfidence >= 0.8) qualityStats.high++;
      else if (avgConfidence >= 0.6) qualityStats.medium++;
      else qualityStats.low++;
    });

    return {
      generatedAt: new Date(),
      totalCompanies: companies.length,
      mvvCompletedCompanies,
      categories,
      dataQualityStats: qualityStats
    };
  }

  /**
   * 1. Executive Summary Sheet
   */
  private async generateExecutiveSummary(
    companies: Company[],
    mvvDataMap: Map<string, MVVData>
  ): Promise<void> {
    console.log('📊 Executive Summary シート生成中...');
    
    const worksheet = this.workbook.addWorksheet('Executive Summary', {
      properties: { tabColor: { argb: 'FF1F4E79' } }
    });

    // ヘッダー設定
    worksheet.getRow(1).height = 30;
    worksheet.mergeCells('A1:F1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'MVV分析レポート - Executive Summary';
    titleCell.font = { name: 'Arial', size: 18, bold: true, color: { argb: 'FF1F4E79' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // サマリー統計
    let row = 3;
    const summaryData = [
      ['生成日時', formatDate(this.metadata.generatedAt)],
      ['総企業数', this.metadata.totalCompanies],
      ['MVV抽出完了企業数', this.metadata.mvvCompletedCompanies],
      ['MVV完成率', `${Math.round((this.metadata.mvvCompletedCompanies / this.metadata.totalCompanies) * 100)}%`],
      ['対象業界数', this.metadata.categories.length],
      ['高品質データ企業数', this.metadata.dataQualityStats.high],
      ['中品質データ企業数', this.metadata.dataQualityStats.medium],
      ['低品質データ企業数', this.metadata.dataQualityStats.low],
    ];

    summaryData.forEach(([label, value]) => {
      worksheet.getCell(`A${row}`).value = label;
      worksheet.getCell(`B${row}`).value = value;
      worksheet.getCell(`A${row}`).font = { bold: true };
      row++;
    });

    // 業界別統計
    row += 2;
    worksheet.getCell(`A${row}`).value = '業界別統計';
    worksheet.getCell(`A${row}`).font = { bold: true, size: 14 };
    row++;

    const categoryStats = this.calculateCategoryStats(companies, mvvDataMap);
    worksheet.getCell(`A${row}`).value = '業界';
    worksheet.getCell(`B${row}`).value = '企業数';
    worksheet.getCell(`C${row}`).value = 'MVV完成数';
    worksheet.getCell(`D${row}`).value = '完成率';
    
    const headerRow = worksheet.getRow(row);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE7F3FF' }
    };
    row++;

    categoryStats.forEach(stat => {
      worksheet.getCell(`A${row}`).value = stat.category;
      worksheet.getCell(`B${row}`).value = stat.totalCompanies;
      worksheet.getCell(`C${row}`).value = stat.mvvCompletedCompanies;
      worksheet.getCell(`D${row}`).value = `${Math.round(stat.completionRate * 100)}%`;
      row++;
    });

    // 列幅調整
    worksheet.getColumn('A').width = 25;
    worksheet.getColumn('B').width = 15;
    worksheet.getColumn('C').width = 15;
    worksheet.getColumn('D').width = 15;

    this.applyThemeToWorksheet(worksheet);
  }

  /**
   * 2. MVV Analysis (Simple) Sheet
   */
  private async generateMVVAnalysisSimple(
    companies: Company[],
    mvvDataMap: Map<string, MVVData>
  ): Promise<void> {
    console.log('📈 MVV Analysis (Simple) シート生成中...');
    
    const worksheet = this.workbook.addWorksheet('MVV Analysis (Simple)', {
      properties: { tabColor: { argb: 'FF2E8B57' } }
    });

    // ヘッダー
    const headers = [
      'No', '企業名', '業界',
      'Mission', 'Vision', 'Values',
      'Mission信頼度', 'Vision信頼度', 'Values信頼度',
      '平均信頼度', '調査日', '出典URL', 'ID'
    ];

    headers.forEach((header, index) => {
      const cell = worksheet.getCell(1, index + 1);
      cell.value = header;
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2E8B57' }
      };
      cell.font.color = { argb: 'FFFFFFFF' };
    });

    // データ行
    let row = 2;
    companies.forEach((company, index) => {
      const mvv = mvvDataMap.get(company.id);
      const avgConfidence = mvv ? (
        mvv.confidenceScores.mission + 
        mvv.confidenceScores.vision + 
        mvv.confidenceScores.values
      ) / 3 : 0;

      const rowData = [
        index + 1, // No（1から開始）
        company.name,
        company.category || '未分類',
        mvv?.mission || '',
        mvv?.vision || '',
        mvv?.values.join('; ') || '',
        mvv?.confidenceScores.mission || '',
        mvv?.confidenceScores.vision || '',
        mvv?.confidenceScores.values || '',
        avgConfidence ? Math.round(avgConfidence * 100) / 100 : '',
        mvv ? formatDate(mvv.extractedAt) : '',
        mvv?.extractedFrom || '',
        company.id // ID（最後）
      ];

      rowData.forEach((value, index) => {
        const cell = worksheet.getCell(row, index + 1);
        cell.value = value;
        
        // 条件付き書式（信頼度による色分け）
        if (index >= 6 && index <= 9 && typeof value === 'number') {
          if (value >= 0.8) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFE8F5E8' }
            };
          } else if (value >= 0.6) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFF3CD' }
            };
          } else if (value > 0) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFEEF0' }
            };
          }
        }
      });
      row++;
    });

    // 列幅調整
    worksheet.columns.forEach((column, index) => {
      if (index === 0) column.width = 8; // No
      else if (index === 1) column.width = 25; // 企業名
      else if (index === 3 || index === 4) column.width = 40; // Mission, Vision
      else if (index === 5) column.width = 50; // Values
      else if (index === 12) column.width = 15; // ID
      else column.width = 15;
    });

    // ウィンドウ枠の固定（No + 企業名まで固定）
    worksheet.views = [
      { state: 'frozen', xSplit: 2, ySplit: 1 }
    ];

    // オートフィルター設定（テーブルの代わりに使用）
    if (row > 1) {
      worksheet.autoFilter = {
        from: 'A1',
        to: `${String.fromCharCode(65 + headers.length - 1)}${row - 1}`
      };
    }

    this.applyThemeToWorksheet(worksheet);
  }

  /**
   * 3. MVV Analysis (Detail) Sheet - MVV + Company Info結合
   */
  private async generateMVVAnalysisDetail(
    companies: Company[],
    mvvDataMap: Map<string, MVVData>,
    companyInfoMap: Map<string, CompanyInfo>
  ): Promise<void> {
    console.log('📊 MVV Analysis (Detail) シート生成中...');
    
    const worksheet = this.workbook.addWorksheet('MVV Analysis (Detail)', {
      properties: { tabColor: { argb: 'FF6B46C1' } }
    });

    // ヘッダー - MVV情報 + 主要企業情報
    const headers = [
      // 基本情報
      'No', '企業名', 'JSIC大分類', 'JSIC中分類', '設立年', '従業員数', '都道府県',
      // MVV情報
      'Mission', 'Vision', 'Values',
      'Mission信頼度', 'Vision信頼度', 'Values信頼度', '平均信頼度',
      // 財務情報
      '売上高(百万円)', '営業利益(百万円)', '純利益(百万円)',
      // 事業情報
      '事業セグメント', '主要製品・サービス', '海外売上比率(%)',
      // 上場情報
      '上場市場', '証券コード',
      // 産業分類
      'JSIC小分類',
      // 競合・ポジション
      '主要競合企業', '業界ポジション',
      // メタ情報
      '調査日', '出典URL', 'ID'
    ];

    // ヘッダー行
    headers.forEach((header, index) => {
      const cell = worksheet.getCell(1, index + 1);
      cell.value = header;
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF6B46C1' }
      };
      cell.font.color = { argb: 'FFFFFFFF' };
      
      // テキスト折り返し設定が必要なヘッダー列
      if (index === 7 || index === 8 || index === 9 || // Mission, Vision, Values
          index === 17 || index === 18 || // 事業セグメント、主要製品・サービス
          index === 23 || index === 24) { // 主要競合企業、業界ポジション
        cell.alignment = {
          wrapText: true,
          vertical: 'middle',
          horizontal: 'center'
        };
      }
    });

    // データ行
    let row = 2;
    companies.forEach((company, index) => {
      const mvv = mvvDataMap.get(company.id);
      const companyInfo = companyInfoMap.get(company.id);
      const avgConfidence = mvv ? (
        mvv.confidenceScores.mission + 
        mvv.confidenceScores.vision + 
        mvv.confidenceScores.values
      ) / 3 : 0;

      const rowData = [
        // 基本情報
        index + 1, // No（1から開始）
        company.name,
        companyInfo?.industryClassification?.jsicMajorName || '',
        companyInfo?.industryClassification?.jsicMiddleName || '',
        companyInfo?.foundedYear || '',
        companyInfo?.employeeCount || '',
        companyInfo?.prefecture || '',
        // MVV情報
        mvv?.mission || '',
        mvv?.vision || '',
        mvv?.values.join('; ') || '',
        mvv?.confidenceScores.mission || '',
        mvv?.confidenceScores.vision || '',
        mvv?.confidenceScores.values || '',
        avgConfidence ? Math.round(avgConfidence * 100) / 100 : '',
        // 財務情報
        companyInfo?.revenue || '',
        companyInfo?.operatingProfit || '',
        companyInfo?.netProfit || '',
        // 事業情報
        companyInfo?.businessSegments?.join('; ') || '',
        companyInfo?.mainProducts?.join('; ') || '',
        companyInfo?.overseasRevenueRatio || '',
        // 上場情報
        companyInfo?.stockExchange || '',
        companyInfo?.stockCode || '',
        // 産業分類
        companyInfo?.industryClassification?.jsicMinorName || '',
        // 競合・ポジション
        companyInfo?.mainCompetitors?.join('; ') || '',
        companyInfo?.industryPosition || '',
        // メタ情報
        mvv ? formatDate(mvv.extractedAt) : '',
        mvv?.extractedFrom || '',
        company.id // ID（最後）
      ];

      rowData.forEach((value, index) => {
        const cell = worksheet.getCell(row, index + 1);
        cell.value = value;
        
        // テキスト折り返し設定（MVV列 + 事業情報列）
        if (index === 7 || index === 8 || index === 9 || // Mission, Vision, Values
            index === 17 || index === 18 || // 事業セグメント、主要製品・サービス
            index === 23 || index === 24) { // 主要競合企業、業界ポジション
          cell.alignment = {
            wrapText: true,
            vertical: 'top',
            horizontal: 'left'
          };
        }
        
        // 信頼度による色分け（MVV信頼度列）
        if (index >= 9 && index <= 12 && typeof value === 'number') {
          if (value >= 0.8) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFE8F5E8' }
            };
          } else if (value >= 0.6) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFF3CD' }
            };
          } else if (value > 0) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFEEF0' }
            };
          }
        }
      });
      
      // 折り返し対象列がある行の高さを調整（内容に応じて自動調整）
      const currentRow = worksheet.getRow(row);
      const wrapTextCells = [
        currentRow.getCell(8), // Mission
        currentRow.getCell(9), // Vision  
        currentRow.getCell(10), // Values
        currentRow.getCell(18), // 事業セグメント
        currentRow.getCell(19), // 主要製品・サービス
        currentRow.getCell(24), // 主要競合企業
        currentRow.getCell(25)  // 業界ポジション
      ];
      
      // 折り返し対象列に長いコンテンツがある場合、行の高さを調整
      const hasLongContent = wrapTextCells.some(cell => cell.value && String(cell.value).length > 50);
      if (hasLongContent) {
        currentRow.height = 60; // 長いコンテンツがある場合は高さを60に設定
      }
      
      row++;
    });

    // 列幅調整
    worksheet.columns.forEach((column, index) => {
      if (index === 0) column.width = 8; // No
      else if (index === 1) column.width = 25; // 企業名
      else if (index === 2 || index === 3) column.width = 20; // JSIC大分類、中分類
      else if (index === 7 || index === 8) column.width = 40; // Mission, Vision
      else if (index === 9) column.width = 50; // Values
      else if (index === 17 || index === 18) column.width = 35; // 事業セグメント、主要製品・サービス（折り返し対応で幅拡大）
      else if (index === 23 || index === 24) column.width = 35; // 主要競合企業、業界ポジション（折り返し対応で幅拡大）
      else if (index === 25) column.width = 10; // 調査日（さらに幅縮小）
      else if (index === 27) column.width = 15; // ID
      else column.width = 15;
    });

    // ウィンドウ枠の固定（No + 企業名まで固定）
    worksheet.views = [
      { state: 'frozen', xSplit: 2, ySplit: 1 }
    ];

    // オートフィルター設定（全ての列にフィルター適用）
    if (row > 1) {
      // より確実な列文字計算（AB、AC等の2文字列にも対応）
      const lastColumnIndex = headers.length - 1;
      let lastColumn;
      if (lastColumnIndex < 26) {
        lastColumn = String.fromCharCode(65 + lastColumnIndex);
      } else {
        const firstChar = String.fromCharCode(64 + Math.floor(lastColumnIndex / 26));
        const secondChar = String.fromCharCode(65 + (lastColumnIndex % 26));
        lastColumn = firstChar + secondChar;
      }
      
      // フィルター範囲の設定（直接的な方法）
      worksheet.autoFilter = `A1:${lastColumn}${row - 1}`;
      
      // 代替方法も試行
      try {
        worksheet.autoFilter = {
          from: 'A1',
          to: `${lastColumn}${row - 1}`
        };
      } catch (error) {
        console.warn('MVV Analysis (Detail) 代替方法:', error);
      }
      
      // フィルターの適用確認（詳細ログ）
      console.log(`MVV Analysis (Detail): フィルター設定`);
      console.log(`- ヘッダー数: ${headers.length}`);
      console.log(`- データ行数: ${row - 1}`);
      console.log(`- 最終列: ${lastColumn} (${headers.length}列目)`);
      console.log(`- フィルター範囲: A1:${lastColumn}${row - 1}`);
      
      // ヘッダー行のスタイル強化（フィルターボタンの視認性向上）
      worksheet.getRow(1).height = 25;
      worksheet.getRow(1).eachCell((cell, colNumber) => {
        if (colNumber <= headers.length) {
          cell.font = { ...cell.font, bold: true };
          cell.border = {
            ...cell.border,
            bottom: { style: 'medium', color: { argb: 'FF000000' } }
          };
        }
      });
    }

    this.applyThemeToWorksheet(worksheet);
  }

  /**
   * 4. Company Master Data Sheet
   */
  private async generateCompanyMasterData(companies: Company[]): Promise<void> {
    console.log('🏢 Company Master Data シート生成中...');
    
    const worksheet = this.workbook.addWorksheet('Company Master Data', {
      properties: { tabColor: { argb: 'FFFF6B35' } }
    });

    const headers = [
      'No', '企業名', 'ウェブサイト', '業界カテゴリー',
      '備考', '作成日', '更新日', '最終処理日', 'エラーメッセージ', 'ID'
    ];

    // ヘッダー行
    headers.forEach((header, index) => {
      const cell = worksheet.getCell(1, index + 1);
      cell.value = header;
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFF6B35' }
      };
      cell.font.color = { argb: 'FFFFFFFF' };
    });

    // データ行
    let row = 2;
    companies.forEach((company, index) => {
      const rowData = [
        index + 1, // No（1から開始）
        company.name,
        company.website,
        company.category || '未分類',
        company.notes || '',
        formatDate(company.createdAt),
        formatDate(company.updatedAt),
        company.lastProcessed ? formatDate(company.lastProcessed) : '',
        company.errorMessage || '',
        company.id // ID（最後）
      ];

      rowData.forEach((value, index) => {
        worksheet.getCell(row, index + 1).value = value;
      });
      row++;
    });

    // 列幅調整
    worksheet.getColumn('A').width = 8; // No
    worksheet.getColumn('B').width = 30; // 企業名
    worksheet.getColumn('C').width = 40; // ウェブサイト
    worksheet.getColumn('D').width = 20; // カテゴリー
    worksheet.getColumn('E').width = 30; // 備考
    worksheet.getColumn('F').width = 15; // 作成日
    worksheet.getColumn('G').width = 15; // 更新日
    worksheet.getColumn('H').width = 15; // 最終処理日
    worksheet.getColumn('I').width = 30; // エラーメッセージ
    worksheet.getColumn('J').width = 15; // ID

    // ウィンドウ枠の固定（No + 企業名まで固定）
    worksheet.views = [
      { state: 'frozen', xSplit: 2, ySplit: 1 }
    ];

    // オートフィルター設定（テーブルの代わりに使用）
    if (row > 1) {
      worksheet.autoFilter = {
        from: 'A1',
        to: `J${row - 1}`
      };
    }

    this.applyThemeToWorksheet(worksheet);
  }

  /**
   * 5. Company Detailed Profiles Sheet
   */
  private async generateCompanyDetailedProfiles(
    companies: Company[],
    companyInfoMap: Map<string, CompanyInfo>,
    mvvDataMap: Map<string, MVVData>
  ): Promise<void> {
    console.log('💼 Company Detailed Profiles シート生成中...');
    
    const worksheet = this.workbook.addWorksheet('Company Detailed Profiles', {
      properties: { tabColor: { argb: 'FF8E44AD' } }
    });

    const headers = [
      // 基本情報
      'No', '企業名', '設立年', '従業員数', '本社所在地', '都道府県',
      // 財務情報
      '売上高(百万円)', '売上年度', '営業利益(百万円)', '純利益(百万円)', '時価総額(百万円)',
      // 事業情報
      '事業セグメント', '主要製品・サービス', '市場シェア(%)', '海外売上比率(%)',
      // 上場情報
      '上場ステータス', '証券コード', '上場市場',
      // 組織情報
      '平均年齢', '平均勤続年数', '女性管理職比率(%)', '新卒採用数',
      // ESG情報
      'ESGスコア', 'CO2削減目標', '社会貢献活動',
      // 競合情報
      '主要競合企業', '業界ポジション', '競争優位性',
      // 産業分類
      'JSIC大分類コード', 'JSIC大分類名', 'JSIC中分類コード', 'JSIC中分類名',
      'JSIC小分類コード', 'JSIC小分類名', '主業界', '業種',
      // MVV情報
      'MVVステータス', 'MVV平均信頼度',
      // メタ情報
      'データ信頼度', '最終更新日', 'データソース', 'ID'
    ];

    // ヘッダー行
    headers.forEach((header, index) => {
      const cell = worksheet.getCell(1, index + 1);
      cell.value = header;
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF8E44AD' }
      };
      cell.font.color = { argb: 'FFFFFFFF' };
    });

    // データ行
    let row = 2;
    companies.forEach((company, index) => {
      const companyInfo = companyInfoMap.get(company.id);
      const mvv = mvvDataMap.get(company.id);
      const avgMVVConfidence = mvv ? (
        mvv.confidenceScores.mission + 
        mvv.confidenceScores.vision + 
        mvv.confidenceScores.values
      ) / 3 : 0;

      const rowData = [
        // 基本情報
        index + 1, // No（1から開始）
        company.name,
        companyInfo?.foundedYear || '',
        companyInfo?.employeeCount || '',
        companyInfo?.headquartersLocation || '',
        companyInfo?.prefecture || '',
        // 財務情報
        companyInfo?.revenue || '',
        companyInfo?.revenueYear || '',
        companyInfo?.operatingProfit || '',
        companyInfo?.netProfit || '',
        companyInfo?.marketCap || '',
        // 事業情報
        companyInfo?.businessSegments?.join('; ') || '',
        companyInfo?.mainProducts?.join('; ') || '',
        companyInfo?.marketShare || '',
        companyInfo?.overseasRevenueRatio || '',
        // 上場情報
        companyInfo?.listingStatus || '',
        companyInfo?.stockCode || '',
        companyInfo?.stockExchange || '',
        // 組織情報
        companyInfo?.averageAge || '',
        companyInfo?.averageTenure || '',
        companyInfo?.femaleManagerRatio || '',
        companyInfo?.newGraduateHires || '',
        // ESG情報
        companyInfo?.esgScore || '',
        companyInfo?.co2ReductionTarget || '',
        companyInfo?.socialContribution || '',
        // 競合情報
        companyInfo?.mainCompetitors?.join('; ') || '',
        companyInfo?.industryPosition || '',
        companyInfo?.competitiveAdvantages?.join('; ') || '',
        // 産業分類
        companyInfo?.industryClassification?.jsicMajorCategory || '',
        companyInfo?.industryClassification?.jsicMajorName || '',
        companyInfo?.industryClassification?.jsicMiddleCategory || '',
        companyInfo?.industryClassification?.jsicMiddleName || '',
        companyInfo?.industryClassification?.jsicMinorCategory || '',
        companyInfo?.industryClassification?.jsicMinorName || '',
        companyInfo?.industryClassification?.primaryIndustry || '',
        companyInfo?.industryClassification?.businessType || '',
        // MVV情報
        mvv ? 'MVV抽出済み' : '未抽出',
        avgMVVConfidence ? Math.round(avgMVVConfidence * 100) / 100 : '',
        // メタ情報
        companyInfo?.dataConfidenceScore || '',
        companyInfo ? formatDate(companyInfo.lastUpdated) : '',
        companyInfo?.dataSourceUrls.join('; ') || '',
        company.id // ID（最後）
      ];

      rowData.forEach((value, index) => {
        worksheet.getCell(row, index + 1).value = value;
      });
      row++;
    });

    // 列幅調整（簡易版）
    worksheet.columns.forEach((column, index) => {
      if (index === 0) column.width = 8; // No
      else if (index === 1) column.width = 25; // 企業名
      else if (index >= 11 && index <= 13) column.width = 30; // 事業セグメント等
      else if (index === headers.length - 1) column.width = 15; // ID（最後）
      else column.width = 15;
    });

    // ウィンドウ枠の固定（No + 企業名まで固定）
    worksheet.views = [
      { state: 'frozen', xSplit: 2, ySplit: 1 }
    ];

    // オートフィルター設定（全ての列にフィルター適用）
    if (row > 1) {
      // より確実な列文字計算（AB、AC等の2文字列にも対応）
      const lastColumnIndex = headers.length - 1;
      let lastColumn;
      if (lastColumnIndex < 26) {
        lastColumn = String.fromCharCode(65 + lastColumnIndex);
      } else {
        const firstChar = String.fromCharCode(64 + Math.floor(lastColumnIndex / 26));
        const secondChar = String.fromCharCode(65 + (lastColumnIndex % 26));
        lastColumn = firstChar + secondChar;
      }
      
      // フィルター範囲の設定（直接的な方法）
      worksheet.autoFilter = `A1:${lastColumn}${row - 1}`;
      
      // 代替方法も試行
      try {
        worksheet.autoFilter = {
          from: 'A1',
          to: `${lastColumn}${row - 1}`
        };
      } catch (error) {
        console.warn('Company Detailed Profiles 代替方法:', error);
      }
      
      // フィルターの適用確認（詳細ログ）
      console.log(`Company Detailed Profiles: フィルター設定`);
      console.log(`- ヘッダー数: ${headers.length}`);
      console.log(`- データ行数: ${row - 1}`);
      console.log(`- 最終列: ${lastColumn} (${headers.length}列目)`);
      console.log(`- フィルター範囲: A1:${lastColumn}${row - 1}`);
      
      // ヘッダー行のスタイル強化（フィルターボタンの視認性向上）
      worksheet.getRow(1).height = 25;
      worksheet.getRow(1).eachCell((cell, colNumber) => {
        if (colNumber <= headers.length) {
          cell.font = { ...cell.font, bold: true };
          cell.border = {
            ...cell.border,
            bottom: { style: 'medium', color: { argb: 'FF000000' } }
          };
        }
      });
    }

    this.applyThemeToWorksheet(worksheet);
  }


  /**
   * ユーティリティ: 業界別統計計算
   */
  private calculateCategoryStats(
    companies: Company[],
    mvvDataMap: Map<string, MVVData>
  ): Array<{
    category: string;
    totalCompanies: number;
    mvvCompletedCompanies: number;
    completionRate: number;
  }> {
    const categoryMap = new Map<string, { total: number; mvvCompleted: number }>();

    companies.forEach(company => {
      const category = company.category || '未分類';
      const current = categoryMap.get(category) || { total: 0, mvvCompleted: 0 };
      
      current.total++;
      if (mvvDataMap.has(company.id)) {
        current.mvvCompleted++;
      }
      
      categoryMap.set(category, current);
    });

    return Array.from(categoryMap.entries()).map(([category, stats]) => ({
      category,
      totalCompanies: stats.total,
      mvvCompletedCompanies: stats.mvvCompleted,
      completionRate: stats.mvvCompleted / stats.total
    })).sort((a, b) => b.totalCompanies - a.totalCompanies);
  }

  /**
   * テーマ適用
   */
  private applyThemeToWorksheet(worksheet: ExcelJS.Worksheet): void {
    // プロフェッショナルテーマの適用
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        // ヘッダー行の強化
        row.eachCell(cell => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'medium', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
          };
        });
        return;
      }
      
      // データ行の縞模様効果
      const isEvenRow = rowNumber % 2 === 0;
      row.eachCell(cell => {
        const hasFill = cell.fill && cell.fill.type === 'pattern' && (cell.fill as any).fgColor;
        if (!hasFill) {
          // 縞模様の背景色
          if (isEvenRow) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF8F9FA' }
            };
          }
          
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
          };
        }
      });
    });
  }

  /**
   * ワークブックダウンロード
   */
  private async downloadWorkbook(): Promise<void> {
    const buffer = await this.workbook.xlsx.writeBuffer();
    const filename = `MVV_Analysis_Report_${formatDate(new Date()).replace(/[/:]/g, '-')}.xlsx`;
    
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    
    saveAs(blob, filename);
  }

  /**
   * 静的ユーティリティ: 簡易エクスポート
   */
  public static async generateBasicExport(
    companies: Company[],
    mvvDataMap: Map<string, MVVData>
  ): Promise<void> {
    const processor = new ExcelProcessor({
      includeExecutiveSummary: true,
      includeMVVPivot: true,
      includeCompanyMaster: true,
      includeDetailedProfiles: false // CompanyInfoが無い場合はスキップ
    });

    await processor.generatePremiumReport(companies, mvvDataMap);
  }
}
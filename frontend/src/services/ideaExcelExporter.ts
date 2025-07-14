/**
 * IdeaExcelExporter Service
 * 保存済みビジネスアイデア専用Excel出力システム
 * 美しいリーンキャンバスレイアウトに特化
 */

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { StoredBusinessIdea } from './ideaStorage';

export interface IdeaExportOptions {
  includeIdeasSummary?: boolean;
  includeLeanCanvasGallery?: boolean;
  includeAIVerificationReport?: boolean;
  includeFeasibilityDashboard?: boolean;
  includeActionPlan?: boolean;
  
  // フィルター・範囲オプション
  exportScope?: 'all' | 'filtered' | 'selected';
  selectedIds?: string[];
  includeOnlyVerified?: boolean;
  includeOnlyStarred?: boolean;
  
  // レイアウトオプション
  optimizeForPrint?: boolean; // A4印刷最適化: ページ設定、マージン調整、セル高さ最適化
}

export interface ExportMetadata {
  exportedAt: Date;
  totalIdeas: number;
  verifiedIdeas: number;
  starredIdeas: number;
  companies: string[];
}

// プロフェッショナルテーマ（固定）
const PROFESSIONAL_THEME = {
  primary: '#1e3a8a',     // ディープブルー
  secondary: '#64748b',   // スレートグレー
  accent: '#0ea5e9',      // スカイブルー
  success: '#059669',     // エメラルド
  warning: '#d97706',     // アンバー
  danger: '#dc2626',      // レッド
};

// リーンキャンバス9ブロックの色定義
const LEAN_CANVAS_COLORS = {
  problem: { bg: '#f1f5f9', border: '#64748b', text: '#334155' },          // スレートグレー
  solution: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },         // ブルー
  valueProposition: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' }, // アンバー
  unfairAdvantage: { bg: '#e0e7ff', border: '#6366f1', text: '#3730a3' },  // インディゴ
  customerSegments: { bg: '#d1fae5', border: '#10b981', text: '#065f46' }, // エメラルド
  channels: { bg: '#ede9fe', border: '#8b5cf6', text: '#5b21b6' },         // バイオレット
  keyMetrics: { bg: '#ccfbf1', border: '#14b8a6', text: '#0f766e' },       // ティール
  costStructure: { bg: '#fce7f3', border: '#ec4899', text: '#be185d' },    // ピンク
  revenueStreams: { bg: '#dcfce7', border: '#22c55e', text: '#15803d' },   // グリーン
};

export class IdeaExcelExporter {
  private workbook: ExcelJS.Workbook;
  private options: IdeaExportOptions;
  private theme = PROFESSIONAL_THEME;

  constructor(options: IdeaExportOptions) {
    this.workbook = new ExcelJS.Workbook();
    this.options = {
      includeIdeasSummary: true,
      includeLeanCanvasGallery: true,
      includeAIVerificationReport: true,
      includeFeasibilityDashboard: true,
      includeActionPlan: true,
      exportScope: 'all',
      optimizeForPrint: true,
      ...options
    };
    this.initializeWorkbook();
  }

  private initializeWorkbook(): void {
    this.workbook.creator = 'MVV Extraction System';
    this.workbook.lastModifiedBy = 'Business Innovation Lab';
    this.workbook.created = new Date();
    this.workbook.modified = new Date();
    this.workbook.lastPrinted = new Date();

    // 共通スタイル定義
    this.workbook.views = [{
      x: 0, y: 0, width: 10000, height: 20000,
      firstSheet: 0, activeTab: 0, visibility: 'visible'
    }];
  }

  /**
   * メイン出力メソッド
   */
  async exportIdeas(ideas: StoredBusinessIdea[]): Promise<void> {
    try {
      // フィルタリング
      const filteredIdeas = this.filterIdeas(ideas);
      
      if (filteredIdeas.length === 0) {
        throw new Error('出力するアイデアがありません');
      }

      // 各シート生成
      if (this.options.includeIdeasSummary) {
        await this.createIdeasSummarySheet(filteredIdeas);
      }

      if (this.options.includeLeanCanvasGallery) {
        await this.createLeanCanvasGallerySheet(filteredIdeas);
      }

      if (this.options.includeAIVerificationReport) {
        await this.createAIVerificationReportSheet(filteredIdeas);
      }

      if (this.options.includeFeasibilityDashboard) {
        await this.createFeasibilityDashboardSheet(filteredIdeas);
      }

      if (this.options.includeActionPlan) {
        await this.createActionPlanSheet(filteredIdeas);
      }

      // Note: メタデータ情報シートは不要のため削除

      // ファイル出力
      const fileName = this.generateFileName(filteredIdeas);
      const buffer = await this.workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      saveAs(blob, fileName);

      console.log(`Excel export completed: ${fileName}`);

    } catch (error) {
      console.error('Failed to export ideas to Excel:', error);
      throw new Error(`Excel出力に失敗しました: ${error}`);
    }
  }

  /**
   * アイデアフィルタリング
   */
  private filterIdeas(ideas: StoredBusinessIdea[]): StoredBusinessIdea[] {
    let filtered = [...ideas];

    if (this.options.exportScope === 'selected' && this.options.selectedIds) {
      filtered = filtered.filter(idea => this.options.selectedIds!.includes(idea.id));
    }

    if (this.options.includeOnlyVerified) {
      filtered = filtered.filter(idea => !!idea.verification);
    }

    if (this.options.includeOnlyStarred) {
      filtered = filtered.filter(idea => idea.starred);
    }

    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Sheet 1: アイデアサマリー
   */
  private async createIdeasSummarySheet(ideas: StoredBusinessIdea[]): Promise<void> {
    const worksheet = this.workbook.addWorksheet('アイデアサマリー', {
      pageSetup: {
        paperSize: 9, // A4
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0
      }
    });

    // ヘッダー設定
    await this.createSheetHeader(worksheet, 'ビジネスアイデア サマリー', ideas.length);

    // テーブルヘッダー
    const headerRow = 6;
    const headers = [
      { key: 'id', name: 'ID', width: 15 },
      { key: 'title', name: 'タイトル', width: 30 },
      { key: 'company', name: '企業', width: 20 },
      { key: 'created', name: '作成日', width: 12 },
      { key: 'status', name: 'ステータス', width: 12 },
      { key: 'starred', name: 'スター', width: 8 },
      { key: 'mvv', name: 'MVV適合', width: 10 },
      { key: 'implementation', name: '実装容易', width: 10 },
      { key: 'market', name: '市場性', width: 10 },
      { key: 'verification', name: 'AI検証', width: 12 },
      { key: 'confidence', name: '信頼度', width: 10 }
    ];

    // カラム幅設定
    headers.forEach((header, index) => {
      worksheet.getColumn(index + 1).width = header.width;
    });

    // ヘッダー行作成
    const headerCells = worksheet.getRow(headerRow);
    headers.forEach((header, index) => {
      const cell = headerCells.getCell(index + 1);
      cell.value = header.name;
      cell.style = {
        font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: this.theme.primary.substring(1) } },
        border: this.getBorderStyle(),
        alignment: { horizontal: 'center', vertical: 'middle' }
      };
    });

    // データ行作成
    ideas.forEach((idea, index) => {
      const row = worksheet.getRow(headerRow + 1 + index);
      const rowData = [
        idea.id,
        idea.title,
        idea.companyName,
        new Date(idea.createdAt).toLocaleDateString('ja-JP'),
        this.getStatusText(idea.status),
        idea.starred ? '★' : '',
        `${(idea.feasibility.mvvAlignment * 100).toFixed(0)}%`,
        `${(idea.feasibility.implementationScore * 100).toFixed(0)}%`,
        `${(idea.feasibility.marketPotential * 100).toFixed(0)}%`,
        idea.verification ? 'あり' : 'なし',
        idea.verification ? `${(idea.verification.metadata.confidence * 100).toFixed(0)}%` : '-'
      ];

      rowData.forEach((value, colIndex) => {
        const cell = row.getCell(colIndex + 1);
        cell.value = value;
        cell.style = {
          font: { size: 10 },
          border: this.getBorderStyle('thin'),
          alignment: { horizontal: colIndex >= 6 ? 'center' : 'left', vertical: 'middle' }
        };

        // 条件付き書式
        if (colIndex === 4) { // ステータス
          cell.style.fill = this.getStatusFill(idea.status);
        }
        if (colIndex === 5 && idea.starred) { // スター
          cell.style.font = { ...cell.style.font, color: { argb: 'FFD97706' } };
        }
        if (colIndex >= 6 && colIndex <= 8) { // スコア
          cell.style.fill = this.getScoreFill(parseFloat(value?.toString().replace('%', '') || '0'));
        }
      });
    });

    // 凍結ペイン
    worksheet.views = [{ state: 'frozen', xSplit: 2, ySplit: headerRow }];

    // オートフィルター
    worksheet.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: headerRow + ideas.length, column: headers.length }
    };
  }

  /**
   * Sheet 2: リーンキャンバス ギャラリー（美しいレイアウト）
   */
  private async createLeanCanvasGallerySheet(ideas: StoredBusinessIdea[]): Promise<void> {
    const worksheet = this.workbook.addWorksheet('リーンキャンバス ギャラリー', {
      pageSetup: {
        paperSize: 9, // A4
        orientation: 'landscape',
        fitToPage: true,
        margins: {
          left: 0.25, right: 0.25, top: 0.25, bottom: 0.25,
          header: 0.1, footer: 0.1
        }
      }
    });

    let currentRow = 1;

    for (const [ideaIndex, idea] of ideas.entries()) {
      // 各アイデアごとに美しいリーンキャンバスを作成
      currentRow = await this.createSingleLeanCanvas(worksheet, idea, currentRow, ideaIndex);
      
      // 次のアイデアとの間にスペース
      if (ideaIndex < ideas.length - 1) {
        currentRow += 3;
      }
    }

    // シート保護は不要（ユーザーが編集可能にする）
  }

  /**
   * 単一リーンキャンバスの美しいレイアウト作成
   */
  private async createSingleLeanCanvas(
    worksheet: ExcelJS.Worksheet, 
    idea: StoredBusinessIdea, 
    startRow: number,
    ideaIndex: number
  ): Promise<number> {
    const canvasStartRow = startRow + 3; // ヘッダー用のスペース
    const canvasHeight = 3; // キャンバスの高さ（3行構成）
    
    // カラム設定（10カラム使用）
    const columnWidths = [12, 12, 12, 12, 12, 12, 12, 12, 12, 12];
    columnWidths.forEach((width, index) => {
      worksheet.getColumn(index + 1).width = width;
    });

    // アイデアヘッダー
    await this.createIdeaHeader(worksheet, idea, startRow, ideaIndex);

    // リーンキャンバス 9ブロック作成
    await this.createCanvasBlocks(worksheet, idea, canvasStartRow);

    // フッター（スコア情報）
    await this.createCanvasFooter(worksheet, idea, canvasStartRow + canvasHeight + 1);

    return canvasStartRow + canvasHeight + 4; // 次のアイデア開始位置
  }

  /**
   * アイデアヘッダー作成
   */
  private async createIdeaHeader(
    worksheet: ExcelJS.Worksheet, 
    idea: StoredBusinessIdea, 
    row: number,
    ideaIndex: number
  ): Promise<void> {
    // タイトル行
    const titleCell = worksheet.getCell(row, 1);
    titleCell.value = `${ideaIndex + 1}. ${idea.title}`;
    worksheet.mergeCells(row, 1, row, 10);
    titleCell.style = {
      font: { bold: true, size: 16, color: { argb: this.theme.primary.substring(1) } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } },
      border: this.getBorderStyle()
    };

    // 企業・日付情報
    const infoRow = row + 1;
    const companyCell = worksheet.getCell(infoRow, 1);
    companyCell.value = `企業: ${idea.companyName}`;
    worksheet.mergeCells(infoRow, 1, infoRow, 5);
    companyCell.style = {
      font: { size: 11, color: { argb: 'FF6B7280' } },
      alignment: { horizontal: 'left', vertical: 'middle' }
    };

    const dateCell = worksheet.getCell(infoRow, 6);
    dateCell.value = `作成日: ${new Date(idea.createdAt).toLocaleDateString('ja-JP')}`;
    worksheet.mergeCells(infoRow, 6, infoRow, 10);
    dateCell.style = {
      font: { size: 11, color: { argb: 'FF6B7280' } },
      alignment: { horizontal: 'right', vertical: 'middle' }
    };
  }

  /**
   * リーンキャンバス9ブロック作成
   */
  private async createCanvasBlocks(
    worksheet: ExcelJS.Worksheet, 
    idea: StoredBusinessIdea, 
    startRow: number
  ): Promise<void> {
    const canvas = idea.leanCanvas;

    // リーンキャンバスは3行構成で統一
    const canvasRows = 3;
    
    // 最初に全体の高さを設定
    for (let row = startRow; row < startRow + canvasRows; row++) {
      worksheet.getRow(row).height = 80;
    }

    // Row 1-2: 上段〜中段
    // ②課題 (1-2列, 1-2行)
    await this.createCanvasBlock(
      worksheet, startRow, 1, startRow + 1, 2,
      '②課題', 
      canvas.problem.join('\n\n') + 
      (canvas.existingAlternatives ? `\n\n【既存の代替品】\n${canvas.existingAlternatives}` : ''),
      LEAN_CANVAS_COLORS.problem
    );

    // ④ソリューション (3-4列, 1行目)
    await this.createCanvasBlock(
      worksheet, startRow, 3, startRow, 4,
      '④ソリューション',
      canvas.solution,
      LEAN_CANVAS_COLORS.solution
    );

    // ⑦主要指標 (3-4列, 2行目)
    await this.createCanvasBlock(
      worksheet, startRow + 1, 3, startRow + 1, 4,
      '⑦主要指標',
      canvas.keyMetrics?.join('\n') || '設定が必要',
      LEAN_CANVAS_COLORS.keyMetrics
    );

    // ③独自の価値提案 (5-6列, 1-2行)
    await this.createCanvasBlock(
      worksheet, startRow, 5, startRow + 1, 6,
      '③独自の価値提案',
      canvas.valueProposition,
      LEAN_CANVAS_COLORS.valueProposition
    );

    // ⑨圧倒的な優位性 (7-8列, 1行目)
    await this.createCanvasBlock(
      worksheet, startRow, 7, startRow, 8,
      '⑨圧倒的な優位性',
      canvas.unfairAdvantage,
      LEAN_CANVAS_COLORS.unfairAdvantage
    );

    // ⑤チャネル (7-8列, 2行目)
    await this.createCanvasBlock(
      worksheet, startRow + 1, 7, startRow + 1, 8,
      '⑤チャネル',
      canvas.channels?.join('\n') || '検討が必要',
      LEAN_CANVAS_COLORS.channels
    );

    // ①顧客セグメント (9-10列, 1-2行)
    await this.createCanvasBlock(
      worksheet, startRow, 9, startRow + 1, 10,
      '①顧客セグメント',
      canvas.targetCustomers.join('\n') +
      (canvas.earlyAdopters ? `\n\n【アーリーアダプター】\n${canvas.earlyAdopters}` : ''),
      LEAN_CANVAS_COLORS.customerSegments
    );

    // Row 3: 下段
    // ⑧コスト構造 (1-5列, 3行目)
    await this.createCanvasBlock(
      worksheet, startRow + 2, 1, startRow + 2, 5,
      '⑧コスト構造',
      canvas.costStructure?.join('\n') || '分析が必要',
      LEAN_CANVAS_COLORS.costStructure
    );

    // ⑥収益の流れ (6-10列, 3行目)
    await this.createCanvasBlock(
      worksheet, startRow + 2, 6, startRow + 2, 10,
      '⑥収益の流れ（支払者明記）',
      '💰 ' + canvas.revenueStreams.join('\n'),
      LEAN_CANVAS_COLORS.revenueStreams
    );
  }

  /**
   * 単一キャンバスブロック作成
   */
  private async createCanvasBlock(
    worksheet: ExcelJS.Worksheet,
    startRow: number, startCol: number, endRow: number, endCol: number,
    title: string, content: string, colors: any
  ): Promise<void> {
    // セル結合
    worksheet.mergeCells(startRow, startCol, endRow, endCol);
    
    const cell = worksheet.getCell(startRow, startCol);
    
    // リッチテキストフォーマットで、タイトルをBoldイタリック、内容に含まれる【】もBoldイタリックに
    const richTextParts: any[] = [];
    
    // タイトル部分（Boldイタリック）
    richTextParts.push({
      text: title,
      font: { 
        bold: true, 
        italic: true, 
        size: 11, 
        color: { argb: colors.text.substring(1) } 
      }
    });
    
    // 改行
    richTextParts.push({
      text: '\n\n',
      font: { size: 10, color: { argb: colors.text.substring(1) } }
    });
    
    // コンテンツ処理（【】で囲まれた部分をBoldイタリックに）
    const contentParts = content.split(/(\【[^】]+\】)/);
    contentParts.forEach((part) => {
      if (part.match(/\【[^】]+\】/)) {
        // 【】で囲まれた部分はBoldイタリック
        richTextParts.push({
          text: part,
          font: { 
            bold: true, 
            italic: true, 
            size: 10, 
            color: { argb: colors.text.substring(1) } 
          }
        });
      } else {
        // 通常のテキスト
        richTextParts.push({
          text: part,
          font: { size: 10, color: { argb: colors.text.substring(1) } }
        });
      }
    });
    
    cell.value = { richText: richTextParts };
    
    // 行の高さはcreateCanvasBlocksで統一設定済みなのでここでは設定しない

    // セルのスタイル設定
    cell.style = {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg.substring(1) } },
      border: {
        top: { style: 'medium', color: { argb: colors.border.substring(1) } },
        left: { style: 'medium', color: { argb: colors.border.substring(1) } },
        bottom: { style: 'medium', color: { argb: colors.border.substring(1) } },
        right: { style: 'medium', color: { argb: colors.border.substring(1) } }
      },
      alignment: { 
        horizontal: 'left', 
        vertical: 'top', 
        wrapText: true 
      }
    };
  }

  /**
   * キャンバスフッター作成
   */
  private async createCanvasFooter(
    worksheet: ExcelJS.Worksheet, 
    idea: StoredBusinessIdea, 
    row: number
  ): Promise<void> {
    // 実現可能性スコア
    const scoreData = [
      { label: 'MVV適合度', value: idea.feasibility.mvvAlignment, color: this.theme.primary },
      { label: '実装容易性', value: idea.feasibility.implementationScore, color: this.theme.success },
      { label: '市場ポテンシャル', value: idea.feasibility.marketPotential, color: this.theme.accent }
    ];

    scoreData.forEach((score, index) => {
      const startCol = 1 + (index * 3);
      const endCol = startCol + 2;
      
      worksheet.mergeCells(row, startCol, row, endCol);
      const cell = worksheet.getCell(row, startCol);
      cell.value = `${score.label}: ${(score.value * 100).toFixed(0)}%`;
      cell.style = {
        font: { size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: score.color.substring(1) } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: this.getBorderStyle('thin')
      };
    });

    // AI検証情報
    if (idea.verification) {
      const verifyCol = 10;
      const verifyCell = worksheet.getCell(row, verifyCol);
      verifyCell.value = `AI検証: ${(idea.verification.metadata.confidence * 100).toFixed(0)}%`;
      verifyCell.style = {
        font: { size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: this.theme.secondary.substring(1) } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: this.getBorderStyle('thin')
      };
    }
  }

  /**
   * Sheet 3: AI検証レポート
   */
  private async createAIVerificationReportSheet(ideas: StoredBusinessIdea[]): Promise<void> {
    const verifiedIdeas = ideas.filter(idea => idea.verification);
    
    if (verifiedIdeas.length === 0) {
      // 検証済みアイデアがない場合のプレースホルダー
      const worksheet = this.workbook.addWorksheet('AI検証レポート');
      const messageCell = worksheet.getCell(1, 1);
      messageCell.value = 'AI検証が完了したアイデアがありません';
      messageCell.style = {
        font: { size: 14, bold: true, color: { argb: 'FF6B7280' } },
        alignment: { horizontal: 'center', vertical: 'middle' }
      };
      return;
    }

    const worksheet = this.workbook.addWorksheet('AI検証レポート', {
      pageSetup: {
        paperSize: 9, // A4
        orientation: 'portrait',
        fitToPage: true
      }
    });

    await this.createSheetHeader(worksheet, 'AI検証レポート', verifiedIdeas.length);

    let currentRow = 6;
    
    for (const idea of verifiedIdeas) {
      if (idea.verification) {
        currentRow = await this.createVerificationReport(worksheet, idea, currentRow);
        currentRow += 3; // スペース
      }
    }
  }

  /**
   * 単一検証レポート作成
   */
  private async createVerificationReport(
    worksheet: ExcelJS.Worksheet,
    idea: StoredBusinessIdea,
    startRow: number
  ): Promise<number> {
    const verification = idea.verification!;
    let currentRow = startRow;

    // アイデアタイトル
    const titleCell = worksheet.getCell(currentRow, 1);
    titleCell.value = idea.title;
    worksheet.mergeCells(currentRow, 1, currentRow, 6);
    titleCell.style = {
      font: { bold: true, size: 14, color: { argb: this.theme.primary.substring(1) } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } },
      border: this.getBorderStyle(),
      alignment: { horizontal: 'left', vertical: 'middle' }
    };
    currentRow += 2;

    // 総合評価
    if (verification.overallAssessment?.overallScore) {
      const scores = verification.overallAssessment.overallScore;
      const scoreHeaders = ['実行可能性', '革新性', '市場ポテンシャル', 'リスク'];
      const scoreValues = [
        scores.viabilityScore,
        scores.innovationScore, 
        scores.marketPotentialScore,
        scores.riskScore
      ];

      scoreHeaders.forEach((header, index) => {
        const headerCell = worksheet.getCell(currentRow, index + 1);
        headerCell.value = header;
        headerCell.style = {
          font: { bold: true, size: 10 },
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: this.theme.secondary.substring(1) } },
          border: this.getBorderStyle('thin'),
          alignment: { horizontal: 'center', vertical: 'middle' }
        };

        const valueCell = worksheet.getCell(currentRow + 1, index + 1);
        valueCell.value = scoreValues[index] || 'N/A';
        valueCell.style = {
          font: { size: 10, bold: true },
          border: this.getBorderStyle('thin'),
          alignment: { horizontal: 'center', vertical: 'middle' }
        };
      });
      currentRow += 3;
    }

    // 推奨判定
    if (verification.overallAssessment?.recommendation) {
      const rec = verification.overallAssessment.recommendation;
      const decisionCell = worksheet.getCell(currentRow, 1);
      decisionCell.value = `推奨判定: ${rec.decision}`;
      worksheet.mergeCells(currentRow, 1, currentRow, 6);
      decisionCell.style = {
        font: { bold: true, size: 11 },
        fill: { 
          type: 'pattern', 
          pattern: 'solid', 
          fgColor: { argb: this.getDecisionColor(rec.decision).substring(1) }
        },
        border: this.getBorderStyle('thin'),
        alignment: { horizontal: 'left', vertical: 'middle' }
      };
      currentRow += 1;

      const reasonCell = worksheet.getCell(currentRow, 1);
      reasonCell.value = rec.reasoning;
      worksheet.mergeCells(currentRow, 1, currentRow, 6);
      reasonCell.style = {
        font: { size: 10 },
        border: this.getBorderStyle('thin'),
        alignment: { horizontal: 'left', vertical: 'top', wrapText: true }
      };
      worksheet.getRow(currentRow).height = 40;
      currentRow += 2;
    }

    return currentRow;
  }

  /**
   * Sheet 4: 実行可能性ダッシュボード
   */
  private async createFeasibilityDashboardSheet(ideas: StoredBusinessIdea[]): Promise<void> {
    const worksheet = this.workbook.addWorksheet('実行可能性ダッシュボード', {
      pageSetup: {
        paperSize: 9, // A4
        orientation: 'landscape',
        fitToPage: true
      }
    });

    await this.createSheetHeader(worksheet, '実行可能性ダッシュボード', ideas.length);

    // マトリックス表示用のデータ準備
    const matrixData = ideas.map(idea => ({
      title: idea.title,
      company: idea.companyName,
      mvv: idea.feasibility.mvvAlignment * 100,
      implementation: idea.feasibility.implementationScore * 100,
      market: idea.feasibility.marketPotential * 100,
      overall: (idea.feasibility.mvvAlignment + idea.feasibility.implementationScore + idea.feasibility.marketPotential) / 3 * 100,
      starred: idea.starred,
      verified: !!idea.verification
    }));

    // 優先度ランキング作成
    const sortedByOverall = [...matrixData].sort((a, b) => b.overall - a.overall);
    
    let currentRow = 6;
    
    // ランキングテーブル
    const rankingHeaders = ['順位', 'アイデア', '企業', 'MVV適合', '実装容易', '市場性', '総合スコア', 'ステータス'];
    rankingHeaders.forEach((header, index) => {
      const cell = worksheet.getCell(currentRow, index + 1);
      cell.value = header;
      cell.style = {
        font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: this.theme.primary.substring(1) } },
        border: this.getBorderStyle(),
        alignment: { horizontal: 'center', vertical: 'middle' }
      };
    });

    sortedByOverall.forEach((item, index) => {
      const row = currentRow + 1 + index;
      const rowData = [
        index + 1,
        item.title,
        item.company,
        `${item.mvv.toFixed(0)}%`,
        `${item.implementation.toFixed(0)}%`,
        `${item.market.toFixed(0)}%`,
        `${item.overall.toFixed(0)}%`,
        this.getIdeaStatus(item)
      ];

      rowData.forEach((value, colIndex) => {
        const cell = worksheet.getCell(row, colIndex + 1);
        cell.value = value;
        cell.style = {
          font: { size: 10 },
          border: this.getBorderStyle('thin'),
          alignment: { horizontal: colIndex >= 3 && colIndex <= 6 ? 'center' : 'left', vertical: 'middle' }
        };

        // 総合スコアの色分け
        if (colIndex === 6) {
          cell.style.fill = this.getScoreFill(item.overall);
          cell.style.font = { ...cell.style.font, bold: true, color: { argb: 'FFFFFFFF' } };
        }
      });
    });
  }

  /**
   * Sheet 5: アクションプラン
   */
  private async createActionPlanSheet(ideas: StoredBusinessIdea[]): Promise<void> {
    const verifiedIdeas = ideas.filter(idea => idea.verification?.improvementSuggestions);
    
    if (verifiedIdeas.length === 0) {
      const worksheet = this.workbook.addWorksheet('アクションプラン');
      const messageCell = worksheet.getCell(1, 1);
      messageCell.value = '改善提案が含まれるアイデアがありません';
      messageCell.style = {
        font: { size: 14, bold: true, color: { argb: 'FF6B7280' } },
        alignment: { horizontal: 'center', vertical: 'middle' }
      };
      return;
    }

    const worksheet = this.workbook.addWorksheet('アクションプラン', {
      pageSetup: {
        paperSize: 9, // A4
        orientation: 'landscape',
        fitToPage: true
      }
    });

    await this.createSheetHeader(worksheet, 'アクションプラン', verifiedIdeas.length);

    // タスクリスト形式で出力
    const headers = ['アイデア', '領域', '現状', '推奨変更', '期待効果', '難易度', 'タイムライン', '進捗', '担当者', 'メモ'];
    
    let currentRow = 6;
    
    // ヘッダー行
    headers.forEach((header, index) => {
      const cell = worksheet.getCell(currentRow, index + 1);
      cell.value = header;
      worksheet.getColumn(index + 1).width = index === 0 ? 20 : index === 1 ? 15 : index >= 2 && index <= 4 ? 25 : 12;
      cell.style = {
        font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: this.theme.primary.substring(1) } },
        border: this.getBorderStyle(),
        alignment: { horizontal: 'center', vertical: 'middle' }
      };
    });

    currentRow++;

    // 各アイデアの改善提案をタスク化
    for (const idea of verifiedIdeas) {
      const improvements = idea.verification?.improvementSuggestions?.improvementRecommendations || [];
      
      for (const improvement of improvements) {
        const rowData = [
          idea.title,
          improvement.area || '',
          improvement.currentState || '',
          improvement.recommendedChange || '',
          improvement.expectedImpact || '',
          improvement.implementationDifficulty ? `${improvement.implementationDifficulty}/10` : '',
          improvement.timeline || '',
          '', // 進捗（空欄で編集可能）
          '', // 担当者（空欄で編集可能）
          ''  // メモ（空欄で編集可能）
        ];

        rowData.forEach((value, colIndex) => {
          const cell = worksheet.getCell(currentRow, colIndex + 1);
          cell.value = value;
          cell.style = {
            font: { size: 10 },
            border: this.getBorderStyle('thin'),
            alignment: { horizontal: 'left', vertical: 'top', wrapText: true }
          };

          // 編集可能フィールドの背景色
          if (colIndex >= 7) {
            cell.style.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF7CD' } };
          }
        });

        worksheet.getRow(currentRow).height = 30;
        currentRow++;
      }
    }

    // 凍結ペイン
    worksheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 6 }];
  }

  /**
   * メタデータシート作成
   */
  // createMetadataSheet メソッドを削除（不要）

  /**
   * ヘルパーメソッド群
   */
  private async createSheetHeader(
    worksheet: ExcelJS.Worksheet, 
    title: string, 
    count: number
  ): Promise<void> {
    // タイトル行
    const titleCell = worksheet.getCell(1, 1);
    titleCell.value = title;
    worksheet.mergeCells(1, 1, 1, 10);
    titleCell.style = {
      font: { bold: true, size: 18, color: { argb: this.theme.primary.substring(1) } },
      alignment: { horizontal: 'center', vertical: 'middle' }
    };
    worksheet.getRow(1).height = 30;

    // サブタイトル行
    const subtitleCell = worksheet.getCell(2, 1);
    subtitleCell.value = `${count}件のアイデア | 出力日時: ${new Date().toLocaleString('ja-JP')}`;
    worksheet.mergeCells(2, 1, 2, 10);
    subtitleCell.style = {
      font: { size: 11, color: { argb: 'FF6B7280' } },
      alignment: { horizontal: 'center', vertical: 'middle' }
    };
    worksheet.getRow(2).height = 20;
  }

  private getBorderStyle(style: 'thin' | 'medium' = 'medium'): any {
    const color = { argb: 'FF94A3B8' };
    return {
      top: { style, color },
      left: { style, color },
      bottom: { style, color },
      right: { style, color }
    };
  }

  private getStatusText(status: string): string {
    switch (status) {
      case 'verified': return '検証済み';
      case 'draft': return '下書き';
      case 'archived': return 'アーカイブ';
      default: return status;
    }
  }

  private getStatusFill(status: string): any {
    const colors = {
      verified: 'FF10B981',
      draft: 'FF6B7280',
      archived: 'FF3B82F6'
    };
    return {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colors[status as keyof typeof colors] || 'FF6B7280' }
    };
  }

  private getScoreFill(score: number): any {
    if (score >= 80) return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
    if (score >= 60) return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } };
    if (score >= 40) return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } };
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6B7280' } };
  }

  private getDecisionColor(decision: string): string {
    switch (decision) {
      case 'GO': return '#10B981';
      case 'NO-GO': return '#EF4444';
      case 'CONDITIONAL-GO': return '#F59E0B';
      default: return '#6B7280';
    }
  }

  private getIdeaStatus(item: any): string {
    let status = '';
    if (item.starred) status += '★ ';
    if (item.verified) status += '検証済み';
    else status += '下書き';
    return status;
  }

  // getIncludedSheets method removed (no longer needed)

  private generateFileName(ideas: StoredBusinessIdea[]): string {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:\-T]/g, '');
    const scope = this.options.exportScope === 'all' ? '全件' : 
                  this.options.exportScope === 'filtered' ? 'フィルタ済み' : '選択項目';
    const companyCount = new Set(ideas.map(i => i.companyName)).size;
    
    return `ビジネスアイデア_${scope}_${ideas.length}件_${companyCount}社_${timestamp}.xlsx`;
  }
}

/**
 * 便利な出力関数
 */
export async function exportIdeasToExcel(
  ideas: StoredBusinessIdea[], 
  options: IdeaExportOptions = {}
): Promise<void> {
  const exporter = new IdeaExcelExporter(options);
  await exporter.exportIdeas(ideas);
}
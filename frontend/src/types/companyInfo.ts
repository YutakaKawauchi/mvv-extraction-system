/**
 * 企業の詳細情報を表す型定義
 * MVVとは別に管理される事業・財務・組織情報
 */

// 上場ステータス
export type ListingStatus = 'listed' | 'unlisted' | 'delisted' | 'unknown';

// 企業規模分類
export type CompanyScale = 'large' | 'medium' | 'small' | 'startup' | 'unknown';

// 産業分類情報（日本標準産業分類準拠）
export interface IndustryClassification {
  jsicMajorCategory?: string; // 大分類コード（A-T）
  jsicMajorName?: string; // 大分類名称
  jsicMiddleCategory?: string; // 中分類コード（3桁）
  jsicMiddleName?: string; // 中分類名称
  jsicMinorCategory?: string; // 小分類コード（4桁）
  jsicMinorName?: string; // 小分類名称
  primaryIndustry?: string; // 主業界名
  businessType?: string; // 業種名
}

// 基本的な企業情報
export interface CompanyInfo {
  id?: number;
  companyId: string; // Company テーブルとの関連
  
  // 基本情報
  foundedYear?: number;
  employeeCount?: number;
  headquartersLocation?: string;
  prefecture?: string;
  city?: string;
  postalCode?: string;
  websiteUrl?: string;
  
  // 財務情報
  revenue?: number; // 売上高（百万円単位）
  revenueYear?: number; // 売上高の年度
  operatingProfit?: number; // 営業利益（百万円単位）
  netProfit?: number; // 純利益（百万円単位）
  marketCap?: number; // 時価総額（百万円単位）
  
  // 事業構造
  businessSegments?: string[]; // 事業セグメント
  mainProducts?: string[]; // 主要製品・サービス
  marketShare?: number; // 市場シェア（%）
  overseasRevenueRatio?: number; // 海外売上比率（%）
  
  // 上場・投資情報
  listingStatus: ListingStatus;
  stockCode?: string; // 証券コード
  stockExchange?: string; // 上場市場
  
  // 組織・人事情報
  averageAge?: number; // 平均年齢
  averageTenure?: number; // 平均勤続年数
  femaleManagerRatio?: number; // 女性管理職比率（%）
  newGraduateHires?: number; // 新卒採用数
  
  // ESG関連
  esgScore?: number; // ESGスコア（0-100）
  co2ReductionTarget?: string; // CO2削減目標
  socialContribution?: string; // 社会貢献活動
  
  // 競合・市場ポジション
  mainCompetitors?: string[]; // 主要競合企業
  industryPosition?: string; // 業界での立ち位置
  competitiveAdvantages?: string[]; // 競争優位性
  
  // 産業分類情報
  industryClassification?: IndustryClassification; // 日本標準産業分類
  
  // メタ情報
  dataSourceUrls: string[]; // データの出典URL
  lastUpdated: Date; // 最終更新日
  dataConfidenceScore: number; // データの信頼度（0.0-1.0）
  
  // 分析用の導出フィールド
  companyScale?: CompanyScale; // 企業規模（従業員数や売上から自動判定）
  growthRate?: number; // 成長率（前年比）
}

// API リクエスト用の型
export interface CompanyInfoExtractionRequest {
  companyId: string;
  companyName: string;
  companyWebsite: string;
  includeFinancials?: boolean;
  includeESG?: boolean;
  includeCompetitors?: boolean;
}

// API レスポンス用の型
export interface CompanyInfoExtractionResponse {
  success: boolean;
  data?: {
    // 基本情報
    founded_year: number | null;
    employee_count: number | null;
    headquarters_location: string | null;
    prefecture: string | null;
    city: string | null;
    postal_code: string | null;
    
    // 財務情報
    financial_data: {
      revenue: number | null;
      revenue_year: number | null;
      operating_profit: number | null;
      net_profit: number | null;
      market_cap: number | null;
    };
    
    // 事業構造
    business_structure: {
      segments: string[];
      main_products: string[];
      market_share: number | null;
      overseas_revenue_ratio: number | null;
    };
    
    // 上場情報
    listing_info: {
      status: ListingStatus;
      stock_code: string | null;
      exchange: string | null;
    };
    
    // 産業分類情報
    industry_classification: {
      jsic_major_category: string | null;
      jsic_major_name: string | null;
      jsic_middle_category: string | null;
      jsic_middle_name: string | null;
      jsic_minor_category: string | null;
      jsic_minor_name: string | null;
      primary_industry: string | null;
      business_type: string | null;
    };
    
    // 組織情報
    organization_info: {
      average_age: number | null;
      average_tenure: number | null;
      female_manager_ratio: number | null;
      new_graduate_hires: number | null;
    };
    
    // ESG情報
    esg_info: {
      score: number | null;
      co2_target: string | null;
      social_activities: string | null;
    };
    
    // 競合情報
    competitive_info: {
      main_competitors: string[];
      industry_position: string | null;
      advantages: string[];
    };
    
    // メタ情報
    metadata: {
      sources: string[];
      extraction_date: string;
      confidence_score: number;
    };
  };
  error?: string;
  metadata?: {
    processingTime: number;
    timestamp: string;
    source: 'perplexity' | 'openai' | 'claude';
  };
}

// 企業規模の判定ヘルパー
export function determineCompanyScale(employeeCount?: number, revenue?: number): CompanyScale {
  if (!employeeCount && !revenue) return 'unknown';
  
  // 従業員数ベースの判定（優先）
  if (employeeCount) {
    if (employeeCount >= 1000) return 'large';
    if (employeeCount >= 300) return 'medium';
    if (employeeCount >= 50) return 'small';
    return 'startup';
  }
  
  // 売上高ベースの判定（百万円単位）
  if (revenue) {
    if (revenue >= 100000) return 'large'; // 1000億円以上
    if (revenue >= 10000) return 'medium'; // 100億円以上
    if (revenue >= 1000) return 'small'; // 10億円以上
    return 'startup';
  }
  
  return 'unknown';
}

// 成長率の計算ヘルパー
export function calculateGrowthRate(currentRevenue?: number, previousRevenue?: number): number | undefined {
  if (!currentRevenue || !previousRevenue || previousRevenue === 0) return undefined;
  return ((currentRevenue - previousRevenue) / previousRevenue) * 100;
}

// 産業分類から自動カテゴリー生成（正規化済み大分類優先）
export function generateCategoryFromIndustryClassification(classification?: IndustryClassification): string {
  // categoryNormalizerを使用して正規化
  return generateNormalizedCategory(classification);
}

// categoryNormalizer関数をインポート
import { generateNormalizedCategory, getJSICMajorCategoryFromCode } from '../utils/categoryNormalizer';

// 階層別カテゴリー生成関数（分析用）
export function getCategoryByLevel(classification?: IndustryClassification, level: 'major' | 'middle' | 'primary' | 'business' = 'primary'): string {
  if (!classification) return '未分類';
  
  switch (level) {
    case 'major':
      return classification.jsicMajorName || '未分類';
    case 'middle':
      return classification.jsicMiddleName || '未分類';
    case 'primary':
      return classification.primaryIndustry || '未分類';
    case 'business':
      return classification.businessType || '未分類';
    default:
      return classification.primaryIndustry || '未分類';
  }
}

// JSIC大分類コードから日本語名称への変換
// ※ categoryNormalizerに移動済み、互換性のため残す
export function getJSICMajorCategoryName(code?: string): string {
  return getJSICMajorCategoryFromCode(code);
}
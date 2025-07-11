/**
 * 企業情報抽出状況の分析サービス
 * MVV抽出済みだが企業情報未抽出の企業を特定し、一括処理を支援
 */

import { db } from './storage';
import type { Company } from '../types';

export interface CompanyInfoStatus {
  companyId: string;
  companyName: string;
  hasMVV: boolean;
  hasEmbeddings: boolean;
  hasCompanyInfo: boolean;
  status: 'complete' | 'missing_company_info' | 'missing_mvv' | 'missing_all';
  extractedAt?: Date;
}

export interface CompanyInfoAnalytics {
  total: number;
  complete: number;
  missingCompanyInfo: number;
  missingMVV: number;
  missingAll: number;
  readyForCompanyInfoExtraction: Company[]; // MVV有、企業情報無しの企業
}

export class CompanyInfoAnalyzer {
  /**
   * 全企業の情報抽出状況を分析
   */
  async analyzeCompanyInfoStatus(): Promise<CompanyInfoAnalytics> {
    console.log('🔍 企業情報抽出状況を分析中...');
    
    // 全企業を取得
    const companies = await db.companies.toArray();
    
    // 全MVVデータを取得（isActiveはDexieではtruthy値として格納される）
    const mvvData = await db.mvvData.toArray();
    const activeMvvData = mvvData.filter(mvv => mvv.isActive);
    const mvvCompanyIds = new Set(activeMvvData.map(mvv => mvv.companyId));
    
    // 全企業情報を取得
    const companyInfoData = await db.companyInfo.toArray();
    const companyInfoIds = new Set(companyInfoData.map(info => info.companyId));
    
    const analytics: CompanyInfoAnalytics = {
      total: companies.length,
      complete: 0,
      missingCompanyInfo: 0,
      missingMVV: 0,
      missingAll: 0,
      readyForCompanyInfoExtraction: []
    };
    
    for (const company of companies) {
      const hasMVV = mvvCompanyIds.has(company.id);
      const hasCompanyInfo = companyInfoIds.has(company.id);
      
      if (hasMVV && hasCompanyInfo) {
        analytics.complete++;
      } else if (hasMVV && !hasCompanyInfo) {
        analytics.missingCompanyInfo++;
        // Convert DB company to Company type
        const convertedCompany = {
          ...company,
          createdAt: new Date(company.createdAt),
          updatedAt: new Date(company.updatedAt),
          lastProcessed: company.lastProcessed ? new Date(company.lastProcessed) : undefined
        };
        analytics.readyForCompanyInfoExtraction.push(convertedCompany);
      } else if (!hasMVV && hasCompanyInfo) {
        analytics.missingMVV++;
      } else {
        analytics.missingAll++;
      }
    }
    
    console.log('📊 企業情報分析結果:', {
      全企業数: analytics.total,
      完了: analytics.complete,
      企業情報未抽出: analytics.missingCompanyInfo,
      MVV未抽出: analytics.missingMVV,
      すべて未抽出: analytics.missingAll,
      企業情報抽出可能: analytics.readyForCompanyInfoExtraction.length
    });
    
    return analytics;
  }
  
  /**
   * 企業情報抽出が必要な企業一覧を取得
   */
  async getCompaniesNeedingCompanyInfo(): Promise<Company[]> {
    const analytics = await this.analyzeCompanyInfoStatus();
    return analytics.readyForCompanyInfoExtraction;
  }
  
  /**
   * 個別企業の詳細な情報抽出状況を取得
   */
  async getCompanyInfoStatus(companyId: string): Promise<CompanyInfoStatus | null> {
    const company = await db.companies.get(companyId);
    if (!company) return null;
    
    const mvvData = await db.mvvData
      .where('companyId')
      .equals(companyId)
      .filter(mvv => mvv.isActive)
      .first();
    
    const companyInfo = await db.companyInfo
      .where('companyId')
      .equals(companyId)
      .first();
    
    const hasMVV = !!mvvData;
    // Note: embeddings are stored separately in the company record
    const hasEmbeddings = !!(company.embeddings && company.embeddings.length > 0);
    const hasCompanyInfo = !!companyInfo;
    
    let status: CompanyInfoStatus['status'];
    if (hasMVV && hasCompanyInfo) {
      status = 'complete';
    } else if (hasMVV && !hasCompanyInfo) {
      status = 'missing_company_info';
    } else if (!hasMVV && hasCompanyInfo) {
      status = 'missing_mvv';
    } else {
      status = 'missing_all';
    }
    
    return {
      companyId: company.id,
      companyName: company.name,
      hasMVV,
      hasEmbeddings,
      hasCompanyInfo,
      status,
      extractedAt: companyInfo?.lastUpdated ? new Date(companyInfo.lastUpdated) : undefined
    };
  }
  
  /**
   * 企業情報抽出状況の統計レポートを生成
   */
  async generateStatusReport(): Promise<string> {
    const analytics = await this.analyzeCompanyInfoStatus();
    
    const report = `
# 企業情報抽出状況レポート

## 概要
- **全企業数**: ${analytics.total}
- **完了**: ${analytics.complete} (${Math.round(analytics.complete / analytics.total * 100)}%)
- **企業情報未抽出**: ${analytics.missingCompanyInfo} (${Math.round(analytics.missingCompanyInfo / analytics.total * 100)}%)
- **MVV未抽出**: ${analytics.missingMVV} (${Math.round(analytics.missingMVV / analytics.total * 100)}%)
- **すべて未抽出**: ${analytics.missingAll} (${Math.round(analytics.missingAll / analytics.total * 100)}%)

## 即座にリカバリ可能な企業
以下の${analytics.readyForCompanyInfoExtraction.length}社はMVV抽出済みのため、企業情報抽出を実行できます：

${analytics.readyForCompanyInfoExtraction.map((company, index) => 
  `${index + 1}. ${company.name} (ID: ${company.id})`
).join('\n')}

## 推奨アクション
${analytics.missingCompanyInfo > 0 ? 
  `1. 一括企業情報抽出を実行して${analytics.missingCompanyInfo}社の企業情報を取得\n` : ''}
${analytics.missingMVV > 0 ? 
  `2. MVV抽出が未完了の${analytics.missingMVV}社を先にMVV抽出実行\n` : ''}
${analytics.missingAll > 0 ? 
  `3. 新規登録の${analytics.missingAll}社を完全自動処理パイプラインで処理\n` : ''}
    `.trim();
    
    return report;
  }
}

// シングルトンインスタンス
export const companyInfoAnalyzer = new CompanyInfoAnalyzer();
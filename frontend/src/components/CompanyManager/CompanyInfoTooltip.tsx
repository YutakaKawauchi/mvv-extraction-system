import React, { useState, useEffect } from 'react';
import type { Company, CompanyInfo } from '../../types';
import { db } from '../../services/storage';
import { formatShortDate } from '../../utils/formatters';
import { 
  Building2, 
  TrendingUp, 
  Tag, 
  X, 
  Pin,
  Copy,
  Database
} from 'lucide-react';

interface CompanyInfoTooltipProps {
  company: Company;
  children: React.ReactNode;
}

export const CompanyInfoTooltip: React.FC<CompanyInfoTooltipProps> = ({ 
  company, 
  children 
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isVisible = isHovered || isPinned;

  useEffect(() => {
    if (isVisible && !companyInfo) {
      loadCompanyInfo();
    }
  }, [isVisible, company.id]);

  const loadCompanyInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const info = await db.companyInfo
        .where('companyId')
        .equals(company.id)
        .first();
      
      if (info) {
        // Date型に変換
        setCompanyInfo({
          ...info,
          lastUpdated: new Date(info.lastUpdated)
        });
      } else {
        setError('企業情報が見つかりません');
      }
    } catch (err) {
      console.error('Failed to load company info:', err);
      setError('企業情報の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPinned(!isPinned);
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPinned(false);
  };

  const copyCompanyInfo = async () => {
    if (!companyInfo) return;

    const parts = [];
    
    // ヘッダー
    parts.push(`# ${company.name} - 企業情報`);
    parts.push(`**業界**: ${company.category || '未分類'}`);
    parts.push(`**ウェブサイト**: ${company.website}`);
    parts.push('');
    
    // 基本情報
    parts.push(`## 基本情報`);
    if (companyInfo.foundedYear) parts.push(`- 設立年: ${companyInfo.foundedYear}年`);
    if (companyInfo.employeeCount) parts.push(`- 従業員数: ${companyInfo.employeeCount}名`);
    if (companyInfo.headquartersLocation) {
      parts.push(`- 本社: ${companyInfo.headquartersLocation}`);
    } else if (companyInfo.prefecture || companyInfo.city) {
      const location = [companyInfo.prefecture, companyInfo.city].filter(Boolean).join(' ');
      parts.push(`- 所在地: ${location}`);
    }
    parts.push('');
    
    // 事業情報
    if (companyInfo.industryClassification?.primaryIndustry || companyInfo.industryClassification?.businessType) {
      parts.push(`## 事業分野`);
      if (companyInfo.industryClassification.primaryIndustry) {
        parts.push(`- 主業界: ${companyInfo.industryClassification.primaryIndustry}`);
      }
      if (companyInfo.industryClassification.businessType) {
        parts.push(`- 業種: ${companyInfo.industryClassification.businessType}`);
      }
      parts.push('');
    }
    
    // 財務情報
    if (companyInfo.revenue || companyInfo.listingStatus !== 'unknown') {
      parts.push(`## 財務・上場情報`);
      if (companyInfo.listingStatus && companyInfo.listingStatus !== 'unknown') {
        const statusLabels = {
          'listed': '上場',
          'unlisted': '非上場',
          'delisted': '上場廃止'
        };
        parts.push(`- 上場状況: ${statusLabels[companyInfo.listingStatus as keyof typeof statusLabels] || companyInfo.listingStatus}`);
      }
      if (companyInfo.revenue && companyInfo.revenueYear) {
        parts.push(`- 売上高: ${companyInfo.revenue.toLocaleString()}百万円 (${companyInfo.revenueYear}年度)`);
      }
      parts.push('');
    }
    
    // データ品質
    parts.push(`## データ情報`);
    parts.push(`- 信頼度スコア: ${(companyInfo.dataConfidenceScore * 100).toFixed(1)}%`);
    parts.push(`- 最終更新: ${formatShortDate(companyInfo.lastUpdated)}`);
    
    const text = parts.join('\\n');
    
    try {
      await navigator.clipboard.writeText(text);
      console.log('Company info copied to clipboard');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatNumber = (num: number | undefined) => {
    if (!num) return '未設定';
    return num.toLocaleString();
  };

  const formatLocation = (info: CompanyInfo) => {
    if (info.headquartersLocation) return info.headquartersLocation;
    const parts = [info.prefecture, info.city].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : '未設定';
  };

  const getListingStatusLabel = (status: string) => {
    const labels = {
      'listed': '上場',
      'unlisted': '非上場', 
      'delisted': '上場廃止',
      'unknown': '不明'
    };
    return labels[status as keyof typeof labels] || status;
  };

  if (!isVisible) {
    return (
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
        className="cursor-pointer inline-block"
      >
        {children}
      </div>
    );
  }

  return (
    <div className="relative inline-block" data-tooltip-container>
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
        className="cursor-pointer"
      >
        {children}
      </div>
      
      <div className="absolute z-50 w-80 bg-white border border-gray-200 rounded-lg shadow-lg -top-2 left-full ml-2" data-tooltip-container>
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 pb-2 border-b border-gray-200">
          <div>
            <h4 className="font-semibold text-gray-900 flex items-center">
              <Database className="w-4 h-4 mr-2 text-blue-600" />
              {company.name}
            </h4>
            <p className="text-sm text-gray-600">{company.category || '未分類'}</p>
          </div>
          <div className="flex items-center space-x-1">
            {isPinned ? (
              <>
                {companyInfo && (
                  <button
                    onClick={copyCompanyInfo}
                    className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                    title="Copy as Markdown"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={handleClose}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <div className="flex items-center text-xs text-gray-500">
                <Pin className="h-3 w-3 mr-1" />
                <span>Click to pin</span>
              </div>
            )}
          </div>
        </div>

        {/* コンテンツ */}
        <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-sm text-gray-600">読み込み中...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <Database className="w-4 h-4 text-yellow-600 mr-2" />
              <span className="text-sm text-yellow-700">{error}</span>
            </div>
          )}

          {companyInfo && (
            <>
              {/* 基本情報 */}
              <div className="space-y-2">
                <h5 className="text-sm font-medium text-gray-900 flex items-center">
                  <Building2 className="w-4 h-4 mr-2" />
                  基本情報
                </h5>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">設立年:</span>
                    <span className="ml-1 font-medium">
                      {companyInfo.foundedYear ? `${companyInfo.foundedYear}年` : '未設定'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">従業員数:</span>
                    <span className="ml-1 font-medium">{formatNumber(companyInfo.employeeCount)}名</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">所在地:</span>
                    <span className="ml-1 font-medium">{formatLocation(companyInfo)}</span>
                  </div>
                </div>
              </div>

              {/* 産業分類 */}
              {companyInfo.industryClassification && (
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-gray-900 flex items-center">
                    <Tag className="w-4 h-4 mr-2" />
                    産業分類
                  </h5>
                  <div className="text-xs space-y-1">
                    {companyInfo.industryClassification.primaryIndustry && (
                      <div>
                        <span className="text-gray-500">主業界:</span>
                        <span className="ml-1 font-medium">{companyInfo.industryClassification.primaryIndustry}</span>
                      </div>
                    )}
                    {companyInfo.industryClassification.businessType && (
                      <div>
                        <span className="text-gray-500">業種:</span>
                        <span className="ml-1 font-medium">{companyInfo.industryClassification.businessType}</span>
                      </div>
                    )}
                    {companyInfo.industryClassification.jsicMajorName && (
                      <div>
                        <span className="text-gray-500">JSIC分類:</span>
                        <span className="ml-1 font-medium">{companyInfo.industryClassification.jsicMajorName}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 財務・上場情報 */}
              {(companyInfo.revenue || companyInfo.listingStatus !== 'unknown') && (
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-gray-900 flex items-center">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    財務・上場情報
                  </h5>
                  <div className="text-xs space-y-1">
                    <div>
                      <span className="text-gray-500">上場状況:</span>
                      <span className="ml-1 font-medium">{getListingStatusLabel(companyInfo.listingStatus)}</span>
                    </div>
                    {companyInfo.revenue && companyInfo.revenueYear && (
                      <div>
                        <span className="text-gray-500">売上高:</span>
                        <span className="ml-1 font-medium">
                          {formatNumber(companyInfo.revenue)}百万円 ({companyInfo.revenueYear}年度)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* データ品質情報 */}
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div>
                    <span>信頼度: {(companyInfo.dataConfidenceScore * 100).toFixed(1)}%</span>
                  </div>
                  <div>
                    <span>更新: {formatShortDate(companyInfo.lastUpdated)}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
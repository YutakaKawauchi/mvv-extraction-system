import { useState, useMemo } from 'react';
import type { Company, MVVData } from '../../types';
import { StatusBadge, Button } from '../common';
import { formatShortDate, formatPercentage } from '../../utils/formatters';
import { 
  Eye, 
  Download, 
  Edit, 
  ExternalLink, 
  ChevronUp, 
  ChevronDown,
  Globe
} from 'lucide-react';

interface ResultsTableProps {
  companies: Company[];
  mvvDataMap: Map<string, MVVData>;
  onViewDetails: (company: Company, mvvData?: MVVData) => void;
  onEdit: (company: Company) => void;
  onExport: () => void;
}

type SortField = 'name' | 'category' | 'status' | 'updatedAt' | 'confidence';
type SortOrder = 'asc' | 'desc';

export const ResultsTable: React.FC<ResultsTableProps> = ({
  companies,
  mvvDataMap,
  onViewDetails,
  onEdit,
  onExport
}) => {
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const sortedCompanies = useMemo(() => {
    return [...companies].sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'category':
          aValue = a.category.toLowerCase();
          bValue = b.category.toLowerCase();
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'updatedAt':
          aValue = a.updatedAt.getTime();
          bValue = b.updatedAt.getTime();
          break;
        case 'confidence':
          const aMvv = mvvDataMap.get(a.id);
          const bMvv = mvvDataMap.get(b.id);
          aValue = aMvv ? 
            (aMvv.confidenceScores.mission + aMvv.confidenceScores.vision + aMvv.confidenceScores.values) / 3 :
            0;
          bValue = bMvv ? 
            (bMvv.confidenceScores.mission + bMvv.confidenceScores.vision + bMvv.confidenceScores.values) / 3 :
            0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [companies, mvvDataMap, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const SortButton: React.FC<{ field: SortField; children: React.ReactNode }> = ({
    field,
    children
  }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center space-x-1 text-left w-full hover:text-blue-600 focus:outline-none"
    >
      <span>{children}</span>
      {sortField === field && (
        sortOrder === 'asc' ? 
          <ChevronUp className="w-4 h-4" /> : 
          <ChevronDown className="w-4 h-4" />
      )}
    </button>
  );

  const getConfidenceScore = (company: Company): number => {
    const mvvData = mvvDataMap.get(company.id);
    if (!mvvData) return 0;
    return (mvvData.confidenceScores.mission + mvvData.confidenceScores.vision + mvvData.confidenceScores.values) / 3;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
          <div>
            <h3 className="text-lg font-medium text-gray-900">抽出結果</h3>
            <p className="text-sm text-gray-600 mt-1">
              {companies.length}件の企業データ
            </p>
          </div>
          <Button onClick={onExport} variant="outline" size="sm" className="w-full sm:w-auto">
            <Download className="w-4 h-4 mr-2" />
            エクスポート
          </Button>
        </div>
      </div>

      {/* Mobile View */}
      <div className="block lg:hidden">
        {sortedCompanies.map((company) => {
          const mvvData = mvvDataMap.get(company.id);
          const confidence = getConfidenceScore(company);
          
          return (
            <div key={company.id} className="border-b border-gray-200 p-4 space-y-3">
              {/* Company Header */}
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 truncate">
                    {company.name}
                  </h4>
                  <div className="flex items-center text-xs text-gray-500 mt-1">
                    <Globe className="w-3 h-3 mr-1 flex-shrink-0" />
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-600 truncate"
                    >
                      {company.website}
                    </a>
                    <ExternalLink className="w-3 h-3 ml-1 flex-shrink-0" />
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-3">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {company.category}
                  </span>
                  <StatusBadge status={company.status} size="sm" />
                </div>
              </div>

              {/* Confidence and MVV Status */}
              {mvvData ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">信頼度</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900">
                        {formatPercentage(confidence)}
                      </span>
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            confidence >= 0.8 ? 'bg-green-500' :
                            confidence >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${confidence * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="flex items-center">
                      <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                        mvvData.mission ? 'bg-green-400' : 'bg-red-400'
                      }`} />
                      <span className="text-gray-600">Mission</span>
                    </div>
                    <div className="flex items-center">
                      <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                        mvvData.vision ? 'bg-green-400' : 'bg-red-400'
                      }`} />
                      <span className="text-gray-600">Vision</span>
                    </div>
                    <div className="flex items-center">
                      <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                        mvvData.values.length > 0 ? 'bg-green-400' : 'bg-red-400'
                      }`} />
                      <span className="text-gray-600">Values ({mvvData.values.length})</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">MVVデータ未抽出</div>
              )}

              {/* Error Message */}
              {company.errorMessage && (
                <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                  {company.errorMessage}
                </div>
              )}

              {/* Actions and Date */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-gray-500">
                  {formatShortDate(company.updatedAt)}
                </span>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onViewDetails(company, mvvData);
                    }}
                    className="flex items-center"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    <span className="hidden sm:inline">詳細</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(company)}
                    className="flex items-center"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <SortButton field="name">企業名</SortButton>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <SortButton field="category">カテゴリー</SortButton>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <SortButton field="status">ステータス</SortButton>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <SortButton field="confidence">信頼度</SortButton>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                MVV情報
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <SortButton field="updatedAt">更新日時</SortButton>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                アクション
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedCompanies.map((company) => {
              const mvvData = mvvDataMap.get(company.id);
              const confidence = getConfidenceScore(company);
              
              return (
                <tr key={company.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {company.name}
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <Globe className="w-3 h-3 mr-1" />
                        <a
                          href={company.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-blue-600 truncate max-w-xs"
                        >
                          {company.website}
                        </a>
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {company.category}
                    </span>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={company.status} size="sm" />
                    {company.errorMessage && (
                      <div className="text-xs text-red-600 mt-1 max-w-xs truncate" title={company.errorMessage}>
                        {company.errorMessage}
                      </div>
                    )}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    {mvvData ? (
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-gray-900">
                          {formatPercentage(confidence)}
                        </div>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              confidence >= 0.8 ? 'bg-green-500' :
                              confidence >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${confidence * 100}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">-</span>
                    )}
                  </td>
                  
                  <td className="px-6 py-4">
                    {mvvData ? (
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center">
                          <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                            mvvData.mission ? 'bg-green-400' : 'bg-red-400'
                          }`} />
                          Mission: {mvvData.mission ? '有' : '無'}
                        </div>
                        <div className="flex items-center">
                          <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                            mvvData.vision ? 'bg-green-400' : 'bg-red-400'
                          }`} />
                          Vision: {mvvData.vision ? '有' : '無'}
                        </div>
                        <div className="flex items-center">
                          <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                            mvvData.values.length > 0 ? 'bg-green-400' : 'bg-red-400'
                          }`} />
                          Values: {mvvData.values.length}個
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">未抽出</span>
                    )}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatShortDate(company.updatedAt)}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onViewDetails(company, mvvData);
                      }}
                      title="詳細を表示"
                    >
                      <Eye className="w-4 h-4" />
                      <span className="ml-1">詳細</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(company)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {companies.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">表示する結果がありません。</p>
        </div>
      )}
    </div>
  );
};
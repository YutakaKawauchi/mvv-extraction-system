import React from 'react';
import type { Company } from '../../types';
import { StatusBadge, Button } from '../common';
import { formatShortDate } from '../../utils/formatters';
import { ExternalLink, Edit, Trash2, Globe } from 'lucide-react';

interface CompanyCardProps {
  company: Company;
  onEdit: (company: Company) => void;
  onDelete: (company: Company) => void;
  onSelect?: (company: Company) => void;
}

export const CompanyCard: React.FC<CompanyCardProps> = ({
  company,
  onEdit,
  onDelete,
  onSelect
}) => {
  const handleWebsiteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(company.website, '_blank', 'noopener,noreferrer');
  };

  const handleCardClick = () => {
    if (onSelect) {
      onSelect(company);
    }
  };

  return (
    <div 
      className={`bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow ${
        onSelect ? 'cursor-pointer' : ''
      }`}
      onClick={handleCardClick}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 truncate">
            {company.name}
          </h3>
          <div className="flex items-center mt-1">
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              {company.category}
            </span>
          </div>
        </div>
        <StatusBadge status={company.status} size="sm" />
      </div>

      {/* Website */}
      <div className="mb-3">
        <button
          onClick={handleWebsiteClick}
          className="flex items-center text-sm text-blue-600 hover:text-blue-800 hover:underline"
        >
          <Globe className="w-4 h-4 mr-1" />
          <span className="truncate">{company.website}</span>
          <ExternalLink className="w-3 h-3 ml-1 flex-shrink-0" />
        </button>
      </div>

      {/* Notes */}
      {company.notes && (
        <div className="mb-3">
          <p className="text-sm text-gray-600 line-clamp-2">
            {company.notes}
          </p>
        </div>
      )}

      {/* Error Message */}
      {company.status === 'error' && company.errorMessage && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {company.errorMessage}
        </div>
      )}

      {/* Metadata */}
      <div className="text-xs text-gray-500 mb-3 space-y-1">
        <div>作成: {formatShortDate(company.createdAt)}</div>
        <div>更新: {formatShortDate(company.updatedAt)}</div>
        {company.lastProcessed && (
          <div>最終処理: {formatShortDate(company.lastProcessed)}</div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(company);
          }}
        >
          <Edit className="w-4 h-4 mr-1" />
          編集
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(company);
          }}
        >
          <Trash2 className="w-4 h-4 mr-1" />
          削除
        </Button>
      </div>
    </div>
  );
};
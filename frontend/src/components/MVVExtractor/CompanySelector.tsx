import React from 'react';
import type { Company } from '../../types';
import { StatusBadge, Button } from '../common';
import { useCompanyStore } from '../../stores/companyStore';
import { 
  CheckSquare, 
  Square, 
  Users, 
  Filter,
  RotateCcw
} from 'lucide-react';

interface CompanySelectorProps {
  selectedCompanies: Company[];
  onSelectionChange: (companies: Company[]) => void;
}

export const CompanySelector: React.FC<CompanySelectorProps> = ({
  selectedCompanies,
  onSelectionChange
}) => {
  const { companies } = useCompanyStore();
  
  const selectedIds = new Set(selectedCompanies.map(c => c.id));
  
  // Filter companies that can be processed (exclude only 'processing' status)
  const availableCompanies = companies.filter(c => 
    c.status !== 'processing'
  );
  
  const handleCompanyToggle = (company: Company) => {
    if (selectedIds.has(company.id)) {
      onSelectionChange(selectedCompanies.filter(c => c.id !== company.id));
    } else {
      onSelectionChange([...selectedCompanies, company]);
    }
  };

  const handleSelectAll = () => {
    onSelectionChange(availableCompanies);
  };

  const handleDeselectAll = () => {
    onSelectionChange([]);
  };

  const handleSelectPending = () => {
    const pendingCompanies = companies.filter(c => c.status === 'pending');
    onSelectionChange(pendingCompanies);
  };

  const handleSelectErrors = () => {
    const errorCompanies = companies.filter(c => c.status === 'error');
    onSelectionChange(errorCompanies);
  };

  const handleSelectCompleted = () => {
    const completedCompanies = companies.filter(c => c.status === 'completed');
    onSelectionChange(completedCompanies);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <Users className="w-5 h-5 mr-2" />
            企業選択
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {selectedCompanies.length}件の企業が選択されています
          </p>
        </div>
        
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleSelectPending}
            disabled={companies.filter(c => c.status === 'pending').length === 0}
          >
            <Filter className="w-4 h-4 mr-1" />
            未処理のみ
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleSelectErrors}
            disabled={companies.filter(c => c.status === 'error').length === 0}
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            エラーのみ
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleSelectCompleted}
            disabled={companies.filter(c => c.status === 'completed').length === 0}
          >
            <CheckSquare className="w-4 h-4 mr-1" />
            完了済みを選択
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleSelectAll}
            disabled={availableCompanies.length === 0}
          >
            すべて選択
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleDeselectAll}
            disabled={selectedCompanies.length === 0}
          >
            選択解除
          </Button>
        </div>
      </div>

      {/* Company List */}
      {availableCompanies.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p>処理可能な企業がありません</p>
          <p className="text-sm mt-1">処理中以外の企業を選択できます</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
          {availableCompanies.map(company => {
            const isSelected = selectedIds.has(company.id);
            
            return (
              <div
                key={company.id}
                className={`border rounded-lg p-3 cursor-pointer transition-all ${
                  isSelected 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => handleCompanyToggle(company)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start min-w-0 flex-1">
                    <div className="mt-1 mr-3">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {company.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate mt-1">
                        {company.website}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={company.status} size="sm" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
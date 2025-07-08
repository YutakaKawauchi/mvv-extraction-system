import React, { useState, useEffect, useMemo } from 'react';
import type { Company, CompanyStatus } from '../../types';
import { CompanyCard } from './CompanyCard';
import { CompanyForm } from './CompanyForm';
import { CSVImporter } from './CSVImporter';
import { Button, LoadingSpinner } from '../common';
import { useCompanyStore } from '../../stores/companyStore';
import { useNotification } from '../../hooks/useNotification';
import { CONSTANTS } from '../../utils/constants';
import { 
  Plus, 
  Upload, 
  Download, 
  Search, 
  Grid,
  List,
  Trash2,
  RotateCcw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

type ViewMode = 'grid' | 'list';
type SortField = 'name' | 'category' | 'status' | 'createdAt' | 'updatedAt';
type SortOrder = 'asc' | 'desc';

export const CompanyList: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<CompanyStatus | ''>('');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [showCSVImporter, setShowCSVImporter] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | undefined>();

  const {
    companies,
    loading,
    error,
    loadCompanies,
    addCompany,
    addCompanies,
    updateCompany,
    deleteCompany,
    deleteAllCompanies,
    clearError
  } = useCompanyStore();

  const { success, error: showError } = useNotification();

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  useEffect(() => {
    if (error) {
      showError('エラー', error);
      clearError();
    }
  }, [error, showError, clearError]);

  // Helper functions for quick actions
  const errorCompanies = useMemo(() => {
    return companies.filter(company => company.status === 'error');
  }, [companies]);

  const completedCompanies = useMemo(() => {
    return companies.filter(company => company.status === 'completed');
  }, [companies]);

  const pendingCompanies = useMemo(() => {
    return companies.filter(company => company.status === 'pending');
  }, [companies]);

  // Filtered and sorted companies
  const filteredCompanies = useMemo(() => {
    let filtered = companies.filter(company => {
      const matchesSearch = !searchQuery || 
        company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        company.website.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (company.notes && company.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory = !selectedCategory || company.category === selectedCategory;
      const matchesStatus = !selectedStatus || company.status === selectedStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });

    // Sort
    filtered.sort((a, b) => {
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
        case 'createdAt':
          aValue = a.createdAt.getTime();
          bValue = b.createdAt.getTime();
          break;
        case 'updatedAt':
          aValue = a.updatedAt.getTime();
          bValue = b.updatedAt.getTime();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [companies, searchQuery, selectedCategory, selectedStatus, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleAddCompany = async (formData: any) => {
    try {
      await addCompany(formData);
      setShowCompanyForm(false);
      success('成功', '企業を追加しました');
    } catch (error) {
      // Error is handled by the store and notification hook
    }
  };

  const handleUpdateCompany = async (formData: any) => {
    if (!editingCompany) return;
    
    try {
      await updateCompany(editingCompany.id, formData);
      setEditingCompany(undefined);
      setShowCompanyForm(false);
      success('成功', '企業情報を更新しました');
    } catch (error) {
      // Error is handled by the store and notification hook
    }
  };

  const handleDeleteCompany = async (company: Company) => {
    if (!confirm(`「${company.name}」を削除しますか？この操作は取り消せません。`)) {
      return;
    }

    try {
      await deleteCompany(company.id);
      success('成功', '企業を削除しました');
    } catch (error) {
      // Error is handled by the store and notification hook
    }
  };

  const handleImportCompanies = async (importData: any[]) => {
    try {
      await addCompanies(importData);
      setShowCSVImporter(false);
      success('成功', `${importData.length}件の企業をインポートしました`);
    } catch (error) {
      // Error is handled by the store and notification hook
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('全ての企業データを削除しますか？この操作は取り消せません。')) {
      return;
    }

    try {
      await deleteAllCompanies();
      success('成功', '全ての企業データを削除しました');
    } catch (error) {
      // Error is handled by the store and notification hook
    }
  };

  const exportToCSV = () => {
    const csvData = filteredCompanies.map(company => ({
      name: company.name,
      website: company.website,
      category: company.category,
      status: company.status,
      notes: company.notes || '',
      createdAt: company.createdAt.toISOString(),
      updatedAt: company.updatedAt.toISOString()
    }));

    const csv = [
      'name,website,category,status,notes,createdAt,updatedAt',
      ...csvData.map(row => 
        Object.values(row).map(value => `"${value}"`).join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `companies_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const openEditForm = (company: Company) => {
    setEditingCompany(company);
    setShowCompanyForm(true);
  };

  const openAddForm = () => {
    setEditingCompany(undefined);
    setShowCompanyForm(true);
  };

  // Quick action handlers
  const handleRetryErrorCompanies = async () => {
    if (errorCompanies.length === 0) return;
    
    try {
      // Reset error companies to pending status
      const updatePromises = errorCompanies.map(company => 
        updateCompany(company.id, { 
          status: 'pending', 
          errorMessage: undefined 
        })
      );
      
      await Promise.all(updatePromises);
      success('成功', `${errorCompanies.length}件のエラー企業を再実行待ちに設定しました`);
    } catch (error) {
      showError('エラー', '一括操作中にエラーが発生しました');
    }
  };

  const handleSelectStatusFilter = (status: CompanyStatus | '') => {
    setSelectedStatus(status);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedStatus('');
    setSortField('updatedAt');
    setSortOrder('desc');
  };

  const handleRetryCompany = async (company: Company) => {
    try {
      await updateCompany(company.id, { 
        status: 'pending', 
        errorMessage: undefined 
      });
      success('成功', `「${company.name}」を再実行待ちに設定しました`);
    } catch (error) {
      showError('エラー', '企業ステータスの更新に失敗しました');
    }
  };

  if (loading && companies.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" text="企業データを読み込み中..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">企業管理</h2>
          <p className="text-gray-600 mt-1">
            {filteredCompanies.length} / {companies.length} 件の企業
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={openAddForm}>
            <Plus className="w-4 h-4 mr-2" />
            企業追加
          </Button>
          <Button variant="outline" onClick={() => setShowCSVImporter(true)}>
            <Upload className="w-4 h-4 mr-2" />
            CSV インポート
          </Button>
          <Button 
            variant="outline" 
            onClick={exportToCSV}
            disabled={filteredCompanies.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            CSV エクスポート
          </Button>
          {companies.length > 0 && (
            <Button variant="danger" onClick={handleDeleteAll}>
              <Trash2 className="w-4 h-4 mr-2" />
              全削除
            </Button>
          )}
        </div>
      </div>

      {/* Quick Actions Bar */}
      {(errorCompanies.length > 0 || completedCompanies.length > 0 || pendingCompanies.length > 0) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-sm font-medium text-blue-900 mb-2">クイックアクション</h3>
              <div className="flex flex-wrap gap-4 text-sm text-blue-700">
                <div className="flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span>エラー: {errorCompanies.length}件</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>完了: {completedCompanies.length}件</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
                  <span>未処理: {pendingCompanies.length}件</span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {errorCompanies.length > 0 && (
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={handleRetryErrorCompanies}
                  className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  エラー企業を再実行 ({errorCompanies.length}件)
                </Button>
              )}
              <Button 
                size="sm"
                variant="outline"
                onClick={() => handleSelectStatusFilter('error')}
                className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                エラーのみ表示
              </Button>
              <Button 
                size="sm"
                variant="outline"
                onClick={() => handleSelectStatusFilter('pending')}
                className="bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
              >
                未処理のみ表示
              </Button>
              <Button 
                size="sm"
                variant="outline"
                onClick={handleClearFilters}
                className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
              >
                フィルターリセット
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="企業名、ウェブサイト、備考で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div className="min-w-0 lg:w-48">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">全カテゴリー</option>
              {CONSTANTS.COMPANY_CATEGORIES.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="min-w-0 lg:w-32">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as CompanyStatus | '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">全ステータス</option>
              <option value="pending">未処理</option>
              <option value="processing">処理中</option>
              <option value="completed">完了</option>
              <option value="error">エラー</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex border border-gray-300 rounded-md">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sort Controls */}
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="text-gray-500">並び順:</span>
          {[
            { field: 'name' as SortField, label: '企業名' },
            { field: 'category' as SortField, label: 'カテゴリー' },
            { field: 'status' as SortField, label: 'ステータス' },
            { field: 'updatedAt' as SortField, label: '更新日時' }
          ].map(({ field, label }) => (
            <button
              key={field}
              onClick={() => handleSort(field)}
              className={`px-2 py-1 rounded ${
                sortField === field 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {label}
              {sortField === field && (
                <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Company List */}
      {filteredCompanies.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">
            {companies.length === 0 
              ? '企業が登録されていません。企業を追加するか、CSVファイルをインポートしてください。'
              : '検索条件に一致する企業が見つかりません。'
            }
          </p>
        </div>
      ) : (
        <div className={
          viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
            : 'space-y-4'
        }>
          {filteredCompanies.map(company => (
            <CompanyCard
              key={company.id}
              company={company}
              onEdit={openEditForm}
              onDelete={handleDeleteCompany}
              onRetry={handleRetryCompany}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <CompanyForm
        isOpen={showCompanyForm}
        onClose={() => {
          setShowCompanyForm(false);
          setEditingCompany(undefined);
        }}
        onSubmit={editingCompany ? handleUpdateCompany : handleAddCompany}
        company={editingCompany}
        loading={loading}
      />

      <CSVImporter
        isOpen={showCSVImporter}
        onClose={() => setShowCSVImporter(false)}
        onImport={handleImportCompanies}
        loading={loading}
      />
    </div>
  );
};
import React, { useState, useEffect, useMemo } from 'react';
import type { Company, CompanyStatus } from '../../types';
import { CompanyCard } from './CompanyCard';
import { CompanyForm } from './CompanyForm';
import { CSVImporter } from './CSVImporter';
// 一時的なマイグレーション機能（開発時のみ表示）
import { CompanyInfoMigrationPanel } from './CompanyInfoMigrationPanel';
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
  AlertCircle,
  Database
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
  // 一時的なマイグレーションパネル表示状態
  const [showMigrationPanel, setShowMigrationPanel] = useState(false);

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
    return companies.filter(company => company.status === 'mvv_extracted' || company.status === 'fully_completed');
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
          aValue = (a.category || '未分類').toLowerCase();
          bValue = (b.category || '未分類').toLowerCase();
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
      const result = await addCompanies(importData);
      // CSVImporter内で詳細結果を表示するため、ここでは閉じない
      return result;
    } catch (error) {
      // Error is handled by the store and notification hook
      throw error;
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
      <div className="flex flex-col space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">企業管理</h2>
            <p className="text-gray-600 mt-1">
              {filteredCompanies.length} / {companies.length} 件の企業
            </p>
          </div>

          {/* Primary Actions - Mobile Optimized */}
          <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
            <Button onClick={openAddForm} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">企業追加</span>
              <span className="sm:hidden">追加</span>
            </Button>
            <Button variant="outline" onClick={() => setShowCSVImporter(true)} className="w-full sm:w-auto">
              <Upload className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">CSV インポート</span>
              <span className="sm:hidden">インポート</span>
            </Button>
          </div>
        </div>
        
        {/* Secondary Actions - Collapsible on Mobile */}
        <div className="flex flex-col sm:flex-row gap-2">
          {/* 一時的なマイグレーションボタン（開発環境のみ） */}
          {CONSTANTS.FEATURES.COMPANY_INFO_MIGRATION && (
            <Button 
              variant="outline" 
              onClick={() => setShowMigrationPanel(true)}
              className="w-full sm:w-auto bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              <Database className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">企業情報移行</span>
              <span className="sm:hidden">移行</span>
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={exportToCSV}
            disabled={filteredCompanies.length === 0}
            className="w-full sm:w-auto"
          >
            <Download className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">CSV エクスポート</span>
            <span className="sm:hidden">エクスポート</span>
          </Button>
          {companies.length > 0 && (
            <Button variant="danger" onClick={handleDeleteAll} className="w-full sm:w-auto">
              <Trash2 className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">全削除</span>
              <span className="sm:hidden">削除</span>
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
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="企業名、ウェブサイト、備考で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
          />
        </div>

        {/* Filters Row - Stacked on Mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリー</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="">全て</option>
              {CONSTANTS.COMPANY_CATEGORIES.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as CompanyStatus | '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="">全て</option>
              <option value="pending">未処理</option>
              <option value="processing">処理中</option>
              <option value="completed">完了</option>
              <option value="error">エラー</option>
            </select>
          </div>

          {/* Sort Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">並び順</label>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="name">企業名</option>
              <option value="category">カテゴリー</option>
              <option value="status">ステータス</option>
              <option value="updatedAt">更新日時</option>
            </select>
          </div>

          {/* View Controls */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">表示</label>
            <div className="flex gap-2">
              {/* Sort Direction */}
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                title={`${sortOrder === 'asc' ? '昇順' : '降順'}に並び替え`}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
              
              {/* View Mode Toggle */}
              <div className="flex border border-gray-300 rounded-md">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                  title="グリッド表示"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                  title="リスト表示"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Clear Filters Button */}
        {(searchQuery || selectedCategory || selectedStatus || sortField !== 'updatedAt' || sortOrder !== 'desc') && (
          <div className="flex justify-center pt-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleClearFilters}
              className="text-gray-600"
            >
              フィルターをリセット
            </Button>
          </div>
        )}
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

      {/* 一時的なマイグレーションパネル（開発環境のみ） */}
      {CONSTANTS.FEATURES.COMPANY_INFO_MIGRATION && showMigrationPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-semibold text-gray-900">企業情報移行パネル</h2>
              <button
                onClick={() => setShowMigrationPanel(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <CompanyInfoMigrationPanel />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
import React from 'react';
import { useAnalysisStore } from '../../stores/analysisStore';
import { Search, Filter, X } from 'lucide-react';

const AnalysisFilters: React.FC = () => {
  const { 
    filters, 
    setFilters, 
    getCategoryList,
    getFilteredCompanies 
  } = useAnalysisStore();

  const categories = getCategoryList();
  const filteredCount = getFilteredCompanies().length;

  const handleCategoryToggle = (category: string) => {
    const newCategories = filters.selectedCategories.includes(category)
      ? filters.selectedCategories.filter(c => c !== category)
      : [...filters.selectedCategories, category];
    
    setFilters({ selectedCategories: newCategories });
  };

  const handleSelectAllCategories = () => {
    setFilters({ selectedCategories: categories });
  };

  const handleClearAllCategories = () => {
    setFilters({ selectedCategories: [] });
  };

  const handleSearchChange = (value: string) => {
    setFilters({ searchTerm: value });
  };

  const clearSearch = () => {
    setFilters({ searchTerm: '' });
  };

  return (
    <div className="space-y-4">
      {/* 検索フィルター */}
      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="企業名やMVVの内容で検索..."
            value={filters.searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          {filters.searchTerm && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <button
                onClick={clearSearch}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        
        <div className="text-sm text-gray-600">
          {filteredCount}社表示中 / 全{categories.length}業界
        </div>
      </div>

      {/* カテゴリフィルター */}
      <div className="flex items-center flex-wrap gap-3">
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">業界:</span>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={handleSelectAllCategories}
            className="text-xs px-2 py-1 border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
          >
            全選択
          </button>
          <button
            onClick={handleClearAllCategories}
            className="text-xs px-2 py-1 border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
          >
            全解除
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map((category) => {
            const isSelected = filters.selectedCategories.includes(category);
            return (
              <button
                key={category}
                onClick={() => handleCategoryToggle(category)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  isSelected
                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                    : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                {category}
                {isSelected && (
                  <span className="ml-1 text-blue-600">✓</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* アクティブフィルターの表示 */}
      {(filters.searchTerm || filters.selectedCategories.length !== categories.length) && (
        <div className="flex items-center space-x-2 text-sm">
          <span className="text-gray-500">アクティブフィルター:</span>
          
          {filters.searchTerm && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              検索: "{filters.searchTerm}"
              <button
                onClick={clearSearch}
                className="ml-1 text-yellow-600 hover:text-yellow-800"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          
          {filters.selectedCategories.length !== categories.length && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {filters.selectedCategories.length}業界選択
              <button
                onClick={handleSelectAllCategories}
                className="ml-1 text-blue-600 hover:text-blue-800"
                title="全業界を選択"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default AnalysisFilters;
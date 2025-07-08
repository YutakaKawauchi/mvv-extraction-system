import { create } from 'zustand';
import type { AnalysisData, AnalysisFilters, AnalysisCompany } from '../types/analysis';

interface AnalysisStore {
  // データ状態
  data: AnalysisData | null;
  isLoading: boolean;
  error: string | null;
  
  // フィルター状態
  filters: AnalysisFilters;
  selectedCompany: AnalysisCompany | null;
  
  // アクション
  loadAnalysisData: () => Promise<void>;
  setFilters: (filters: Partial<AnalysisFilters>) => void;
  setSelectedCompany: (company: AnalysisCompany | null) => void;
  clearError: () => void;
  
  // 計算済みデータ
  getFilteredCompanies: () => AnalysisCompany[];
  getSimilarCompanies: (companyId: string, limit?: number) => Array<{ company: AnalysisCompany; similarity: number }>;
  getCategoryList: () => string[];
}

export const useAnalysisStore = create<AnalysisStore>((set, get) => ({
  // 初期状態
  data: null,
  isLoading: false,
  error: null,
  
  filters: {
    selectedCategories: [],
    minSimilarity: 0,
    maxSimilarity: 1,
    searchTerm: ''
  },
  
  selectedCompany: null,
  
  // 分析データ読み込み
  loadAnalysisData: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch('/mvv-analysis-data.json');
      
      if (!response.ok) {
        throw new Error(`分析データの読み込みに失敗しました: ${response.status}`);
      }
      
      const data: AnalysisData = await response.json();
      
      const allCategories = Object.keys(data.categoryAnalysis);
      set({ 
        data, 
        isLoading: false,
        filters: {
          ...get().filters,
          selectedCategories: allCategories
        }
      });
      
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '不明なエラーが発生しました',
        isLoading: false 
      });
    }
  },
  
  // フィルター更新
  setFilters: (newFilters) => {
    set(state => ({
      filters: { ...state.filters, ...newFilters }
    }));
  },
  
  // 選択企業更新
  setSelectedCompany: (company) => {
    set({ selectedCompany: company });
  },
  
  // エラークリア
  clearError: () => {
    set({ error: null });
  },
  
  // フィルター適用済み企業リスト
  getFilteredCompanies: () => {
    const { data, filters } = get();
    if (!data) return [];
    
    return data.companies.filter(company => {
      // カテゴリフィルター
      if (filters.selectedCategories.length > 0 && 
          !filters.selectedCategories.includes(company.category)) {
        return false;
      }
      
      // 検索フィルター
      if (filters.searchTerm && 
          !company.name.toLowerCase().includes(filters.searchTerm.toLowerCase()) &&
          !company.mission.toLowerCase().includes(filters.searchTerm.toLowerCase()) &&
          !company.vision.toLowerCase().includes(filters.searchTerm.toLowerCase()) &&
          !company.values.toLowerCase().includes(filters.searchTerm.toLowerCase())) {
        return false;
      }
      
      return true;
    });
  },
  
  // 類似企業取得
  getSimilarCompanies: (companyId: string, limit = 5) => {
    const { data } = get();
    if (!data) return [];
    
    const companyIndex = data.companies.findIndex(c => c.id === companyId);
    if (companyIndex === -1) return [];
    
    const similarities = data.similarityMatrix[companyIndex]
      .map((similarity, index) => ({
        company: data.companies[index],
        similarity
      }))
      .filter((_, index) => index !== companyIndex) // 自分自身を除外
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
    
    return similarities;
  },
  
  // カテゴリリスト取得
  getCategoryList: () => {
    const { data } = get();
    if (!data) return [];
    return Object.keys(data.categoryAnalysis);
  }
}));
import { create } from 'zustand';
import type { AnalysisFilters } from '../types/analysis';
import { hybridDataLoader, type HybridAnalysisData, type HybridCompany } from '../services/hybridDataLoader';
import { companyStorage } from '../services/storage';
// import { generateEmbeddings } from '../services/openai';

interface AnalysisStore {
  // データ状態 (ハイブリッド対応)
  data: HybridAnalysisData | null;
  isLoading: boolean;
  error: string | null;
  
  // フィルター状態
  filters: AnalysisFilters;
  selectedCompany: HybridCompany | null;
  
  // アクション (ハイブリッド対応)
  loadAnalysisData: (forceRefresh?: boolean) => Promise<void>;
  generateInsights: (
    type: 'similarity' | 'company' | 'industry',
    companyIds: string[],
    analysisData: any,
    language?: string
  ) => Promise<any>;
  setFilters: (filters: Partial<AnalysisFilters>) => void;
  setSelectedCompany: (company: HybridCompany | null) => void;
  clearError: () => void;
  clearCache: () => void;
  
  // 計算済みデータ (ハイブリッド対応)
  getFilteredCompanies: () => HybridCompany[];
  getSimilarCompanies: (companyId: string, limit?: number) => Array<{ company: HybridCompany; similarity: number }>;
  getCategoryList: () => string[];
  getCacheStats: () => any;
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
  
  // ハイブリッド分析データ読み込み
  loadAnalysisData: async (forceRefresh = false) => {
    set({ isLoading: true, error: null });
    
    try {
      // 1. 静的分析データを読み込み
      const data = await hybridDataLoader.loadHybridData(forceRefresh);
      
      // 2. 企業管理（IndexedDB）から全企業を取得
      const managedCompanies = await companyStorage.getAll();
      
      // 3. 分析済み企業（embeddings持ち）をHybridCompany形式に変換
      const analyzedCompanies = managedCompanies
        .filter(company => (company.status === 'mvv_extracted' || company.status === 'fully_completed') && company.embeddings)
        .map(company => ({
          id: company.id,
          name: company.name,
          category: company.category,
          mission: company.mission || '',
          vision: company.vision || '',
          values: company.values || '',
          embeddings: company.embeddings!,
          confidenceScores: {
            mission: 0.8,
            vision: 0.8,
            values: 0.8
          },
          source: 'api' as const,
          isNew: true,
          lastUpdated: company.updatedAt.toISOString()
        } as HybridCompany));
      
      // 4. 既存の企業と統合（重複チェック）
      const existingIds = new Set(data.companies.map(c => c.id));
      const newCompanies = analyzedCompanies.filter(c => !existingIds.has(c.id));
      
      // 5. 統合されたデータを作成
      const mergedData: HybridAnalysisData = {
        ...data,
        companies: [...data.companies, ...newCompanies],
        metadata: {
          ...data.metadata,
          dynamicCompaniesCount: data.metadata.dynamicCompaniesCount + newCompanies.length
        }
      };
      
      // 6. カテゴリリストを更新
      const allCategories = [...new Set(mergedData.companies.map(c => c.category))];
      
      set({ 
        data: mergedData, 
        isLoading: false,
        filters: {
          ...get().filters,
          selectedCategories: allCategories
        }
      });
      
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '分析データの読み込みに失敗しました',
        isLoading: false 
      });
    }
  },


  // AI洞察生成
  generateInsights: async (type, companyIds, analysisData, language = 'ja') => {
    try {
      return await hybridDataLoader.generateInsights(type, companyIds, analysisData, language);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '洞察の生成に失敗しました';
      set({ error: errorMessage });
      throw error;
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

  // キャッシュクリア
  clearCache: () => {
    hybridDataLoader.clearCache();
    set({ data: null });
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
    
    const selectedCompany = data.companies[companyIndex];
    
    // 動的企業の場合は類似度マトリックスが存在しないため、空配列を返す
    if (selectedCompany.source === 'api' || !data.similarityMatrix || !data.similarityMatrix[companyIndex]) {
      return [];
    }
    
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
  },

  // キャッシュ統計取得
  getCacheStats: () => {
    return hybridDataLoader.getCacheStats();
  }
}));
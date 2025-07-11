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
      console.log(`IndexedDBから${managedCompanies.length}社を取得`);
      
      const analyzedCompanies = managedCompanies
        .filter(company => {
          const hasValidEmbeddings = company.embeddings && 
            Array.isArray(company.embeddings) && 
            company.embeddings.length > 0;
          const hasValidStatus = company.status === 'mvv_extracted' || company.status === 'fully_completed';
          
          if (!hasValidStatus) {
            console.log(`${company.name}: ステータス不適合 (${company.status})`);
          }
          if (!hasValidEmbeddings) {
            console.log(`${company.name}: 埋め込みベクトル不適合 (${company.embeddings ? '長さ:' + company.embeddings.length : 'なし'})`);
          }
          
          return hasValidStatus && hasValidEmbeddings;
        })
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
      
      // 5. 統合されたデータを作成（静的データを無視してリアルタイムデータのみ使用）
      console.log(`結果: 既存${data.companies.length}社 + 新規${newCompanies.length}社 = 合計${analyzedCompanies.length}社`);
      
      const mergedData: HybridAnalysisData = {
        summary: {
          totalCompanies: analyzedCompanies.length,
          avgSimilarity: 0.65, // デフォルト値
          maxSimilarity: 0.95,  // デフォルト値
          maxSimilarPair: [analyzedCompanies[0], analyzedCompanies[1]] as any,
          categoryAnalysis: {}
        },
        companies: analyzedCompanies, // 静的データを無視してIndexedDBデータのみ使用
        similarityMatrix: [], // リアルタイム計算するため空
        topSimilarities: [], // リアルタイム計算するため空
        categoryAnalysis: {},
        metadata: {
          staticDataVersion: 'none',
          lastStaticLoad: new Date().toISOString(),
          dynamicCompaniesCount: analyzedCompanies.length,
          lastApiUpdate: new Date().toISOString(),
          hybridVersion: '3.0-realtime-only'
        }
      };
      
      // 6. デバッグ情報を出力
      console.log('🔍 Analysis Store データ統合結果:');
      console.log(`  - 静的企業数: ${data.companies.length}`);
      console.log(`  - 動的企業数: ${newCompanies.length}`);
      console.log(`  - 総企業数: ${mergedData.companies.length}`);
      console.log(`  - 埋め込みベクトル保持企業数: ${mergedData.companies.filter(c => c.embeddings && Array.isArray(c.embeddings) && c.embeddings.length > 0).length}`);
      
      // 動的企業の埋め込みベクトル状況をログ
      if (newCompanies.length > 0) {
        console.log('📊 動的企業の埋め込みベクトル状況:');
        newCompanies.slice(0, 5).forEach(company => {
          console.log(`  - ${company.name}: ${company.embeddings ? company.embeddings.length : 0} 次元`);
        });
      }
      
      // 7. カテゴリリストを更新
      const allCategories = [...new Set(mergedData.companies.map(c => c.category))];
      
      set({ 
        data: mergedData, 
        isLoading: false,
        error: null, // エラーをクリア
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
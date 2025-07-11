import { create } from 'zustand';
import type { AnalysisFilters } from '../types/analysis';
import { type HybridAnalysisData, type HybridCompany } from '../services/hybridDataLoader';
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
  
  // リアルタイム分析データ読み込み（IndexedDBのみ）
  loadAnalysisData: async (_forceRefresh = false) => {
    set({ isLoading: true, error: null });
    
    try {
      // 1. 企業管理（IndexedDB）から全企業を取得
      const managedCompanies = await companyStorage.getAll();
      
      // 2. 分析済み企業（embeddings持ち）をHybridCompany形式に変換
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
      
      // 3. リアルタイムデータのみでの分析データ作成
      console.log(`結果: IndexedDBから${analyzedCompanies.length}社を取得`);
      
      const realtimeData: HybridAnalysisData = {
        summary: {
          totalCompanies: analyzedCompanies.length,
          avgSimilarity: 0.65, // デフォルト値
          maxSimilarity: 0.95,  // デフォルト値
          maxSimilarPair: analyzedCompanies.slice(0, 2) as any,
          categoryAnalysis: {}
        },
        companies: analyzedCompanies, // IndexedDBデータのみ使用
        similarityMatrix: [], // リアルタイム計算するため空
        topSimilarities: [], // リアルタイム計算するため空
        categoryAnalysis: {},
        metadata: {
          staticDataVersion: 'none',
          lastStaticLoad: 'none',
          dynamicCompaniesCount: analyzedCompanies.length,
          lastApiUpdate: new Date().toISOString(),
          hybridVersion: '4.0-indexeddb-only'
        }
      };
      
      // 4. デバッグ情報を出力
      console.log('🔍 Analysis Store リアルタイムデータ読み込み結果:');
      console.log(`  - 総企業数: ${realtimeData.companies.length}`);
      console.log(`  - 埋め込みベクトル保持企業数: ${realtimeData.companies.filter(c => c.embeddings && Array.isArray(c.embeddings) && c.embeddings.length > 0).length}`);
      
      // IndexedDB企業の埋め込みベクトル状況をログ
      if (analyzedCompanies.length > 0) {
        console.log('📊 IndexedDB企業の埋め込みベクトル状況:');
        analyzedCompanies.slice(0, 5).forEach(company => {
          console.log(`  - ${company.name}: ${company.embeddings ? company.embeddings.length : 0} 次元`);
        });
      }
      
      // 5. カテゴリリストを更新
      const allCategories = [...new Set(realtimeData.companies.map(c => c.category))];
      
      set({ 
        data: realtimeData, 
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


  // AI洞察生成（現在無効化）
  generateInsights: async (_type, _companyIds, _analysisData, _language = 'ja') => {
    try {
      // AI洞察機能は現在無効化（静的データ依存削除のため）
      throw new Error('AI洞察機能は現在利用できません');
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

  // キャッシュクリア（IndexedDBベース）
  clearCache: () => {
    // IndexedDBベースのため、データをnullに設定するのみ
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

  // キャッシュ統計取得（IndexedDBベース）
  getCacheStats: () => {
    const { data } = get();
    return {
      staticDataExists: false,
      dynamicCompanies: data?.companies?.length || 0,
      cachedInsights: 0,
      lastLoad: data?.metadata?.lastApiUpdate || 'none',
      cacheValid: !!data,
      cacheSize: data ? JSON.stringify(data).length : 0
    };
  }
}));
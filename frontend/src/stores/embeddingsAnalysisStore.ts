/**
 * Embeddings-based Analysis Store
 * Real-time analysis using embeddings data from IndexedDB
 */

import { create } from 'zustand';
import type { Company, MVVData } from '../types';
import { companyStorage, mvvStorage } from '../services/storage';
import { SimilarityCalculator, type CompanyWithSimilarity } from '../services/similarityCalculator';
import { ProgressiveCalculator } from '../services/progressiveCalculator';
import { similarityCache } from '../services/similarityCache';

// Extended Company type with confidence scores and MVV data
export interface CompanyWithScores extends Company {
  confidenceScores?: {
    mission: number;
    vision: number;
    values: number;
  };
  // Override MVV fields with actual data from MVVData table
  mission?: string;
  vision?: string;
  values?: string[] | string;
}

export interface EmbeddingsAnalysisData {
  companies: CompanyWithScores[];
  mvvDataMap: Map<string, MVVData>;
  similarityMatrix: { [companyId: string]: { [companyId: string]: number } };
  categoryAnalysis: {
    [category: string]: {
      companies: CompanyWithScores[];
      avgInternalSimilarity: number;
      avgExternalSimilarity: number;
    };
  };
  summary: {
    totalCompanies: number;
    companiesWithEmbeddings: number;
    avgSimilarity: number;
    maxSimilarity: number;
    minSimilarity: number;
  };
  outliers: (CompanyWithSimilarity & { company: CompanyWithScores })[];
  lastUpdated: string;
}

export interface AnalysisFilters {
  selectedCategories: string[];
  minSimilarity: number;
  maxSimilarity: number;
  searchTerm: string;
  showOnlyWithEmbeddings: boolean;
}

interface EmbeddingsAnalysisStore {
  // Data state
  data: EmbeddingsAnalysisData | null;
  isLoading: boolean;
  error: string | null;
  
  // Filter state
  filters: AnalysisFilters;
  selectedCompany: CompanyWithScores | null;
  
  // Actions
  loadAnalysisData: (forceRefresh?: boolean) => Promise<void>;
  setFilters: (filters: Partial<AnalysisFilters>) => void;
  setSelectedCompany: (company: CompanyWithScores | null) => void;
  clearError: () => void;
  
  // Computed data
  getFilteredCompanies: () => CompanyWithScores[];
  getSimilarCompanies: (companyId: string, limit?: number) => (CompanyWithSimilarity & { company: CompanyWithScores })[];
  getCategoryList: () => string[];
  getCompanyById: (id: string) => CompanyWithScores | undefined;
}

export const useEmbeddingsAnalysisStore = create<EmbeddingsAnalysisStore>((set, get) => ({
  // Initial state
  data: null,
  isLoading: false,
  error: null,
  
  filters: {
    selectedCategories: [],
    minSimilarity: 0,
    maxSimilarity: 1,
    searchTerm: '',
    showOnlyWithEmbeddings: true
  },
  
  selectedCompany: null,
  
  // Load analysis data from IndexedDB
  loadAnalysisData: async (forceRefresh = false) => {
    set({ isLoading: true, error: null });
    
    try {
      console.log('🔄 Loading embeddings analysis data...');
      
      // Load all companies from IndexedDB
      const allCompanies = await companyStorage.getAll();
      
      // Load all MVV data
      const allMVVData = await mvvStorage.getAll();
      const mvvDataMap = new Map<string, MVVData>();
      
      // Create a map of company ID to the latest active MVV data
      allMVVData
        .filter(mvv => mvv.isActive)
        .sort((a, b) => b.extractedAt.getTime() - a.extractedAt.getTime())
        .forEach(mvv => {
          if (!mvvDataMap.has(mvv.companyId)) {
            mvvDataMap.set(mvv.companyId, mvv);
          }
        });
      
      // Merge companies with their confidence scores and MVV data
      const companiesWithScores: CompanyWithScores[] = allCompanies.map(company => {
        const mvvData = mvvDataMap.get(company.id);
        return {
          ...company,
          confidenceScores: mvvData?.confidenceScores,
          // Override with actual MVV data from MVVData table
          mission: mvvData?.mission || company.mission,
          vision: mvvData?.vision || company.vision,
          values: mvvData?.values || company.values
        };
      });
      
      // Filter companies with embeddings for analysis
      const companiesWithEmbeddings = companiesWithScores.filter(
        company => company.embeddings && company.embeddings.length > 0
      );
      
      console.log(`📊 Found ${companiesWithEmbeddings.length} companies with embeddings out of ${allCompanies.length} total`);
      
      if (companiesWithEmbeddings.length === 0) {
        set({
          data: {
            companies: companiesWithScores,
            mvvDataMap,
            similarityMatrix: {},
            categoryAnalysis: {},
            summary: {
              totalCompanies: companiesWithScores.length,
              companiesWithEmbeddings: 0,
              avgSimilarity: 0,
              maxSimilarity: 0,
              minSimilarity: 0
            },
            outliers: [],
            lastUpdated: new Date().toISOString()
          },
          isLoading: false
        });
        return;
      }
      
      // Skip heavy calculations - only basic stats needed for current functionality
      console.log('⚡ Skipping heavy calculations for performance...');
      
      // Empty similarity matrix (not needed for current features)
      const similarityMatrix = {};
      
      // Empty category analysis (tabs are disabled)
      const categoryAnalysis = {};
      
      // Lightweight statistics only
      const summary = {
        totalCompanies: companiesWithScores.length,
        companiesWithEmbeddings: companiesWithEmbeddings.length,
        avgSimilarity: 0, // Will be calculated when needed
        maxSimilarity: 0, // Will be calculated when needed
        minSimilarity: 0  // Will be calculated when needed
      };
      
      console.log(`✅ Basic data loaded instantly for ${companiesWithEmbeddings.length} companies`);
      
      // Skip outliers calculation (heavy operation, not needed for current features)
      const outliers: any[] = [];
      
      const analysisData: EmbeddingsAnalysisData = {
        companies: companiesWithScores,
        mvvDataMap,
        similarityMatrix,
        categoryAnalysis,
        summary,
        outliers: outliers as any,
        lastUpdated: new Date().toISOString()
      };
      
      console.log('✅ Analysis data loaded successfully:', {
        totalCompanies: analysisData.summary.totalCompanies,
        companiesWithEmbeddings: analysisData.summary.companiesWithEmbeddings,
        avgSimilarity: analysisData.summary.avgSimilarity.toFixed(3),
        categories: Object.keys(analysisData.categoryAnalysis).length,
        outliers: analysisData.outliers.length
      });
      
      set({ 
        data: analysisData, 
        isLoading: false 
      });
      
    } catch (error) {
      console.error('❌ Failed to load analysis data:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load analysis data',
        isLoading: false 
      });
    }
  },
  
  // Update filters
  setFilters: (newFilters) => {
    set(state => ({
      filters: { ...state.filters, ...newFilters }
    }));
  },
  
  // Set selected company
  setSelectedCompany: (company) => {
    set({ selectedCompany: company });
  },
  
  // Clear error
  clearError: () => {
    set({ error: null });
  },
  
  // Get filtered companies list
  getFilteredCompanies: () => {
    const { data, filters } = get();
    if (!data) return [];
    
    let companies = data.companies;
    
    // Filter by embeddings availability
    if (filters.showOnlyWithEmbeddings) {
      companies = companies.filter(c => c.embeddings && c.embeddings.length > 0);
    }
    
    return companies.filter(company => {
      // Category filter
      if (filters.selectedCategories.length > 0 && 
          !filters.selectedCategories.includes(company.category)) {
        return false;
      }
      
      // Search filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const searchFields = [
          company.name,
          company.mission || '',
          company.vision || '',
          (company.values || []).join(' ')
        ].join(' ').toLowerCase();
        
        if (!searchFields.includes(searchLower)) {
          return false;
        }
      }
      
      return true;
    });
  },
  
  // Get similar companies for a given company ID
  getSimilarCompanies: (companyId: string, limit = 5) => {
    const { data } = get();
    if (!data) return [];
    
    const targetCompany = data.companies.find(c => c.id === companyId);
    if (!targetCompany) return [];
    
    const companiesWithEmbeddings = data.companies.filter(
      c => c.embeddings && c.embeddings.length > 0
    );
    
    const results = SimilarityCalculator.findSimilarCompanies(
      targetCompany, 
      companiesWithEmbeddings, 
      limit
    );
    
    // Return with CompanyWithScores type
    return results as (CompanyWithSimilarity & { company: CompanyWithScores })[];
  },
  
  // Get list of all categories
  getCategoryList: () => {
    const { data } = get();
    if (!data) return [];
    return Object.keys(data.categoryAnalysis);
  },
  
  // Get company by ID
  getCompanyById: (id: string) => {
    const { data } = get();
    if (!data) return undefined;
    return data.companies.find(c => c.id === id);
  }
}));
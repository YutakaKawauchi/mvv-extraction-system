export interface AnalysisCompany {
  id: string;
  name: string;
  category: string;
  mission: string;
  vision: string;
  values: string;
  confidenceScores: {
    mission: number;
    vision: number;
    values: number;
  };
}

export interface SimilarCompany {
  name: string;
  category: string;
  similarity: number;
}

export interface TopSimilarity {
  company: {
    id: string;
    name: string;
    category: string;
  };
  mostSimilar: SimilarCompany[];
}

export interface CategoryAnalysis {
  [category: string]: {
    companies: AnalysisCompany[];
    avgInternalSimilarity: number;
    avgExternalSimilarity: number;
  };
}

export interface AnalysisSummary {
  totalCompanies: number;
  avgSimilarity: number;
  maxSimilarity: number;
  maxSimilarPair: [AnalysisCompany, AnalysisCompany];
  categoryAnalysis: CategoryAnalysis;
}

export interface AnalysisData {
  summary: AnalysisSummary;
  companies: AnalysisCompany[];
  similarityMatrix: number[][];
  topSimilarities: TopSimilarity[];
  categoryAnalysis: CategoryAnalysis;
}

export interface AnalysisFilters {
  selectedCategories: string[];
  minSimilarity: number;
  maxSimilarity: number;
  searchTerm: string;
}
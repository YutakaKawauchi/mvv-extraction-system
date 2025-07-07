export interface MVVData {
  id?: number;
  companyId: string;
  version: number;
  mission: string | null;
  vision: string | null;
  values: string[];
  confidenceScores: {
    mission: number;
    vision: number;
    values: number;
  };
  extractedAt: Date;
  source: 'openai' | 'manual';
  isActive: boolean;
  extractedFrom?: string;
}

export interface MVVExtractionRequest {
  companyId: string;
  companyName: string;
  companyWebsite: string;
  companyDescription?: string;
}

export interface MVVExtractionResponse {
  success: boolean;
  data?: {
    mission: string | null;
    vision: string | null;
    values: string[];
    confidence_scores: {
      mission: number;
      vision: number;
      values: number;
    };
    extracted_from: string;
  };
  error?: string;
}
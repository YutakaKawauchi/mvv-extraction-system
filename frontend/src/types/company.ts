export type CompanyStatus = 
  | 'pending' 
  | 'processing' 
  | 'mvv_extracted' 
  | 'fully_completed' 
  | 'mvv_extraction_error'      // Phase 1 エラー
  | 'embeddings_generation_error' // Phase 2 エラー
  | 'error';                    // 一般的なエラー（後方互換性のため）

export interface Company {
  id: string;
  name: string;
  website: string;
  category: string;
  notes?: string;
  status: CompanyStatus;
  createdAt: Date;
  updatedAt: Date;
  lastProcessed?: Date;
  errorMessage?: string;
  // Phase 2で追加されるフィールド
  embeddings?: number[];
  // MVV情報（Phase 1で追加）
  mission?: string;
  vision?: string;
  values?: string;
}

export interface CompanyFormData {
  name: string;
  website: string;
  category: string;
  notes?: string;
}

export interface CompanyImportData {
  name: string;
  website: string;
  category: string;
  notes?: string;
}
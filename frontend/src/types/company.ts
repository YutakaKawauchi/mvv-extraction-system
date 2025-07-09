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
  category?: string; // 自動設定（産業分類から生成）
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
  category?: string; // Optional for backward compatibility, will be auto-generated
  notes?: string;
}

export interface CompanyImportData {
  name: string;
  website: string;
  category?: string; // Optional for backward compatibility, will be auto-generated
  notes?: string;
}
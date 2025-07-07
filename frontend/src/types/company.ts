export type CompanyStatus = 'pending' | 'processing' | 'completed' | 'error';

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
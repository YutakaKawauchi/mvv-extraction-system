export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface BatchProcessingStatus {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  inProgress: boolean;
  startTime?: Date;
  endTime?: Date;
}

export interface ProcessingLog {
  id?: number;
  companyId: string;
  status: 'started' | 'completed' | 'failed';
  errorMessage?: string;
  apiCost?: number;
  processingTime?: number;
  timestamp: Date;
}
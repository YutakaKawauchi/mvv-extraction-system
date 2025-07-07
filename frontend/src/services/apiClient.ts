import axios from 'axios';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import type { AxiosInstance } from 'axios';
import type { 
  ApiResponse, 
  MVVExtractionRequest, 
  MVVExtractionResponse 
} from '../types';
import { CONSTANTS } from '../utils/constants';
import { AppError, logError } from './errorHandler';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: CONSTANTS.API_BASE_URL,
      timeout: 30000, // 30秒タイムアウト
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': CONSTANTS.API_SECRET
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add timestamp to prevent caching
        if (config.params) {
          config.params._t = Date.now();
        } else {
          config.params = { _t: Date.now() };
        }

        if (CONSTANTS.ENVIRONMENT === 'development') {
          console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`, config.data);
        }

        return config;
      },
      (error) => {
        logError(error, 'API Request Interceptor');
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        if (CONSTANTS.ENVIRONMENT === 'development') {
          console.log(`API Response: ${response.status}`, response.data);
        }
        return response;
      },
      (error) => {
        const apiError = this.handleError(error);
        logError(apiError, 'API Response Interceptor');
        return Promise.reject(apiError);
      }
    );
  }

  private handleError(error: any): AppError {
    if (error.response) {
      // サーバーがエラーレスポンスを返した場合
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          return new AppError(
            data.message || 'リクエストが無効です',
            'BAD_REQUEST',
            data
          );
        case 401:
          return new AppError(
            '認証に失敗しました',
            'UNAUTHORIZED',
            data
          );
        case 403:
          return new AppError(
            'アクセスが拒否されました',
            'FORBIDDEN',
            data
          );
        case 404:
          return new AppError(
            'APIエンドポイントが見つかりません',
            'NOT_FOUND',
            data
          );
        case 429:
          return new AppError(
            'リクエスト制限に達しました。しばらく待ってから再試行してください',
            'RATE_LIMITED',
            data
          );
        case 500:
        case 502:
        case 503:
        case 504:
          return new AppError(
            'サーバーエラーが発生しました。しばらく待ってから再試行してください',
            'SERVER_ERROR',
            data
          );
        default:
          return new AppError(
            data.message || `HTTP エラー: ${status}`,
            'HTTP_ERROR',
            data
          );
      }
    } else if (error.request) {
      // ネットワークエラー
      return new AppError(
        'ネットワークエラーが発生しました。インターネット接続を確認してください',
        'NETWORK_ERROR',
        error
      );
    } else {
      // その他のエラー
      return new AppError(
        error.message || '不明なエラーが発生しました',
        'UNKNOWN_ERROR',
        error
      );
    }
  }

  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.client.request<ApiResponse<T>>(config);
      
      if (!response.data.success) {
        throw new AppError(
          response.data.error || 'APIからエラーレスポンスを受信しました',
          'API_ERROR',
          response.data
        );
      }

      return response.data.data as T;
    } catch (error) {
      throw error;
    }
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request({
      method: 'GET',
      url: '/health'
    });
  }

  // MVV extraction
  async extractMVV(request: MVVExtractionRequest): Promise<MVVExtractionResponse['data']> {
    return this.request({
      method: 'POST',
      url: '/extract-mvv',
      data: request
    });
  }

  // Batch MVV extraction
  async extractMVVBatch(requests: MVVExtractionRequest[]): Promise<{
    results: Array<{
      companyId: string;
      success: boolean;
      data?: MVVExtractionResponse['data'];
      error?: string;
    }>;
    summary: {
      total: number;
      succeeded: number;
      failed: number;
    };
  }> {
    return this.request({
      method: 'POST',
      url: '/extract-mvv-batch',
      data: { requests }
    });
  }
}

// Singleton instance
export const apiClient = new ApiClient();

// Hook for using API client
export const useApiClient = () => {
  return {
    healthCheck: () => apiClient.healthCheck(),
    extractMVV: (request: MVVExtractionRequest) => apiClient.extractMVV(request),
    extractMVVBatch: (requests: MVVExtractionRequest[]) => apiClient.extractMVVBatch(requests)
  };
};
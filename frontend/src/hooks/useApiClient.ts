import { useState, useCallback } from 'react';
import type { MVVExtractionRequest, CompanyInfoExtractionRequest } from '../types';
import { apiClient } from '../services/apiClient';
import { useNotification } from './useNotification';

export const useApiClient = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { error: showError } = useNotification();

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const healthCheck = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await apiClient.healthCheck();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Health check failed';
      setError(errorMessage);
      showError('API接続エラー', errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const extractMVV = useCallback(async (request: MVVExtractionRequest) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await apiClient.extractMVV(request);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'MVV extraction failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const extractMVVPerplexity = useCallback(async (request: MVVExtractionRequest) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await apiClient.extractMVVPerplexity(request);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'MVV extraction with Perplexity failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const extractMVVBatch = useCallback(async (requests: MVVExtractionRequest[]) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await apiClient.extractMVVBatch(requests);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Batch MVV extraction failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const extractCompanyInfo = useCallback(async (request: CompanyInfoExtractionRequest) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await apiClient.extractCompanyInfo(request);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Company info extraction failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    clearError,
    healthCheck,
    extractMVV,
    extractMVVPerplexity,
    extractMVVBatch,
    extractCompanyInfo
  };
};
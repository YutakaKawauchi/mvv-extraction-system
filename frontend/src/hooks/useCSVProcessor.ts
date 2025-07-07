import { useCallback } from 'react';
import type { Company, MVVData } from '../types';
import { CSVProcessor, type CSVExportOptions } from '../services/csvProcessor';
import { useNotification } from './useNotification';

export const useCSVProcessor = () => {
  const { success, error } = useNotification();

  const exportCompanies = useCallback((
    companies: Company[],
    options?: CSVExportOptions
  ) => {
    try {
      const csv = CSVProcessor.exportCompanies(companies, options);
      const filename = CSVProcessor.generateFilename('companies');
      CSVProcessor.downloadCSV(csv, filename);
      success('エクスポート完了', `${companies.length}件の企業データをエクスポートしました`);
    } catch (err) {
      error('エクスポートエラー', '企業データのエクスポートに失敗しました');
    }
  }, [success, error]);

  const exportMVVData = useCallback((
    mvvData: Array<MVVData & { companyName: string }>,
    options?: CSVExportOptions
  ) => {
    try {
      const csv = CSVProcessor.exportMVVData(mvvData, options);
      const filename = CSVProcessor.generateFilename('mvv_data');
      CSVProcessor.downloadCSV(csv, filename);
      success('エクスポート完了', `${mvvData.length}件のMVVデータをエクスポートしました`);
    } catch (err) {
      error('エクスポートエラー', 'MVVデータのエクスポートに失敗しました');
    }
  }, [success, error]);

  const exportCombinedData = useCallback((
    companies: Company[],
    mvvDataMap: Map<string, MVVData>,
    options?: CSVExportOptions
  ) => {
    try {
      const csv = CSVProcessor.exportCombinedData(companies, mvvDataMap, options);
      const filename = CSVProcessor.generateFilename('combined_data');
      CSVProcessor.downloadCSV(csv, filename);
      success('エクスポート完了', '統合データをエクスポートしました');
    } catch (err) {
      error('エクスポートエラー', '統合データのエクスポートに失敗しました');
    }
  }, [success, error]);

  return {
    exportCompanies,
    exportMVVData,
    exportCombinedData
  };
};
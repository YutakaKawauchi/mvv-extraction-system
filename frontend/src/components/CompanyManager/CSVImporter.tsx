import React, { useState, useCallback } from 'react';
import Papa from 'papaparse';
import type { CompanyImportData } from '../../types';
import { Button, Modal } from '../common';
import { validateCSVHeaders, sanitizeInput } from '../../utils/validators';
import { CONSTANTS } from '../../utils/constants';
import { Upload, Download, AlertCircle, CheckCircle } from 'lucide-react';

interface CSVImporterProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (companies: CompanyImportData[]) => void;
  loading?: boolean;
}

export const CSVImporter: React.FC<CSVImporterProps> = ({
  isOpen,
  onClose,
  onImport,
  loading = false
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [parseResult, setParseResult] = useState<{
    data: CompanyImportData[];
    errors: string[];
    warnings: string[];
  } | null>(null);

  const downloadTemplate = useCallback(() => {
    const template = `name,website,category,notes
株式会社サンプル,https://example.com,ヘルスケア,サンプル企業
エムスリー株式会社,https://corporate.m3.com,ヘルスケア,医療情報サービス`;

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'company_template.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }, []);

  const processCSV = useCallback((file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => {
        const errors: string[] = [];
        const warnings: string[] = [];
        const validData: CompanyImportData[] = [];

        // Check headers
        const headers = results.meta.fields || [];
        if (!validateCSVHeaders(headers)) {
          errors.push('CSVファイルに必要なヘッダー（name, website, category）が含まれていません');
          setParseResult({ data: [], errors, warnings });
          return;
        }

        // Process data
        results.data.forEach((row: any, index: number) => {
          const rowNum = index + 2; // +2 for header and 0-based index
          
          const name = sanitizeInput(row.name || '').trim();
          const website = sanitizeInput(row.website || '').trim();
          const category = sanitizeInput(row.category || '').trim();
          const notes = row.notes ? sanitizeInput(row.notes).trim() : undefined;

          // Validate required fields
          if (!name) {
            errors.push(`行 ${rowNum}: 企業名が空です`);
            return;
          }
          if (!website) {
            errors.push(`行 ${rowNum}: ウェブサイトが空です`);
            return;
          }
          if (!category) {
            errors.push(`行 ${rowNum}: カテゴリーが空です`);
            return;
          }

          // Validate URL format
          try {
            new URL(website);
          } catch {
            errors.push(`行 ${rowNum}: 無効なURL形式です - ${website}`);
            return;
          }

          // Validate category
          if (!CONSTANTS.COMPANY_CATEGORIES.includes(category as any)) {
            warnings.push(`行 ${rowNum}: 未知のカテゴリー「${category}」が使用されています`);
          }

          // Check for duplicates in current import
          const duplicate = validData.find(item => 
            item.name === name || item.website === website
          );
          if (duplicate) {
            warnings.push(`行 ${rowNum}: 重複する企業です - ${name}`);
          }

          validData.push({
            name,
            website,
            category,
            notes
          });
        });

        setParseResult({ data: validData, errors, warnings });
      },
      error: (error) => {
        setParseResult({
          data: [],
          errors: [`CSVファイルの解析に失敗しました: ${error.message}`],
          warnings: []
        });
      }
    });
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    const csvFile = files.find(file => file.type === 'text/csv' || file.name.endsWith('.csv'));
    
    if (csvFile) {
      processCSV(csvFile);
    } else {
      setParseResult({
        data: [],
        errors: ['CSVファイルを選択してください'],
        warnings: []
      });
    }
  }, [processCSV]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processCSV(file);
    }
  }, [processCSV]);

  const handleImport = () => {
    if (parseResult?.data.length) {
      onImport(parseResult.data);
      setParseResult(null);
    }
  };

  const handleClose = () => {
    setParseResult(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="CSV一括インポート"
      size="lg"
    >
      <div className="space-y-4">
        {/* Template Download */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-blue-900">CSVテンプレート</h4>
              <p className="text-sm text-blue-700 mt-1">
                正しい形式でファイルを作成するためのテンプレートをダウンロードできます
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
            >
              <Download className="w-4 h-4 mr-2" />
              テンプレート
            </Button>
          </div>
        </div>

        {/* File Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragActive 
              ? 'border-blue-400 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="mx-auto h-12 w-12 text-gray-400" />
          <div className="mt-4">
            <label htmlFor="csv-upload" className="cursor-pointer">
              <span className="text-sm font-medium text-blue-600 hover:text-blue-500">
                ファイルを選択
              </span>
              <span className="text-sm text-gray-600"> またはドラッグ&ドロップ</span>
              <input
                id="csv-upload"
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                className="sr-only"
              />
            </label>
          </div>
          <p className="text-xs text-gray-500 mt-2">CSV形式のファイルのみ対応</p>
        </div>

        {/* Parse Results */}
        {parseResult && (
          <div className="space-y-3">
            {/* Errors */}
            {parseResult.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <div className="flex items-center mb-2">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                  <h4 className="text-sm font-medium text-red-900">エラー</h4>
                </div>
                <ul className="text-sm text-red-700 space-y-1">
                  {parseResult.errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {parseResult.warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <div className="flex items-center mb-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
                  <h4 className="text-sm font-medium text-yellow-900">警告</h4>
                </div>
                <ul className="text-sm text-yellow-700 space-y-1">
                  {parseResult.warnings.map((warning, index) => (
                    <li key={index}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Success */}
            {parseResult.data.length > 0 && parseResult.errors.length === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-md p-3">
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                  <h4 className="text-sm font-medium text-green-900">
                    {parseResult.data.length}件の企業データを読み込みました
                  </h4>
                </div>
                
                {/* Preview */}
                <div className="mt-3 max-h-40 overflow-y-auto">
                  <div className="text-xs text-green-700 space-y-1">
                    {parseResult.data.slice(0, 5).map((company, index) => (
                      <div key={index} className="flex justify-between">
                        <span>{company.name}</span>
                        <span className="text-green-600">{company.category}</span>
                      </div>
                    ))}
                    {parseResult.data.length > 5 && (
                      <div className="text-center text-green-600 font-medium">
                        他 {parseResult.data.length - 5} 件...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            キャンセル
          </Button>
          <Button
            onClick={handleImport}
            loading={loading}
            disabled={loading || !parseResult?.data.length || parseResult.errors.length > 0}
          >
            {parseResult?.data.length || 0}件をインポート
          </Button>
        </div>
      </div>
    </Modal>
  );
};
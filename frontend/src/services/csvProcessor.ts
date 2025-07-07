import Papa from 'papaparse';
import type { Company, MVVData } from '../types';
import { formatDate } from '../utils/formatters';

export interface CSVExportOptions {
  includeIds?: boolean;
  includeTimestamps?: boolean;
  includeMetadata?: boolean;
}

export class CSVProcessor {
  // Export companies to CSV
  static exportCompanies(
    companies: Company[], 
    options: CSVExportOptions = {}
  ): string {
    const {
      includeIds = false,
      includeTimestamps = true,
      includeMetadata = true
    } = options;

    const headers = [
      ...(includeIds ? ['id'] : []),
      'name',
      'website', 
      'category',
      'status',
      'notes',
      ...(includeTimestamps ? ['createdAt', 'updatedAt'] : []),
      ...(includeMetadata ? ['lastProcessed', 'errorMessage'] : [])
    ];

    const data = companies.map(company => ({
      ...(includeIds ? { id: company.id } : {}),
      name: company.name,
      website: company.website,
      category: company.category,
      status: company.status,
      notes: company.notes || '',
      ...(includeTimestamps ? {
        createdAt: formatDate(company.createdAt),
        updatedAt: formatDate(company.updatedAt)
      } : {}),
      ...(includeMetadata ? {
        lastProcessed: company.lastProcessed ? formatDate(company.lastProcessed) : '',
        errorMessage: company.errorMessage || ''
      } : {})
    }));

    return Papa.unparse({
      fields: headers,
      data: data
    }, {
      header: true,
      quotes: true
    });
  }

  // Export MVV data to CSV
  static exportMVVData(
    mvvData: Array<MVVData & { companyName: string }>,
    options: CSVExportOptions = {}
  ): string {
    const {
      includeIds = false,
      includeTimestamps = true,
      includeMetadata = true
    } = options;

    const headers = [
      ...(includeIds ? ['id', 'companyId'] : []),
      'companyName',
      'mission',
      'vision',
      'values',
      'missionConfidence',
      'visionConfidence',
      'valuesConfidence',
      'source',
      ...(includeTimestamps ? ['extractedAt'] : []),
      ...(includeMetadata ? ['version', 'isActive', 'extractedFrom'] : [])
    ];

    const data = mvvData.map(mvv => ({
      ...(includeIds ? {
        id: mvv.id || '',
        companyId: mvv.companyId
      } : {}),
      companyName: mvv.companyName,
      mission: mvv.mission || '',
      vision: mvv.vision || '',
      values: mvv.values.join('; '),
      missionConfidence: mvv.confidenceScores.mission,
      visionConfidence: mvv.confidenceScores.vision,
      valuesConfidence: mvv.confidenceScores.values,
      source: mvv.source,
      ...(includeTimestamps ? {
        extractedAt: formatDate(mvv.extractedAt)
      } : {}),
      ...(includeMetadata ? {
        version: mvv.version,
        isActive: mvv.isActive ? 'Yes' : 'No',
        extractedFrom: mvv.extractedFrom || ''
      } : {})
    }));

    return Papa.unparse({
      fields: headers,
      data: data
    }, {
      header: true,
      quotes: true
    });
  }

  // Export combined data (companies + MVV) to CSV
  static exportCombinedData(
    companies: Company[],
    mvvDataMap: Map<string, MVVData>,
    options: CSVExportOptions = {}
  ): string {
    const {
      includeIds = false,
      includeTimestamps = true,
      includeMetadata = true
    } = options;

    const headers = [
      ...(includeIds ? ['companyId'] : []),
      'companyName',
      'website',
      'category',
      'status',
      'notes',
      'mission',
      'vision',
      'values',
      'missionConfidence',
      'visionConfidence', 
      'valuesConfidence',
      'extractionSource',
      ...(includeTimestamps ? [
        'companyCreatedAt',
        'companyUpdatedAt',
        'mvvExtractedAt'
      ] : []),
      ...(includeMetadata ? [
        'lastProcessed',
        'errorMessage',
        'mvvVersion',
        'extractedFrom'
      ] : {})
    ];

    const data = companies.map(company => {
      const mvv = mvvDataMap.get(company.id);
      
      return {
        ...(includeIds ? { companyId: company.id } : {}),
        companyName: company.name,
        website: company.website,
        category: company.category,
        status: company.status,
        notes: company.notes || '',
        mission: mvv?.mission || '',
        vision: mvv?.vision || '',
        values: mvv?.values.join('; ') || '',
        missionConfidence: mvv?.confidenceScores.mission || '',
        visionConfidence: mvv?.confidenceScores.vision || '',
        valuesConfidence: mvv?.confidenceScores.values || '',
        extractionSource: mvv?.source || '',
        ...(includeTimestamps ? {
          companyCreatedAt: formatDate(company.createdAt),
          companyUpdatedAt: formatDate(company.updatedAt),
          mvvExtractedAt: mvv ? formatDate(mvv.extractedAt) : ''
        } : {}),
        ...(includeMetadata ? {
          lastProcessed: company.lastProcessed ? formatDate(company.lastProcessed) : '',
          errorMessage: company.errorMessage || '',
          mvvVersion: mvv?.version || '',
          extractedFrom: mvv?.extractedFrom || ''
        } : {})
      };
    });

    return Papa.unparse({
      fields: headers,
      data: data
    }, {
      header: true,
      quotes: true
    });
  }

  // Download CSV file
  static downloadCSV(csvContent: string, filename: string): void {
    // Add BOM for Excel compatibility with UTF-8
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { 
      type: 'text/csv;charset=utf-8;' 
    });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  // Generate filename with timestamp
  static generateFilename(prefix: string, extension: string = 'csv'): string {
    const timestamp = new Date().toISOString().split('T')[0];
    return `${prefix}_${timestamp}.${extension}`;
  }
}
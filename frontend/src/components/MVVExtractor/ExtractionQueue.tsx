import React from 'react';
import type { Company } from '../../types';
import { StatusBadge, ProgressBar } from '../common';
import { useProcessingStore } from '../../stores/processingStore';
import { useCompanyStore } from '../../stores/companyStore';
import { formatShortDate } from '../../utils/formatters';
import { Clock, Loader2, CheckCircle, XCircle, Globe } from 'lucide-react';

export const ExtractionQueue: React.FC = () => {
  const { companies } = useCompanyStore();
  const {
    batchStatus,
    processingQueue,
    currentlyProcessing,
    completedIds,
    failedIds
  } = useProcessingStore();

  // Get company details for display
  const getCompanyById = (id: string) => companies.find(c => c.id === id);
  
  const queuedCompanies = processingQueue.map(getCompanyById).filter(Boolean) as Company[];
  const processingCompanies = currentlyProcessing.map(getCompanyById).filter(Boolean) as Company[];
  const completedCompanies = completedIds.map(getCompanyById).filter(Boolean) as Company[];
  const failedCompanies = failedIds.map(getCompanyById).filter(Boolean) as Company[];

  if (!batchStatus.inProgress && batchStatus.total === 0) {
    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200 text-center">
        <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">処理キュー</h3>
        <p className="text-gray-600">
          バッチ処理が開始されると、ここに処理状況が表示されます。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall Progress */}
      {batchStatus.total > 0 && (
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-medium text-gray-900">処理進捗</h3>
            <span className="text-sm text-gray-600">
              {batchStatus.processed} / {batchStatus.total}
            </span>
          </div>
          <ProgressBar
            value={batchStatus.processed}
            max={batchStatus.total}
            size="md"
            color="blue"
            showPercentage
          />
        </div>
      )}

      {/* Currently Processing */}
      {processingCompanies.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin mr-2" />
              <h4 className="text-md font-medium text-gray-900">
                処理中 ({processingCompanies.length})
              </h4>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {processingCompanies.map(company => (
              <CompanyQueueItem
                key={company.id}
                company={company}
                status="processing"
              />
            ))}
          </div>
        </div>
      )}

      {/* Queued */}
      {queuedCompanies.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center">
              <Clock className="w-5 h-5 text-gray-600 mr-2" />
              <h4 className="text-md font-medium text-gray-900">
                待機中 ({queuedCompanies.length})
              </h4>
            </div>
          </div>
          <div className="divide-y divide-gray-200 max-h-60 overflow-y-auto">
            {queuedCompanies.map((company, index) => (
              <CompanyQueueItem
                key={company.id}
                company={company}
                status="queued"
                queuePosition={index + 1}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {completedCompanies.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              <h4 className="text-md font-medium text-gray-900">
                完了 ({completedCompanies.length})
              </h4>
            </div>
          </div>
          <div className="divide-y divide-gray-200 max-h-60 overflow-y-auto">
            {completedCompanies.map(company => (
              <CompanyQueueItem
                key={company.id}
                company={company}
                status="completed"
              />
            ))}
          </div>
        </div>
      )}

      {/* Failed */}
      {failedCompanies.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center">
              <XCircle className="w-5 h-5 text-red-600 mr-2" />
              <h4 className="text-md font-medium text-gray-900">
                失敗 ({failedCompanies.length})
              </h4>
            </div>
          </div>
          <div className="divide-y divide-gray-200 max-h-60 overflow-y-auto">
            {failedCompanies.map(company => (
              <CompanyQueueItem
                key={company.id}
                company={company}
                status="failed"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface CompanyQueueItemProps {
  company: Company;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  queuePosition?: number;
}

const CompanyQueueItem: React.FC<CompanyQueueItemProps> = ({
  company,
  status,
  queuePosition
}) => {
  const statusConfig = {
    queued: {
      icon: Clock,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50'
    },
    processing: {
      icon: Loader2,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      animate: true
    },
    completed: {
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    failed: {
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    }
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={`px-4 py-3 ${config.bgColor}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center min-w-0 flex-1">
          <Icon 
            className={`w-4 h-4 mr-3 flex-shrink-0 ${config.color} ${
              config.animate ? 'animate-spin' : ''
            }`} 
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center">
              <p className="text-sm font-medium text-gray-900 truncate">
                {company.name}
              </p>
              {queuePosition && (
                <span className="ml-2 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded-full">
                  #{queuePosition}
                </span>
              )}
            </div>
            <div className="flex items-center mt-1">
              <Globe className="w-3 h-3 text-gray-400 mr-1" />
              <p className="text-xs text-gray-600 truncate">
                {company.website}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 ml-4">
          <StatusBadge status={company.status} size="sm" />
          {company.lastProcessed && (
            <span className="text-xs text-gray-500">
              {formatShortDate(company.lastProcessed)}
            </span>
          )}
        </div>
      </div>
      
      {/* Error message for failed items */}
      {status === 'failed' && company.errorMessage && (
        <div className="mt-2 text-xs text-red-700 bg-red-100 rounded px-2 py-1">
          {company.errorMessage}
        </div>
      )}
    </div>
  );
};
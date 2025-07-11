import React from 'react';
import type { CompanyStatus } from '../../types';
import { CheckCircle, Clock, AlertCircle, Loader2, Sparkles, XCircle } from 'lucide-react';
import { CONSTANTS } from '../../utils/constants';

interface StatusBadgeProps {
  status: CompanyStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md'
}) => {
  const configs = {
    pending: {
      icon: Clock,
      color: 'bg-gray-100 text-gray-800',
      label: CONSTANTS.STATUS_LABELS.pending,
      animate: false
    },
    processing: {
      icon: Loader2,
      color: 'bg-blue-100 text-blue-800',
      label: CONSTANTS.STATUS_LABELS.processing,
      animate: true
    },
    mvv_extracted: {
      icon: Sparkles,
      color: 'bg-orange-100 text-orange-800',
      label: CONSTANTS.STATUS_LABELS.mvv_extracted,
      animate: false
    },
    fully_completed: {
      icon: CheckCircle,
      color: 'bg-green-100 text-green-800',
      label: CONSTANTS.STATUS_LABELS.fully_completed,
      animate: false
    },
    mvv_extraction_error: {
      icon: XCircle,
      color: 'bg-red-100 text-red-800',
      label: CONSTANTS.STATUS_LABELS.mvv_extraction_error,
      animate: false
    },
    embeddings_generation_error: {
      icon: AlertCircle,
      color: 'bg-yellow-100 text-yellow-800',
      label: CONSTANTS.STATUS_LABELS.embeddings_generation_error,
      animate: false
    },
    error: {
      icon: AlertCircle,
      color: 'bg-red-100 text-red-800',
      label: CONSTANTS.STATUS_LABELS.error,
      animate: false
    }
  };

  const config = configs[status];
  
  // config または icon が存在しない場合のフォールバック
  if (!config || !config.icon) {
    console.warn('Status config or icon is undefined:', { status, config });
    return (
      <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800`}>
        {status}
      </span>
    );
  }
  
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-2.5 py-1.5 text-sm'
  };

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4'
  };

  return (
    <span 
      className={`inline-flex items-center font-medium rounded-full ${config.color} ${sizeClasses[size]}`}
      role="status"
      aria-label={`ステータス: ${config.label}`}
    >
      <Icon 
        className={`mr-1 ${iconSizeClasses[size]} ${config.animate ? 'animate-spin' : ''}`}
        aria-hidden="true"
      />
      <span className="sr-only">ステータス:</span>
      {config.label}
    </span>
  );
};
import React from 'react';
import type { CompanyStatus } from '../../types';
import { CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
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
    completed: {
      icon: CheckCircle,
      color: 'bg-green-100 text-green-800',
      label: CONSTANTS.STATUS_LABELS.completed,
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
    <span className={`inline-flex items-center font-medium rounded-full ${config.color} ${sizeClasses[size]}`}>
      <Icon 
        className={`mr-1 ${iconSizeClasses[size]} ${config.animate ? 'animate-spin' : ''}`} 
      />
      {config.label}
    </span>
  );
};
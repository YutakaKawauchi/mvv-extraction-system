import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
  ariaLabel?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  text,
  className = '',
  ariaLabel
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  const defaultAriaLabel = text || '読み込み中';

  return (
    <div 
      className={`flex items-center justify-center ${className}`}
      role="status"
      aria-label={ariaLabel || defaultAriaLabel}
    >
      <Loader2 
        className={`animate-spin ${sizeClasses[size]} text-blue-600`}
        aria-hidden="true"
      />
      {text && (
        <span className="ml-2 text-gray-600">
          <span className="sr-only">ステータス: </span>
          {text}
        </span>
      )}
    </div>
  );
};
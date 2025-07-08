import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md'
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        onClick={onClose}
        style={{ 
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(107, 114, 128, 0.75)',
          zIndex: 999 
        }}
      />
      
      {/* Modal Container */}
      <div style={{ 
        position: 'fixed',
        inset: 0,
        overflowY: 'auto',
        zIndex: 1000 
      }}>
        <div style={{
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          {/* Modal */}
          <div className={`relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all ${sizeClasses[size]} w-full`}>
            {/* Header */}
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium leading-6 text-gray-900">
                  {title}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <span className="sr-only">Close</span>
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="max-h-[calc(90vh-8rem)] overflow-y-auto px-4 pt-5 pb-4 sm:p-6">
              {children}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
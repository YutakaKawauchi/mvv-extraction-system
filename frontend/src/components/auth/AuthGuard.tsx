import React, { useEffect } from 'react';
import { useAuthStore, startTokenRefresh, stopTokenRefresh } from '../../stores/authStore';
import { Login } from './Login';
import { LoadingSpinner } from '../common';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ 
  children, 
  fallback 
}) => {
  const { 
    isAuthenticated, 
    isLoading, 
    checkAuth 
  } = useAuthStore();

  useEffect(() => {
    // Check authentication on mount
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    // Start token refresh when authenticated
    if (isAuthenticated) {
      startTokenRefresh();
    } else {
      stopTokenRefresh();
    }

    // Cleanup on unmount
    return () => {
      stopTokenRefresh();
    };
  }, [isAuthenticated]);

  // Show loading state during initial auth check
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mb-4" />
          <p className="text-gray-600">認証状態を確認中...</p>
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return fallback || <Login />;
  }

  // Show children if authenticated
  return <>{children}</>;
};
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const handleError = (error: unknown): string => {
  if (error instanceof AppError) {
    return error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return 'An unexpected error occurred';
};

export const isNetworkError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return error.message.toLowerCase().includes('network') ||
           error.message.toLowerCase().includes('fetch');
  }
  return false;
};

export const isAuthError = (error: unknown): boolean => {
  if (error instanceof AppError) {
    return error.code === 'AUTH_ERROR' || error.code === 'UNAUTHORIZED';
  }
  return false;
};

export const logError = (error: unknown, context?: string): void => {
  const timestamp = new Date().toISOString();
  const errorInfo = {
    timestamp,
    context,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error
  };
  
  if (import.meta.env.DEV) {
    console.error('Error logged:', errorInfo);
  }
  
  // 本番環境では、エラートラッキングサービスに送信
  // 例: Sentry.captureException(error, { extra: errorInfo });
};
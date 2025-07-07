import { useEffect, useState } from 'react';
import { initializeDatabase } from '../services/storage';

export const useIndexedDB = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        await initializeDatabase();
        setIsInitialized(true);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Database initialization failed';
        setError(errorMessage);
        console.error('IndexedDB initialization error:', err);
      }
    };

    initialize();
  }, []);

  return { isInitialized, error };
};
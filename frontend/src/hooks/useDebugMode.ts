import { useState, useEffect } from 'react';

/**
 * デバッグモード管理フック
 * 
 * Ctrl+Shift+D でデバッグパネルを表示/非表示切り替え
 * 本番環境でも使用可能（ただし警告表示）
 */
export const useDebugMode = () => {
  const [isDebugVisible, setIsDebugVisible] = useState(false);
  const [debugStats, setDebugStats] = useState({
    keyPressCount: 0,
    lastActivated: null as Date | null,
    environment: import.meta.env.VITE_ENVIRONMENT || 'development'
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+Shift+D でデバッグモード切り替え
      if (event.ctrlKey && event.shiftKey && event.code === 'KeyD') {
        event.preventDefault();
        setIsDebugVisible(prev => !prev);
        setDebugStats(prev => ({
          ...prev,
          keyPressCount: prev.keyPressCount + 1,
          lastActivated: new Date()
        }));
        
        // 本番環境では警告
        if (import.meta.env.PROD) {
          console.warn('🚨 Debug mode activated in production environment');
          console.warn('This should only be used for testing purposes');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const closeDebug = () => {
    setIsDebugVisible(false);
  };

  return {
    isDebugVisible,
    closeDebug,
    debugStats
  };
};
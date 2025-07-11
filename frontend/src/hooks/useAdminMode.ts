/**
 * 管理者モード状態管理フック
 * Ctrl+Shift+A でトグル
 */

import { useState, useEffect } from 'react';

export const useAdminMode = () => {
  const [isAdminMode, setIsAdminMode] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+Shift+A で管理者モードトグル
      if (event.ctrlKey && event.shiftKey && event.key === 'A') {
        event.preventDefault();
        setIsAdminMode(prev => {
          const newState = !prev;
          console.log(`🔐 管理者モード: ${newState ? 'ON' : 'OFF'}`);
          return newState;
        });
      }

      // ESC キーで管理者モード終了
      if (event.key === 'Escape' && isAdminMode) {
        setIsAdminMode(false);
        console.log('🔐 管理者モード: OFF (ESC)');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdminMode]);

  const openAdminMode = () => setIsAdminMode(true);
  const closeAdminMode = () => setIsAdminMode(false);
  const toggleAdminMode = () => setIsAdminMode(prev => !prev);

  return {
    isAdminMode,
    openAdminMode,
    closeAdminMode,
    toggleAdminMode
  };
};
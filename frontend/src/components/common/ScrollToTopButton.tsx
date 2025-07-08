import React, { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';

/**
 * ScrollToTopButton - スクロールトップボタンコンポーネント
 * 縦に長いページで使用する洗練されたフローティングボタン
 */
export const ScrollToTopButton: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // スクロール位置を監視して表示/非表示を制御
  useEffect(() => {
    const toggleVisibility = () => {
      // 画面高さの50%を超えてスクロールした場合に表示
      const scrollThreshold = window.innerHeight * 0.5;
      
      if (window.pageYOffset > scrollThreshold) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    // スクロールイベントリスナーを追加（パフォーマンス最適化のためthrottled）
    let timeoutId: number | null = null;
    const handleScroll = () => {
      if (timeoutId) return;
      
      timeoutId = window.setTimeout(() => {
        toggleVisibility();
        timeoutId = null;
      }, 16); // 60fps相当
    };

    window.addEventListener('scroll', handleScroll);
    
    // 初期表示時もチェック
    toggleVisibility();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  // スムーズスクロールでトップへ移動
  const scrollToTop = () => {
    if (isAnimating) return; // 連続クリック防止
    
    setIsAnimating(true);
    
    // スムーズスクロール実行
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

    // アニメーション完了後にフラグをリセット（推定時間：1秒）
    setTimeout(() => {
      setIsAnimating(false);
    }, 1000);
  };

  // キーボードサポート
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      scrollToTop();
    }
  };

  return (
    <button
      onClick={scrollToTop}
      onKeyDown={handleKeyDown}
      className={`
        fixed bottom-6 right-6 z-50
        w-12 h-12 md:w-14 md:h-14
        bg-blue-100/90 backdrop-blur-sm
        border border-blue-200/50
        rounded-full shadow-lg
        flex items-center justify-center
        transition-all duration-300 ease-out
        hover:bg-blue-200/95 hover:shadow-xl hover:scale-110
        active:scale-95
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50
        group
        min-h-[44px] min-w-[44px] touch-manipulation
        ${isVisible 
          ? 'opacity-100 translate-y-0 pointer-events-auto' 
          : 'opacity-0 translate-y-4 pointer-events-none'
        }
        ${isAnimating ? 'animate-pulse' : ''}
      `}
      aria-label="ページの先頭に戻る"
      title="ページの先頭に戻る"
      tabIndex={isVisible ? 0 : -1}
      type="button"
    >
      {/* Lucide React アイコンを使用 */}
      <ChevronUp 
        className={`
          w-5 h-5 md:w-6 md:h-6 
          text-blue-600 
          transition-all duration-200
          group-hover:text-blue-700 group-hover:-translate-y-0.5
          ${isAnimating ? 'animate-bounce' : ''}
        `}
        strokeWidth={2.5}
        aria-hidden="true"
      />
      
      {/* ホバー時の背景エフェクト */}
      <div className="
        absolute inset-0 rounded-full
        bg-gradient-to-t from-blue-500/10 to-transparent
        opacity-0 group-hover:opacity-100
        transition-opacity duration-200
      " />
    </button>
  );
};
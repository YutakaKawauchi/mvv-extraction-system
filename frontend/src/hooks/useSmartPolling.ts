/**
 * スマートポーリングHook (Phase ε.1.2)
 * 指数バックオフ、Page Visibility API対応、エラー回復機能
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface SmartPollingOptions {
  interval: number;                    // 初期ポーリング間隔（ミリ秒）
  maxInterval?: number;               // 最大ポーリング間隔（ミリ秒）
  maxAttempts?: number;               // 最大試行回数
  exponentialBackoff?: boolean;       // 指数バックオフの有効化
  backoffMultiplier?: number;         // バックオフ乗数
  stopOnError?: boolean;              // エラー時の停止
  enablePageVisibility?: boolean;     // Page Visibility API対応
  hiddenMultiplier?: number;          // ページ非表示時の間隔乗数
  retryOnError?: boolean;             // エラー時の自動リトライ
  retryDelay?: number;                // リトライ遅延（ミリ秒）
}

export interface PollingState<T> {
  data: T | null;
  error: string | null;
  isPolling: boolean;
  attemptCount: number;
  lastPolledAt: number | null;
  nextPollAt: number | null;
}

export interface UseSmartPollingReturn<T> extends PollingState<T> {
  startPolling: () => void;
  stopPolling: () => void;
  forcepoll: () => Promise<void>;
  reset: () => void;
  updateInterval: (newInterval: number) => void;
}

const DEFAULT_OPTIONS: Required<SmartPollingOptions> = {
  interval: 5000,               // 5秒デフォルト（サーバー負荷軽減）
  maxInterval: 60000,           // 最大1分間隔
  maxAttempts: 120,             // 約10分間（5秒開始で指数バックオフ）
  exponentialBackoff: true,
  backoffMultiplier: 1.2,
  stopOnError: false,
  enablePageVisibility: true,
  hiddenMultiplier: 3,          // ページ非表示時は3倍間隔（15秒）
  retryOnError: true,
  retryDelay: 10000             // エラー時は10秒待機
};

export function useSmartPolling<T>(
  pollingFn: () => Promise<T>,
  shouldContinue: (data: T | null) => boolean,
  options: Partial<SmartPollingOptions> = {}
): UseSmartPollingReturn<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const [state, setState] = useState<PollingState<T>>({
    data: null,
    error: null,
    isPolling: false,
    attemptCount: 0,
    lastPolledAt: null,
    nextPollAt: null
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPageVisibleRef = useRef(true);
  const mountedRef = useRef(true);
  const currentIntervalRef = useRef(opts.interval);

  // コンポーネントアンマウント時のクリーンアップ
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Page Visibility API の設定
  useEffect(() => {
    if (!opts.enablePageVisibility) return;

    const handleVisibilityChange = () => {
      isPageVisibleRef.current = !document.hidden;
      
      if (isPageVisibleRef.current && state.isPolling) {
        // ページが表示されたら即座にポーリング実行
        forcepoll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [opts.enablePageVisibility, state.isPolling]);

  /**
   * 次のポーリング間隔を計算
   */
  const calculateNextInterval = useCallback((attemptCount: number): number => {
    let interval = opts.interval;

    if (opts.exponentialBackoff) {
      interval = Math.min(
        opts.interval * Math.pow(opts.backoffMultiplier, Math.floor(attemptCount / 5)),
        opts.maxInterval
      );
    }

    // ページが非表示の場合は間隔を延長
    if (opts.enablePageVisibility && !isPageVisibleRef.current) {
      interval *= opts.hiddenMultiplier;
    }

    currentIntervalRef.current = interval;
    return interval;
  }, [opts]);

  /**
   * 単発ポーリング実行
   */
  const executePoll = useCallback(async (): Promise<void> => {
    if (!mountedRef.current) return;

    try {
      setState(prev => ({
        ...prev,
        error: null,
        lastPolledAt: Date.now()
      }));

      const result = await pollingFn();

      if (!mountedRef.current) return;

      setState(prev => ({
        ...prev,
        data: result,
        attemptCount: prev.attemptCount + 1,
        error: null
      }));

      // 継続条件をチェック
      if (!shouldContinue(result)) {
        stopPolling();
        return;
      }

    } catch (error) {
      if (!mountedRef.current) return;

      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      
      setState(prev => ({
        ...prev,
        error: errorMessage,
        attemptCount: prev.attemptCount + 1
      }));

      if (opts.stopOnError) {
        stopPolling();
        return;
      }
    }
  }, [pollingFn, shouldContinue, opts.stopOnError]);

  /**
   * 次のポーリングをスケジュール
   */
  const scheduleNextPoll = useCallback(() => {
    if (!mountedRef.current || !state.isPolling) return;

    // 最大試行回数チェック
    if (state.attemptCount >= opts.maxAttempts) {
      setState(prev => ({
        ...prev,
        isPolling: false,
        error: prev.error || 'ポーリング最大回数に達しました'
      }));
      return;
    }

    const interval = calculateNextInterval(state.attemptCount);
    const nextPollTime = Date.now() + interval;

    setState(prev => ({
      ...prev,
      nextPollAt: nextPollTime
    }));

    timeoutRef.current = setTimeout(async () => {
      if (!mountedRef.current || !state.isPolling) return;

      await executePoll();
      
      // エラー時のリトライ処理
      if (state.error && opts.retryOnError) {
        setTimeout(scheduleNextPoll, opts.retryDelay);
      } else {
        scheduleNextPoll();
      }
    }, interval);
  }, [state.isPolling, state.attemptCount, state.error, opts, calculateNextInterval, executePoll]);

  /**
   * ポーリング開始
   */
  const startPolling = useCallback(() => {
    if (state.isPolling) return;

    setState(prev => ({
      ...prev,
      isPolling: true,
      error: null,
      attemptCount: 0,
      nextPollAt: null
    }));

    // 即座に最初のポーリングを実行
    executePoll().then(() => {
      if (mountedRef.current) {
        scheduleNextPoll();
      }
    });
  }, [state.isPolling, executePoll, scheduleNextPoll]);

  /**
   * ポーリング停止
   */
  const stopPolling = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isPolling: false,
      nextPollAt: null
    }));
  }, []);

  /**
   * 強制ポーリング実行
   */
  const forcepoll = useCallback(async (): Promise<void> => {
    // 現在のタイムアウトをクリア
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    await executePoll();

    if (state.isPolling && mountedRef.current) {
      scheduleNextPoll();
    }
  }, [executePoll, state.isPolling, scheduleNextPoll]);

  /**
   * 状態リセット
   */
  const reset = useCallback(() => {
    stopPolling();
    setState({
      data: null,
      error: null,
      isPolling: false,
      attemptCount: 0,
      lastPolledAt: null,
      nextPollAt: null
    });
    currentIntervalRef.current = opts.interval;
  }, [stopPolling, opts.interval]);

  /**
   * ポーリング間隔の動的更新
   */
  const updateInterval = useCallback((newInterval: number) => {
    currentIntervalRef.current = newInterval;
    
    // アクティブなポーリングがある場合は再スケジュール
    if (state.isPolling && timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      scheduleNextPoll();
    }
  }, [state.isPolling, scheduleNextPoll]);

  return {
    ...state,
    startPolling,
    stopPolling,
    forcepoll,
    reset,
    updateInterval
  };
}
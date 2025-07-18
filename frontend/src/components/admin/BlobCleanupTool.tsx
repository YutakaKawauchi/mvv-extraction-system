/**
 * ブロブクリーンアップツール
 * 管理画面でNetlify Blobsの一括削除を実行
 */

import React, { useState, useEffect } from 'react';
import { 
  Trash2, 
  Database, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw,
  Eye,
  Search,
  Loader
} from 'lucide-react';
import { Button } from '../common';
import { useNotification } from '../../hooks/useNotification';

interface StoreInfo {
  name: string;
  exists: boolean;
  blobCount: number;
  totalSize: number;
  error?: string;
}

interface CleanupResult {
  success: boolean;
  store: string;
  mode: string;
  summary: {
    totalBlobs: number;
    candidatesForDeletion: number;
    actuallyDeleted: number;
    totalSize: number;
  };
  message: string;
}

type CleanupMode = 'orphaned' | 'all' | 'pattern';

export const BlobCleanupTool: React.FC = () => {
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [cleanupMode, setCleanupMode] = useState<CleanupMode>('orphaned');
  const [maxAge, setMaxAge] = useState(24);
  const [pattern, setPattern] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<CleanupResult | null>(null);

  const { success, error, warning } = useNotification();

  // ストア一覧を取得
  const fetchStores = async () => {
    setIsLoading(true);
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
      const apiSecret = import.meta.env.VITE_API_SECRET;

      const response = await fetch(`${apiBaseUrl}/cleanup-all-blobs`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiSecret
        },
        body: JSON.stringify({ action: 'list-stores' })
      });

      if (response.ok) {
        const data = await response.json();
        setStores(data.stores || []);
        
        // 最初の存在するストアを自動選択
        const firstExistingStore = data.stores?.find((store: StoreInfo) => store.exists);
        if (firstExistingStore) {
          setSelectedStore(firstExistingStore.name);
        }
      } else {
        throw new Error(`Failed to fetch stores: ${response.status}`);
      }
    } catch (err) {
      error(`ストア一覧の取得に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // クリーンアップ実行
  const executeCleanup = async () => {
    if (!selectedStore) {
      error('ストアを選択してください');
      return;
    }

    if (cleanupMode === 'pattern' && !pattern.trim()) {
      error('パターンマッチモードではパターンを入力してください');
      return;
    }

    setIsLoading(true);
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
      const apiSecret = import.meta.env.VITE_API_SECRET;

      const payload: any = {
        store: selectedStore,
        mode: cleanupMode,
        dryRun
      };

      if (cleanupMode === 'orphaned') {
        payload.maxAge = maxAge * 3600; // 時間を秒に変換
      } else if (cleanupMode === 'pattern') {
        payload.pattern = pattern;
      }

      const response = await fetch(`${apiBaseUrl}/cleanup-all-blobs`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiSecret
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        setLastResult(result);
        
        if (dryRun) {
          warning(`プレビュー完了: ${result.summary?.candidatesForDeletion || 0}個のブロブが削除対象です`);
        } else {
          success(`クリーンアップ完了: ${result.summary?.actuallyDeleted || 0}個のブロブを削除しました`);
          // 実行後にストア一覧を更新
          fetchStores();
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
    } catch (err) {
      error(`クリーンアップに失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 初期化
  useEffect(() => {
    fetchStores();
  }, []);

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const selectedStoreInfo = stores.find(store => store.name === selectedStore);

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 flex items-center">
          <Trash2 className="mr-3 h-5 w-5 text-red-500" />
          ブロブクリーンアップツール
        </h4>
        <p className="text-gray-600 mt-1">
          Netlify Blobsストアの不要なデータを削除します
        </p>
      </div>

      {/* 警告 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-yellow-400 mr-2" />
          <p className="text-sm text-yellow-700">
            <strong>注意:</strong> 削除されたブロブは復元できません。
            まず「プレビューモード」で削除対象を確認してください。
          </p>
        </div>
      </div>

      {/* ストア選択 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h5 className="font-medium text-gray-900 flex items-center">
            <Database className="mr-2 h-4 w-4" />
            ストア選択
          </h5>
          <Button
            onClick={fetchStores}
            variant="outline"
            size="sm"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            更新
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {stores.map((store) => (
            <div
              key={store.name}
              className={`border rounded-lg p-3 cursor-pointer transition-all ${
                selectedStore === store.name
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              } ${!store.exists ? 'opacity-50' : ''}`}
              onClick={() => store.exists && setSelectedStore(store.name)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">{store.name}</span>
                {store.exists ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <div className="h-4 w-4 bg-gray-300 rounded-full" />
                )}
              </div>
              {store.exists ? (
                <div className="text-xs text-gray-600">
                  <div>{store.blobCount}個のブロブ</div>
                  <div>{formatSize(store.totalSize)}</div>
                </div>
              ) : (
                <div className="text-xs text-gray-400">存在しません</div>
              )}
            </div>
          ))}
        </div>

        {selectedStoreInfo && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="text-sm">
              <strong>選択中:</strong> {selectedStoreInfo.name} ({selectedStoreInfo.blobCount}個, {formatSize(selectedStoreInfo.totalSize)})
            </div>
          </div>
        )}
      </div>

      {/* クリーンアップ設定 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h5 className="font-medium text-gray-900 mb-4">クリーンアップ設定</h5>

        {/* モード選択 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">削除モード</label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                value="orphaned"
                checked={cleanupMode === 'orphaned'}
                onChange={(e) => setCleanupMode(e.target.value as CleanupMode)}
                className="mr-2"
              />
              <span className="text-sm">古いブロブを削除（推奨）</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="pattern"
                checked={cleanupMode === 'pattern'}
                onChange={(e) => setCleanupMode(e.target.value as CleanupMode)}
                className="mr-2"
              />
              <span className="text-sm">パターンマッチで削除</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="all"
                checked={cleanupMode === 'all'}
                onChange={(e) => setCleanupMode(e.target.value as CleanupMode)}
                className="mr-2"
              />
              <span className="text-sm text-red-600">全削除（危険）</span>
            </label>
          </div>
        </div>

        {/* 詳細設定 */}
        {cleanupMode === 'orphaned' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              削除対象の年齢（時間）
            </label>
            <input
              type="number"
              value={maxAge}
              onChange={(e) => setMaxAge(Number(e.target.value))}
              min="1"
              max="8760"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <p className="text-xs text-gray-500 mt-1">
              {maxAge}時間以上前に作成されたブロブが削除対象になります
            </p>
          </div>
        )}

        {cleanupMode === 'pattern' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              削除パターン（正規表現）
            </label>
            <input
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="例: async_1752.*, temp_.*, test_.*"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <p className="text-xs text-gray-500 mt-1">
              指定したパターンにマッチするキー名のブロブが削除されます
            </p>
          </div>
        )}

        {/* Dry Run設定 */}
        <div className="mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm font-medium">プレビューモード</span>
          </label>
          <p className="text-xs text-gray-500 mt-1">
            チェックすると実際には削除せず、削除対象のリストのみ表示します
          </p>
        </div>
      </div>

      {/* 実行ボタン */}
      <div className="flex justify-center">
        <Button
          onClick={executeCleanup}
          disabled={!selectedStore || isLoading}
          variant={dryRun ? 'outline' : 'primary'}
          size="lg"
        >
          {isLoading ? (
            <Loader className="h-5 w-5 mr-2 animate-spin" />
          ) : dryRun ? (
            <Eye className="h-5 w-5 mr-2" />
          ) : (
            <Trash2 className="h-5 w-5 mr-2" />
          )}
          {isLoading ? '実行中...' : dryRun ? 'プレビュー実行' : 'クリーンアップ実行'}
        </Button>
      </div>

      {/* 結果表示 */}
      {lastResult && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h5 className="font-medium text-gray-900 mb-3 flex items-center">
            <Search className="mr-2 h-4 w-4" />
            実行結果
          </h5>
          
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium">ストア:</span>
                <div className="text-gray-600">{lastResult.store}</div>
              </div>
              <div>
                <span className="font-medium">モード:</span>
                <div className="text-gray-600">{lastResult.mode}</div>
              </div>
              <div>
                <span className="font-medium">対象ブロブ:</span>
                <div className="text-gray-600">{lastResult.summary?.candidatesForDeletion || 0}個</div>
              </div>
              <div>
                <span className="font-medium">削除済み:</span>
                <div className="text-gray-600">{lastResult.summary?.actuallyDeleted || 0}個</div>
              </div>
            </div>
            
            <div className="text-sm text-gray-600 p-3 bg-gray-50 rounded">
              {lastResult.message}
            </div>
            
            {lastResult.summary?.totalSize > 0 && (
              <div className="text-sm text-gray-600">
                <strong>削除されたデータ量:</strong> {formatSize(lastResult.summary.totalSize)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
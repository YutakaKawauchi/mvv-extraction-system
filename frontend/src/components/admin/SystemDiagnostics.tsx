/**
 * システム診断コンポーネント
 * API接続・パフォーマンス・ログ確認
 */

import React, { useState } from 'react';
import { Activity, Zap, Globe, Server, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button, LoadingSpinner, CacheStatus } from '../common';
import { useNotification } from '../../hooks/useNotification';

interface SystemStatus {
  health: 'healthy' | 'warning' | 'error' | 'unknown';
  latency: number;
  timestamp: string;
}

interface APITest {
  name: string;
  endpoint: string;
  status: 'pending' | 'success' | 'error';
  latency?: number;
  error?: string;
}

export const SystemDiagnostics: React.FC = () => {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [apiTests, setApiTests] = useState<APITest[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const { success, error } = useNotification();

  const testEndpoints: Omit<APITest, 'status'>[] = [
    {
      name: 'ヘルスチェック',
      endpoint: 'health'
    }
  ];

  const runSystemDiagnostics = async () => {
    setIsRunning(true);
    setApiTests(testEndpoints.map(test => ({ ...test, status: 'pending' })));

    try {
      // ヘルスチェック
      const healthStart = performance.now();
      const healthResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/health`);
      const healthLatency = performance.now() - healthStart;

      if (healthResponse.ok) {
        setSystemStatus({
          health: 'healthy',
          latency: Math.round(healthLatency),
          timestamp: new Date().toISOString()
        });
      } else {
        setSystemStatus({
          health: 'error',
          latency: Math.round(healthLatency),
          timestamp: new Date().toISOString()
        });
      }

      // ヘルスチェックエンドポイントのみテスト
      const results: APITest[] = [];
      
      for (const test of testEndpoints) {
        try {
          const start = performance.now();
          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/health`);
          const latency = Math.round(performance.now() - start);
          
          results.push({
            ...test,
            status: response.ok ? 'success' : 'error',
            latency
          });

        } catch (err) {
          results.push({
            ...test,
            status: 'error',
            error: err instanceof Error ? err.message : '不明なエラー'
          });
        }

        // 進捗更新
        setApiTests([...results, ...testEndpoints.slice(results.length).map(t => ({ ...t, status: 'pending' as const }))]);
      }

      setApiTests(results);
      success('システム診断が完了しました');

    } catch (err) {
      console.error('システム診断エラー:', err);
      error('システム診断に失敗しました');
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'pending':
        return <LoadingSpinner size="sm" className="text-blue-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'pending':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center">
            <Activity className="mr-3 h-6 w-6 text-green-500" />
            システム診断
          </h3>
          <p className="text-gray-600 mt-1">
            API接続状態・パフォーマンス・システム健全性をチェック
          </p>
        </div>
        <Button
          onClick={runSystemDiagnostics}
          disabled={isRunning}
        >
          <Zap className="h-4 w-4 mr-2" />
          診断開始
        </Button>
      </div>

      {/* システム状態 */}
      {systemStatus && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">システム状態</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`rounded-lg border p-4 ${getStatusColor(systemStatus.health)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">システム健全性</p>
                  <p className="text-lg font-bold capitalize">{systemStatus.health}</p>
                </div>
                {systemStatus.health === 'healthy' ? (
                  <CheckCircle className="h-6 w-6 text-green-500" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-500" />
                )}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">応答時間</p>
                  <p className="text-lg font-bold text-blue-900">{systemStatus.latency}ms</p>
                </div>
                <Clock className="h-6 w-6 text-blue-500" />
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">最終チェック</p>
                  <p className="text-sm font-bold text-gray-900">
                    {new Date(systemStatus.timestamp).toLocaleTimeString('ja-JP')}
                  </p>
                </div>
                <Globe className="h-6 w-6 text-gray-500" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* API エンドポイント診断 */}
      {apiTests.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b border-gray-200">
            <h4 className="text-lg font-semibold text-gray-900 flex items-center">
              <Server className="h-5 w-5 mr-2 text-blue-500" />
              API 接続診断
            </h4>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {apiTests.map((test, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-4 rounded-lg border ${getStatusColor(test.status)}`}
                >
                  <div className="flex items-center">
                    {getStatusIcon(test.status)}
                    <div className="ml-3">
                      <h5 className="font-medium">{test.name}</h5>
                      <p className="text-sm opacity-75">/{test.endpoint}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {test.latency && (
                      <div className="text-sm font-medium">{test.latency}ms</div>
                    )}
                    {test.error && (
                      <div className="text-xs text-red-600">{test.error}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AIキャッシュ状態 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">AIキャッシュシステム</h4>
        <CacheStatus />
      </div>

      {/* システム情報 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">環境情報</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-600">API Base URL:</span>
            <span className="ml-2 text-gray-900">{import.meta.env.VITE_API_BASE_URL}</span>
          </div>
          <div>
            <span className="font-medium text-gray-600">Environment:</span>
            <span className="ml-2 text-gray-900">{import.meta.env.VITE_ENVIRONMENT || 'development'}</span>
          </div>
          <div>
            <span className="font-medium text-gray-600">User Agent:</span>
            <span className="ml-2 text-gray-900 break-all">{navigator.userAgent.slice(0, 50)}...</span>
          </div>
          <div>
            <span className="font-medium text-gray-600">Timestamp:</span>
            <span className="ml-2 text-gray-900">{new Date().toLocaleString('ja-JP')}</span>
          </div>
        </div>
      </div>

      {/* パフォーマンス情報 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">パフォーマンス指標</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {systemStatus?.latency || '--'}ms
            </div>
            <div className="text-sm text-gray-600">API応答時間</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {apiTests.filter(t => t.status === 'success').length}/{apiTests.length}
            </div>
            <div className="text-sm text-gray-600">成功率</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {apiTests.filter(t => t.latency).reduce((avg, t) => avg + (t.latency || 0), 0) / Math.max(apiTests.filter(t => t.latency).length, 1) || 0}ms
            </div>
            <div className="text-sm text-gray-600">平均応答時間</div>
          </div>
        </div>
      </div>
    </div>
  );
};
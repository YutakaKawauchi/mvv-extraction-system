/**
 * 管理者パネル（隠しメニュー）
 * Ctrl+Shift+A で表示されるシステム管理・リカバリツール
 */

import React, { useState } from 'react';
import { X, Shield, Database, Wrench, Activity, AlertTriangle } from 'lucide-react';
import { Button } from '../common';
import { DataDiagnostics } from './DataDiagnostics';
import { RecoveryTools } from './RecoveryTools';
import { SystemDiagnostics } from './SystemDiagnostics';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type AdminTab = 'diagnostics' | 'recovery' | 'system';

export const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('diagnostics');

  if (!isOpen) return null;

  const tabs = [
    {
      id: 'diagnostics' as AdminTab,
      label: 'データ診断',
      icon: Database,
      description: '企業情報・MVVデータの整合性チェック'
    },
    {
      id: 'recovery' as AdminTab,
      label: 'リカバリツール',
      icon: Wrench,
      description: '一括処理・データ修復・テスト実行'
    },
    {
      id: 'system' as AdminTab,
      label: 'システム診断',
      icon: Activity,
      description: 'API接続・パフォーマンス・ログ確認'
    }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'diagnostics':
        return <DataDiagnostics />;
      case 'recovery':
        return <RecoveryTools />;
      case 'system':
        return <SystemDiagnostics />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="bg-red-600 text-white p-4 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center">
            <Shield className="h-6 w-6 mr-3" />
            <div>
              <h2 className="text-xl font-bold">管理者パネル</h2>
              <p className="text-red-100 text-sm">システム管理・データリカバリツール</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="bg-red-700 px-3 py-1 rounded text-xs font-medium">
              🔐 管理者専用
            </div>
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
              className="text-white hover:bg-red-700"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* 警告バナー */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-yellow-400 mr-2" />
            <p className="text-sm text-yellow-700">
              <strong>注意:</strong> この機能は管理者専用です。実行前に必ずデータのバックアップを確認してください。
            </p>
          </div>
        </div>

        {/* タブナビゲーション */}
        <div className="border-b border-gray-200">
          <nav className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-4 px-6 text-center border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-red-500 text-red-600 bg-red-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <Icon className="h-6 w-6 mb-2" />
                    <span className="font-medium">{tab.label}</span>
                    <span className="text-xs text-gray-500 mt-1">{tab.description}</span>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* タブコンテンツ */}
        <div className="flex-1 overflow-auto p-6">
          {renderTabContent()}
        </div>

        {/* フッター */}
        <div className="border-t border-gray-200 p-4 bg-gray-50 rounded-b-lg">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-medium">ショートカット:</span> Ctrl+Shift+A で開閉
            </div>
            <div className="text-sm text-gray-500">
              MVV抽出システム 管理者パネル v1.0
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
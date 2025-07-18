/**
 * リカバリツールコンポーネント
 * 一括処理・データ修復・テスト実行
 */

import React, { useState } from 'react';
import { Wrench, Play, TestTube, Settings, AlertTriangle, DollarSign, Trash2 } from 'lucide-react';
import { Button } from '../common';
import { BulkCompanyInfoExtractor } from '../CompanyManager/BulkCompanyInfoExtractor';
import { SingleCompanyInfoExtractor } from '../CompanyManager/SingleCompanyInfoExtractor';
import { BlobCleanupTool } from './BlobCleanupTool';
import { useNotification } from '../../hooks/useNotification';

type RecoveryTool = 'bulk' | 'single' | 'batch' | 'cleanup' | null;

export const RecoveryTools: React.FC = () => {
  const [activeTool, setActiveTool] = useState<RecoveryTool>(null);
  const { info } = useNotification();

  const tools = [
    {
      id: 'bulk' as RecoveryTool,
      title: '一括企業情報抽出',
      description: 'MVV済み企業の企業情報を一括で抽出・リカバリ',
      icon: Wrench,
      cost: '約1.5円/企業',
      warning: 'データ不足企業のみ対象',
      color: 'blue'
    },
    {
      id: 'single' as RecoveryTool,
      title: '1件テスト実行',
      description: '料金を抑えて1社ずつテスト実行',
      icon: TestTube,
      cost: '約1.5円/企業',
      warning: 'テスト・検証用',
      color: 'green'
    },
    {
      id: 'batch' as RecoveryTool,
      title: '完全バッチ処理',
      description: 'MVV抽出→企業情報→カテゴリの3段階処理',
      icon: Settings,
      cost: '約3.5円/企業',
      warning: '新規企業データ用',
      color: 'purple'
    },
    {
      id: 'cleanup' as RecoveryTool,
      title: 'ブロブクリーンアップ',
      description: 'テスト失敗やごみファイルを一括削除',
      icon: Trash2,
      cost: '無料',
      warning: '管理者専用',
      color: 'red'
    }
  ];

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return {
          bg: 'bg-blue-50 hover:bg-blue-100',
          border: 'border-blue-200',
          text: 'text-blue-900',
          icon: 'text-blue-500'
        };
      case 'green':
        return {
          bg: 'bg-green-50 hover:bg-green-100',
          border: 'border-green-200',
          text: 'text-green-900',
          icon: 'text-green-500'
        };
      case 'purple':
        return {
          bg: 'bg-purple-50 hover:bg-purple-100',
          border: 'border-purple-200',
          text: 'text-purple-900',
          icon: 'text-purple-500'
        };
      case 'red':
        return {
          bg: 'bg-red-50 hover:bg-red-100',
          border: 'border-red-200',
          text: 'text-red-900',
          icon: 'text-red-500'
        };
      default:
        return {
          bg: 'bg-gray-50 hover:bg-gray-100',
          border: 'border-gray-200',
          text: 'text-gray-900',
          icon: 'text-gray-500'
        };
    }
  };

  const handleToolSelect = (toolId: RecoveryTool) => {
    setActiveTool(toolId);
    if (toolId) {
      info(`${tools.find(t => t.id === toolId)?.title}を開始します`);
    }
  };

  const renderToolContent = () => {
    switch (activeTool) {
      case 'bulk':
        return (
          <div className="mt-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-blue-900 flex items-center">
                <Wrench className="h-5 w-5 mr-2" />
                一括企業情報抽出
              </h4>
              <p className="text-sm text-blue-700 mt-1">
                MVVデータは完了しているが企業情報が不足している企業を自動検出し、一括で抽出します
              </p>
            </div>
            <BulkCompanyInfoExtractor />
          </div>
        );
      case 'single':
        return (
          <div className="mt-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-green-900 flex items-center">
                <TestTube className="h-5 w-5 mr-2" />
                1件テスト実行
              </h4>
              <p className="text-sm text-green-700 mt-1">
                料金を抑えて1社ずつテスト実行。動作確認や問題企業の個別対応に使用
              </p>
            </div>
            <SingleCompanyInfoExtractor />
          </div>
        );
      case 'batch':
        return (
          <div className="mt-6">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-purple-900 flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                完全バッチ処理
              </h4>
              <p className="text-sm text-purple-700 mt-1">
                MVV抽出→企業情報→カテゴリ分類の3段階処理。新規企業データに使用
              </p>
            </div>
            <div className="bg-yellow-50 border border-yellow-400 rounded-lg p-4">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-yellow-400 mr-2" />
                <p className="text-sm text-yellow-700">
                  <strong>注意:</strong> この機能は通常のMVV抽出画面で利用可能です。
                  企業管理 → CSV追加 → MVV抽出 → バッチ処理開始
                </p>
              </div>
            </div>
          </div>
        );
      case 'cleanup':
        return (
          <div className="mt-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-red-900 flex items-center">
                <Trash2 className="h-5 w-5 mr-2" />
                ブロブクリーンアップ
              </h4>
              <p className="text-sm text-red-700 mt-1">
                テスト失敗やごみファイルを一括削除。Netlify Blobsストアのメンテナンス
              </p>
            </div>
            <BlobCleanupTool />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 flex items-center">
          <Wrench className="mr-3 h-6 w-6 text-orange-500" />
          リカバリツール
        </h3>
        <p className="text-gray-600 mt-1">
          データ修復・一括処理・テスト実行ツール
        </p>
      </div>

      {/* 注意事項 */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-400 mr-2" />
          <p className="text-sm text-red-700">
            <strong>重要:</strong> 実行前にデータのバックアップを確認し、
            料金が発生することを理解の上で実行してください。
          </p>
        </div>
      </div>

      {/* ツール選択 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const colors = getColorClasses(tool.color);
          const isActive = activeTool === tool.id;
          
          return (
            <div
              key={tool.id}
              className={`border rounded-lg p-6 cursor-pointer transition-all ${
                isActive 
                  ? `${colors.bg} ${colors.border} shadow-md` 
                  : `bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm`
              }`}
              onClick={() => handleToolSelect(isActive ? null : tool.id)}
            >
              <div className="flex items-center justify-between mb-3">
                <Icon className={`h-8 w-8 ${isActive ? colors.icon : 'text-gray-400'}`} />
                <div className="text-right">
                  <div className="text-sm font-medium text-green-600 flex items-center">
                    <DollarSign className="h-3 w-3 mr-1" />
                    {tool.cost}
                  </div>
                  <div className="text-xs text-gray-500">{tool.warning}</div>
                </div>
              </div>
              
              <h4 className={`font-semibold mb-2 ${isActive ? colors.text : 'text-gray-900'}`}>
                {tool.title}
              </h4>
              <p className={`text-sm ${isActive ? colors.text : 'text-gray-600'}`}>
                {tool.description}
              </p>
              
              <div className="mt-4">
                <Button
                  variant={isActive ? 'primary' : 'outline'}
                  size="sm"
                  className="w-full"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {isActive ? '選択済み' : '選択'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 選択されたツールのコンテンツ */}
      {renderToolContent()}

      {/* フッター情報 */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">リカバリツール使用ガイド</h4>
        <div className="text-sm text-gray-600 space-y-1">
          <div>• <strong>一括企業情報抽出:</strong> データ不足を自動検出して修復</div>
          <div>• <strong>1件テスト実行:</strong> 少額でテスト・検証</div>
          <div>• <strong>完全バッチ処理:</strong> 新規データの全段階処理</div>
          <div>• <strong>ブロブクリーンアップ:</strong> テスト失敗・ごみファイルの一括削除</div>
        </div>
      </div>
    </div>
  );
};
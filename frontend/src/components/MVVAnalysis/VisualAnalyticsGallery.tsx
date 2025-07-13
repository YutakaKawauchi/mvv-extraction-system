/**
 * Visual Analytics Gallery Component
 * 洗練されたAI分析画面キャプチャ機能
 */

import React, { useState, useCallback, useEffect } from 'react';
import { 
  Camera, 
  Download, 
  Grid, 
  List, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Image as ImageIcon,
  FileImage,
  Package,
  Clock,
  Monitor,
  X,
  Database,
  Trash2
} from 'lucide-react';
import { ScreenshotCaptureService, type AnalysisScreenshot } from '../../services/screenshotCapture';
import { ScreenshotStorageService } from '../../services/screenshotStorage';
import { Button } from '../common';
import { useNotification } from '../../hooks/useNotification';

interface VisualAnalyticsGalleryProps {
  className?: string;
}

type ViewMode = 'grid' | 'list';
type CaptureStatus = 'idle' | 'capturing' | 'completed' | 'error';

interface TabSelection {
  finder: boolean;
  trends: boolean;
  wordcloud: boolean;
  positioning: boolean;
  uniqueness: boolean;
  quality: boolean;
}

const TAB_NAMES = {
  finder: '類似企業検索',
  trends: 'トレンド分析',
  wordcloud: 'ワードクラウド',
  positioning: 'ポジショニング',
  uniqueness: '独自性分析 (β)',
  quality: '品質評価 (β)'
} as const;

export const VisualAnalyticsGallery: React.FC<VisualAnalyticsGalleryProps> = ({ className }) => {
  const [screenshots, setScreenshots] = useState<AnalysisScreenshot[]>([]);
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus>('idle');
  const [captureProgress, setCaptureProgress] = useState({ current: 0, total: 0, screenName: '' });
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedScreenshot, setSelectedScreenshot] = useState<AnalysisScreenshot | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [storageInfo, setStorageInfo] = useState({ count: 0, totalSize: 0 });
  const [selectedTabs, setSelectedTabs] = useState<TabSelection>({
    finder: true,
    trends: true,
    wordcloud: true,
    positioning: true,
    uniqueness: false, // β版はデフォルトでオフ
    quality: false // β版はデフォルトでオフ
  });
  
  const { success, error: showError } = useNotification();

  // IndexedDBからスクリーンショットを読み込み
  const loadScreenshots = useCallback(async () => {
    try {
      setIsLoading(true);
      await ScreenshotStorageService.initialize();
      
      const loadedScreenshots = await ScreenshotStorageService.getScreenshots();
      const storageUsage = await ScreenshotStorageService.getStorageUsage();
      
      setScreenshots(loadedScreenshots);
      setStorageInfo(storageUsage);
      
      console.log(`📦 IndexedDBから${loadedScreenshots.length}件のスクリーンショットを読み込み`);
    } catch (error) {
      console.error('Failed to load screenshots from storage:', error);
      showError('読み込みエラー', 'スクリーンショットの読み込みに失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  // コンポーネントマウント時の初期化
  useEffect(() => {
    console.log('🚀 VisualAnalyticsGalleryコンポーネントがマウントされました');
    loadScreenshots();
    
    return () => {
      console.log('💀 VisualAnalyticsGalleryコンポーネントがアンマウントされました');
    };
  }, [loadScreenshots]);

  // IndexedDBリアルタイム更新リスナー
  useEffect(() => {
    const handleStorageUpdate = (updatedScreenshots: AnalysisScreenshot[]) => {
      console.log('🔄 IndexedDBから更新通知:', updatedScreenshots.length);
      setScreenshots(updatedScreenshots);
    };

    ScreenshotStorageService.addListener(handleStorageUpdate);
    
    return () => {
      ScreenshotStorageService.removeListener(handleStorageUpdate);
    };
  }, []);

  const handleCaptureSelected = useCallback(async () => {
    setCaptureStatus('capturing');
    setCaptureProgress({ current: 0, total: 0, screenName: '' });
    
    // 選択されたタブのみを取得
    const selectedTabIds = Object.entries(selectedTabs)
      .filter(([_, isSelected]) => isSelected)
      .map(([tabId, _]) => tabId);
    
    if (selectedTabIds.length === 0) {
      showError('選択エラー', '撮影するタブを少なくとも1つ選択してください');
      setCaptureStatus('idle');
      return;
    }
    
    try {
      const newScreenshots = await ScreenshotCaptureService.captureSelectedAnalysisScreens(
        selectedTabIds,
        (current, total, screenName) => {
          setCaptureProgress({ current, total, screenName });
        },
        {
          width: 1400,
          height: 900,
          quality: 0.95,
          scale: 1.5,
          optimizeForExcel: true,
          autoSaveToIndexedDB: true // 自動保存を有効化
        }
      );
      
      console.log('📸 撮影されたスクリーンショット:', newScreenshots);
      console.log('📸 撮影されたスクリーンショット数:', newScreenshots.length);
      
      setCaptureStatus('completed');
      success('キャプチャ完了', `${newScreenshots.length}件のAI分析画面をIndexedDBに自動保存しました`);
      
      // ストレージ使用量更新
      const storageUsage = await ScreenshotStorageService.getStorageUsage();
      setStorageInfo(storageUsage);
      
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      setCaptureStatus('error');
      showError('キャプチャエラー', 'AI分析画面の撮影に失敗しました');
    }
  }, [selectedTabs, success, showError]);

  const handleTabSelectionChange = useCallback((tabId: keyof TabSelection, selected: boolean) => {
    setSelectedTabs(prev => ({
      ...prev,
      [tabId]: selected
    }));
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedTabs({
      finder: true,
      trends: true,
      wordcloud: true,
      positioning: true,
      uniqueness: true,
      quality: true
    });
  }, []);

  const handleSelectNone = useCallback(() => {
    setSelectedTabs({
      finder: false,
      trends: false,
      wordcloud: false,
      positioning: false,
      uniqueness: false,
      quality: false
    });
  }, []);

  const handleSelectStable = useCallback(() => {
    setSelectedTabs({
      finder: true,
      trends: true,
      wordcloud: true,
      positioning: true,
      uniqueness: false, // β版を除外
      quality: false // β版を除外
    });
  }, []);

  const handleDownloadAll = useCallback(async () => {
    if (screenshots.length === 0) return;
    
    try {
      await ScreenshotCaptureService.downloadScreenshotsAsZip(screenshots);
      success('ダウンロード完了', 'AI分析画面のZIPファイルをダウンロードしました');
    } catch (error) {
      console.error('Download failed:', error);
      showError('ダウンロードエラー', 'ファイルのダウンロードに失敗しました');
    }
  }, [screenshots, success, showError]);

  const handleDownloadSingle = useCallback(async (screenshot: AnalysisScreenshot) => {
    try {
      const link = document.createElement('a');
      link.href = screenshot.dataUrl;
      link.download = `${screenshot.name}_${new Date(screenshot.timestamp).toISOString().split('T')[0]}.png`;
      link.click();
      
      success('ダウンロード完了', `${screenshot.name}をダウンロードしました`);
    } catch (error) {
      console.error('Single download failed:', error);
      showError('ダウンロードエラー', 'ファイルのダウンロードに失敗しました');
    }
  }, [success, showError]);

  const handleDeleteSingle = useCallback(async (screenshot: AnalysisScreenshot) => {
    try {
      await ScreenshotStorageService.deleteScreenshot(screenshot.id);
      success('削除完了', `${screenshot.name}を削除しました`);
      
      // ストレージ使用量更新
      const storageUsage = await ScreenshotStorageService.getStorageUsage();
      setStorageInfo(storageUsage);
    } catch (error) {
      console.error('Delete failed:', error);
      showError('削除エラー', 'ファイルの削除に失敗しました');
    }
  }, [success, showError]);

  const handleClearAll = useCallback(async () => {
    if (!window.confirm('保存されている全スクリーンショットを削除しますか？')) {
      return;
    }
    
    try {
      await ScreenshotStorageService.clearAllScreenshots();
      success('削除完了', '全スクリーンショットを削除しました');
      
      // ストレージ使用量更新
      const storageUsage = await ScreenshotStorageService.getStorageUsage();
      setStorageInfo(storageUsage);
    } catch (error) {
      console.error('Clear all failed:', error);
      showError('削除エラー', '全削除に失敗しました');
    }
  }, [success, showError]);

  const handlePreview = useCallback((screenshot: AnalysisScreenshot) => {
    setSelectedScreenshot(screenshot);
    setShowPreview(true);
  }, []);

  const formatFileSize = (dataUrl: string): string => {
    const base64 = dataUrl.split(',')[1];
    const bytes = base64.length * 0.75;
    return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)}KB` : `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };



  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('ja-JP');
  };

  const renderCaptureStatus = () => {
    switch (captureStatus) {
      case 'idle':
        return null;
      case 'capturing':
        return (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-3">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-blue-900">
                  AI分析画面を撮影中...
                </h3>
                <p className="text-sm text-blue-700 mt-1">
                  {captureProgress.screenName && `現在: ${captureProgress.screenName}`}
                </p>
                <div className="mt-2 bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(captureProgress.current / Math.max(captureProgress.total, 1)) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      case 'completed':
        return (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <h3 className="text-sm font-medium text-green-900">
                  撮影完了
                </h3>
                <p className="text-sm text-green-700 mt-1">
                  {screenshots.length}件のAI分析画面を撮影しました
                </p>
              </div>
            </div>
          </div>
        );
      case 'error':
        return (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-3">
              <XCircle className="w-5 h-5 text-red-600" />
              <div>
                <h3 className="text-sm font-medium text-red-900">
                  撮影エラー
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  AI分析画面の撮影に失敗しました
                </p>
              </div>
            </div>
          </div>
        );
    }
  };

  const renderScreenshotGrid = () => {
    console.log('🖼️ renderScreenshotGrid called, screenshots.length:', screenshots.length);
    console.log('🖼️ screenshots:', screenshots);
    
    if (isLoading) {
      return (
        <div className="text-center py-12">
          <Loader2 className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            IndexedDBから読み込み中...
          </h3>
          <p className="text-gray-600 mb-4">
            保存されたスクリーンショットを読み込んでいます
          </p>
        </div>
      );
    }
    
    if (screenshots.length === 0) {
      return (
        <div className="text-center py-12">
          <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            AI分析画面がありません
          </h3>
          <p className="text-gray-600 mb-4">
            タブを選択して「撮影開始」ボタンを押してAI分析画面をキャプチャしてください
          </p>
          <div className="text-sm text-gray-500">
            スクリーンショットは自動的にIndexedDBに保存され、セッション間で保持されます
          </div>
        </div>
      );
    }

    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {screenshots.map((screenshot) => (
            <div key={screenshot.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-48 bg-white relative group border-b border-gray-200 overflow-hidden">
                <div 
                  className="w-full h-full flex items-center justify-center cursor-pointer"
                  onClick={() => handlePreview(screenshot)}
                  title="クリックでプレビュー表示"
                >
                  <img 
                    src={screenshot.dataUrl} 
                    alt={screenshot.name}
                    className="max-w-full max-h-full object-contain transition-transform duration-200 hover:scale-105"
                    style={{ backgroundColor: 'white' }}
                  />
                </div>
                {/* ホバー時の薄いオーバーレイ - pointer-events-noneで画像クリックを妨げない */}
                <div className="absolute inset-0 bg-gray-900 opacity-0 group-hover:opacity-5 pointer-events-none transition-opacity duration-200" />
                {/* プレビューボタンは削除 - 画像クリックでプレビュー表示 */}
              </div>
              <div className="p-4">
                <h3 className="font-medium text-gray-900 mb-1">{screenshot.name}</h3>
                <p className="text-sm text-gray-600 mb-3">{screenshot.description}</p>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                  <div className="flex items-center space-x-1">
                    <Monitor className="w-3 h-3" />
                    <span>{screenshot.width}×{screenshot.height}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <FileImage className="w-3 h-3" />
                    <span>{formatFileSize(screenshot.dataUrl)}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleDownloadSingle(screenshot)}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    ダウンロード
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteSingle(screenshot)}
                    className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    } else {
      return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {screenshots.map((screenshot, index) => (
            <div key={screenshot.id} className={`p-4 ${index !== screenshots.length - 1 ? 'border-b border-gray-200' : ''}`}>
              <div className="flex items-center space-x-4">
                <div 
                  className="w-20 h-12 bg-white rounded overflow-hidden flex-shrink-0 border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handlePreview(screenshot)}
                  title="クリックでプレビュー表示"
                >
                  <img 
                    src={screenshot.dataUrl} 
                    alt={screenshot.name}
                    className="w-full h-full object-contain"
                    style={{ backgroundColor: '#ffffff' }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">{screenshot.name}</h3>
                  <p className="text-sm text-gray-600 truncate">{screenshot.description}</p>
                  <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                    <div className="flex items-center space-x-1">
                      <Monitor className="w-3 h-3" />
                      <span>{screenshot.width}×{screenshot.height}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <FileImage className="w-3 h-3" />
                      <span>{formatFileSize(screenshot.dataUrl)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimestamp(screenshot.timestamp)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownloadSingle(screenshot)}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    ダウンロード
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteSingle(screenshot)}
                    className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Visual Analytics Gallery
              </h2>
              <p className="text-gray-600">
                AI分析画面の高品質キャプチャ機能 - Excel統合用画像生成システム
              </p>
              <div className="flex items-center space-x-4 text-sm text-gray-500 mt-2">
                <div className="flex items-center space-x-1">
                  <Database className="w-4 h-4" />
                  <span>保存中: {storageInfo.count}件</span>
                </div>
                <div>
                  使用量: {(storageInfo.totalSize / (1024 * 1024)).toFixed(1)}MB
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
              <Button
                onClick={handleCaptureSelected}
                disabled={captureStatus === 'capturing' || Object.values(selectedTabs).every(v => !v)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {captureStatus === 'capturing' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    撮影中...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 mr-2" />
                    撮影開始
                  </>
                )}
              </Button>
              {screenshots.length > 0 && (
                <>
                  <Button
                    onClick={handleDownloadAll}
                    variant="outline"
                    disabled={captureStatus === 'capturing'}
                  >
                    <Package className="w-4 h-4 mr-2" />
                    ZIP一括DL
                  </Button>
                  <Button
                    onClick={handleClearAll}
                    variant="outline"
                    disabled={captureStatus === 'capturing'}
                    className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    全削除
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Tab Selection */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 mb-4">
              <h3 className="text-lg font-medium text-gray-900">撮影対象タブの選択</h3>
              <div className="flex space-x-2">
                <Button size="sm" variant="outline" onClick={handleSelectStable}>
                  安定版のみ
                </Button>
                <Button size="sm" variant="outline" onClick={handleSelectAll}>
                  全選択
                </Button>
                <Button size="sm" variant="outline" onClick={handleSelectNone}>
                  全解除
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(TAB_NAMES).map(([tabId, tabName]) => (
                <label
                  key={tabId}
                  className={`relative flex items-center p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    selectedTabs[tabId as keyof TabSelection]
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedTabs[tabId as keyof TabSelection]}
                    onChange={(e) => handleTabSelectionChange(tabId as keyof TabSelection, e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className={`ml-3 text-sm font-medium ${
                    selectedTabs[tabId as keyof TabSelection] ? 'text-blue-900' : 'text-gray-900'
                  }`}>
                    {tabName}
                  </span>
                  {tabName.includes('(β)') && (
                    <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      β
                    </span>
                  )}
                </label>
              ))}
            </div>
            
            <div className="mt-4 text-sm text-gray-600">
              選択中: {Object.values(selectedTabs).filter(Boolean).length}件 / {Object.keys(selectedTabs).length}件
            </div>
          </div>
        </div>
      </div>

      {/* Capture Status */}
      {renderCaptureStatus()}

      {/* Controls */}
      {screenshots.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {screenshots.length}件のAI分析画面
            </div>
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant={viewMode === 'grid' ? 'primary' : 'outline'}
                onClick={() => setViewMode('grid')}
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'list' ? 'primary' : 'outline'}
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Screenshot Gallery */}
      {renderScreenshotGrid()}

      {/* Preview Modal */}
      {showPreview && selectedScreenshot && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  {selectedScreenshot.name}
                </h3>
                <p className="text-sm text-gray-600">
                  {selectedScreenshot.description}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  onClick={() => handleDownloadSingle(selectedScreenshot)}
                >
                  <Download className="w-4 h-4 mr-1" />
                  ダウンロード
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowPreview(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="p-4">
              <img 
                src={selectedScreenshot.dataUrl} 
                alt={selectedScreenshot.name}
                className="w-full h-auto rounded-lg"
              />
              <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">解像度:</span>
                  <span className="ml-2 font-medium">{selectedScreenshot.width}×{selectedScreenshot.height}</span>
                </div>
                <div>
                  <span className="text-gray-500">ファイルサイズ:</span>
                  <span className="ml-2 font-medium">{formatFileSize(selectedScreenshot.dataUrl)}</span>
                </div>
                <div>
                  <span className="text-gray-500">撮影日時:</span>
                  <span className="ml-2 font-medium">{formatTimestamp(selectedScreenshot.timestamp)}</span>
                </div>
                <div>
                  <span className="text-gray-500">画面ID:</span>
                  <span className="ml-2 font-medium">{selectedScreenshot.tabId}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisualAnalyticsGallery;
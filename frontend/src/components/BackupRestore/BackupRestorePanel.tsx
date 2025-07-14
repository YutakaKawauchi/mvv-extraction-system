import React, { useState, useRef } from 'react';
import { Button, Modal } from '../common';
import { useNotification } from '../../hooks/useNotification';
import { useCompanyStore } from '../../stores/companyStore';
import { useMVVStore } from '../../stores/mvvStore';
import { 
  exportBackup, 
  importBackupFromFile, 
  type BackupData,
  type RestoreResult 
} from '../../services/backupRestore';
import { 
  Download, 
  Upload, 
  Database, 
  AlertCircle, 
  CheckCircle, 
  Info,
  FileText,
  Clock,
  Users,
  Brain,
  Target,
  Lightbulb,
  Building2
} from 'lucide-react';

export const BackupRestorePanel: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [backupPreview, setBackupPreview] = useState<BackupData | null>(null);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { loadCompanies } = useCompanyStore();
  const { loadMVVData } = useMVVStore();
  const { success, error: showError } = useNotification();

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await exportBackup();
      success('バックアップ完了', 'データのエクスポートが完了しました');
    } catch (error) {
      showError('エクスポートエラー', error instanceof Error ? error.message : 'エクスポートに失敗しました');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      
      // Preview backup contents
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data.version || !data.companies || !data.mvvData) {
        throw new Error('Invalid backup file format');
      }
      
      setBackupPreview(data);
      setShowRestoreModal(true);
    } catch (error) {
      showError('ファイルエラー', 'バックアップファイルの読み込みに失敗しました');
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRestore = async () => {
    if (!backupPreview) return;

    try {
      setIsImporting(true);
      const result = await importBackupFromFile(new File([JSON.stringify(backupPreview)], 'backup.json'));
      
      setRestoreResult(result);
      
      if (result.success) {
        // Reload data after restore
        await Promise.all([
          loadCompanies(),
          loadMVVData()
        ]);
        
        success('リストア完了', `${result.stats.updated}件更新、${result.stats.created}件作成されました`);
      } else {
        showError('リストアエラー', `${result.stats.errors}件のエラーが発生しました`);
      }
    } catch (error) {
      showError('リストアエラー', error instanceof Error ? error.message : 'リストアに失敗しました');
    } finally {
      setIsImporting(false);
    }
  };


  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('ja-JP');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900 flex items-center">
            <Database className="mr-2 h-5 w-5 text-blue-500" />
            バックアップ・リストア
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            AI処理済みデータの保護と復元
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Backup Section */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-blue-900 mb-2 flex items-center">
              <Download className="mr-2 h-5 w-5" />
              バックアップ
            </h3>
            <p className="text-sm text-blue-700 mb-4">
              全ての企業データ、MVV情報、Embeddings、ビジネスアイデアを一括エクスポート
            </p>
            <div className="flex space-x-3">
              <Button
                onClick={handleExport}
                disabled={isExporting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isExporting ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    エクスポート中...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    バックアップをダウンロード
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Restore Section */}
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-green-900 mb-2 flex items-center">
              <Upload className="mr-2 h-5 w-5" />
              リストア
            </h3>
            <p className="text-sm text-green-700 mb-4">
              バックアップファイルから企業データを復元。ファイル選択後にデータ統計を確認してからリストア実行できます。
            </p>
            <div className="flex space-x-3">
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="bg-green-600 hover:bg-green-700"
              >
                {isImporting ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    処理中...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    バックアップファイルを選択
                  </>
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>

          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-yellow-600 mr-3 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-yellow-800 mb-1">
                  重要な注意事項
                </h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• リストア時は企業名とWebsite URLで突合して上書きします</li>
                  <li>• Embeddingsデータは貴重なAI処理結果のため、必ず事前にバックアップを取ってください</li>
                  <li>• 大量データの場合、処理に時間がかかる場合があります</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Backup/Restore Modal */}
      <Modal
        isOpen={showRestoreModal}
        onClose={() => {
          setShowRestoreModal(false);
          setBackupPreview(null);
          setRestoreResult(null);
        }}
        title={restoreResult ? "リストア結果" : "バックアップ詳細"}
        size="lg"
      >
        {restoreResult ? (
          /* Restore Results */
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              {restoreResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              <h3 className="text-lg font-medium">
                {restoreResult.success ? 'リストア完了' : 'リストア中にエラーが発生'}
              </h3>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">処理結果</h4>
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <span className="text-gray-600">総件数:</span>
                  <span className="ml-2 font-medium">{restoreResult.stats.total}</span>
                </div>
                <div>
                  <span className="text-gray-600">更新:</span>
                  <span className="ml-2 font-medium text-blue-600">{restoreResult.stats.updated}</span>
                </div>
                <div>
                  <span className="text-gray-600">新規作成:</span>
                  <span className="ml-2 font-medium text-green-600">{restoreResult.stats.created}</span>
                </div>
                <div>
                  <span className="text-gray-600">エラー:</span>
                  <span className="ml-2 font-medium text-red-600">{restoreResult.stats.errors}</span>
                </div>
              </div>
              
              {/* 詳細統計を表示 */}
              {restoreResult.details && (
                <div className="border-t border-gray-200 pt-3">
                  <h5 className="text-sm font-medium text-gray-900 mb-2">詳細内訳</h5>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">企業データ:</span>
                      <span className="text-right">
                        <span className="text-green-600">{restoreResult.details.companies.created}件作成</span>
                        <span className="text-gray-400 mx-1">/</span>
                        <span className="text-blue-600">{restoreResult.details.companies.updated}件更新</span>
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">MVVデータ:</span>
                      <span className="text-right">
                        <span className="text-green-600">{restoreResult.details.mvvData.created}件作成</span>
                        <span className="text-gray-400 mx-1">/</span>
                        <span className="text-blue-600">{restoreResult.details.mvvData.updated}件更新</span>
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">企業情報:</span>
                      <span className="text-right">
                        <span className="text-green-600">{restoreResult.details.companyInfo.created}件作成</span>
                        <span className="text-gray-400 mx-1">/</span>
                        <span className="text-blue-600">{restoreResult.details.companyInfo.updated}件更新</span>
                      </span>
                    </div>
                    {restoreResult.details.businessIdeas && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">ビジネスアイデア:</span>
                        <span className="text-right">
                          <span className="text-green-600">{restoreResult.details.businessIdeas.created}件作成</span>
                          <span className="text-gray-400 mx-1">/</span>
                          <span className="text-blue-600">{restoreResult.details.businessIdeas.updated}件更新</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {restoreResult.errors.length > 0 && (
              <div className="bg-red-50 rounded-lg p-4">
                <h4 className="font-medium text-red-900 mb-2">エラー詳細</h4>
                <div className="space-y-1 text-sm">
                  {restoreResult.errors.map((error, index) => (
                    <div key={index} className="text-red-700">
                      <span className="font-medium">{error.companyName}:</span> {error.error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : backupPreview ? (
          /* Backup Preview */
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                <Info className="mr-2 h-4 w-4" />
                バックアップ情報
              </h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">バージョン:</span>
                  <span className="ml-2 font-medium">{backupPreview.version}</span>
                </div>
                <div>
                  <span className="text-gray-600">作成日時:</span>
                  <span className="ml-2 font-medium">{formatDateTime(backupPreview.timestamp)}</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-3 flex items-center">
                <Target className="mr-2 h-4 w-4" />
                データ統計
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div className="flex items-center">
                  <Users className="mr-2 h-4 w-4 text-blue-600" />
                  <span className="text-gray-600">総企業数:</span>
                  <span className="ml-2 font-medium">{backupPreview.stats.totalCompanies}</span>
                </div>
                <div className="flex items-center">
                  <FileText className="mr-2 h-4 w-4 text-green-600" />
                  <span className="text-gray-600">MVV抽出済み:</span>
                  <span className="ml-2 font-medium">{backupPreview.stats.companiesWithMVV}</span>
                </div>
                <div className="flex items-center">
                  <Brain className="mr-2 h-4 w-4 text-purple-600" />
                  <span className="text-gray-600">Embeddings生成済み:</span>
                  <span className="ml-2 font-medium">{backupPreview.stats.companiesWithEmbeddings}</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                  <span className="text-gray-600">完全完了:</span>
                  <span className="ml-2 font-medium">{backupPreview.stats.fullyCompleted}</span>
                </div>
                {backupPreview.stats.totalIdeas !== undefined && (
                  <div className="flex items-center">
                    <Lightbulb className="mr-2 h-4 w-4 text-orange-600" />
                    <span className="text-gray-600">アイデア総数:</span>
                    <span className="ml-2 font-medium">{backupPreview.stats.totalIdeas}</span>
                  </div>
                )}
                {backupPreview.stats.companiesWithIdeas !== undefined && (
                  <div className="flex items-center">
                    <Building2 className="mr-2 h-4 w-4 text-indigo-600" />
                    <span className="text-gray-600">アイデア保有企業:</span>
                    <span className="ml-2 font-medium">{backupPreview.stats.companiesWithIdeas}</span>
                  </div>
                )}
                {/* 企業情報統計を追加 */}
                {backupPreview.stats.companiesWithInfo !== undefined && (
                  <div className="flex items-center">
                    <Database className="mr-2 h-4 w-4 text-blue-600" />
                    <span className="text-gray-600">企業情報有り:</span>
                    <span className="ml-2 font-medium">{backupPreview.stats.companiesWithInfo}</span>
                  </div>
                )}
              </div>
              
              {/* Status Breakdown - Only show if statusBreakdown exists */}
              {backupPreview.stats.statusBreakdown && (
                <div className="border-t border-blue-200 pt-3">
                  <h5 className="text-sm font-medium text-blue-900 mb-2">ステータス別内訳</h5>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">待機中:</span>
                      <span className="font-medium">{backupPreview.stats.statusBreakdown.pending || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">処理中:</span>
                      <span className="font-medium">{backupPreview.stats.statusBreakdown.processing || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">MVV抽出済み:</span>
                      <span className="font-medium">{backupPreview.stats.statusBreakdown.mvv_extracted || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">完全完了:</span>
                      <span className="font-medium">{backupPreview.stats.statusBreakdown.fully_completed || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">MVVエラー:</span>
                      <span className="font-medium text-red-600">{backupPreview.stats.statusBreakdown.mvv_extraction_error || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Embeddingsエラー:</span>
                      <span className="font-medium text-red-600">{backupPreview.stats.statusBreakdown.embeddings_generation_error || 0}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowRestoreModal(false)}
              >
                キャンセル
              </Button>
              <Button
                onClick={handleRestore}
                disabled={isImporting}
                className="bg-green-600 hover:bg-green-700"
              >
                {isImporting ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    リストア中...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    リストア実行
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};
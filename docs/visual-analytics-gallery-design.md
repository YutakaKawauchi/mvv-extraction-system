# Visual Analytics Gallery 技術設計書

**最終更新**: 2025-07-13  
**Phase**: 3完了（Visual Analytics Gallery with Excel Integration）

## 概要

Visual Analytics Galleryは、MVV分析システムの5つのリアルタイム分析画面を高品質スクリーンショットとして保存し、Professional Excel Exportと統合する革新的機能です。AI分析結果を視覚的な形式で永続化し、ビジネスレポートに統合することで、データ分析の価値を最大化します。

## 設計目標

### ✅ 達成済み目標
1. **高品質キャプチャ**: 2100×1350px高解像度でのピクセルパーフェクトなスクリーンショット
2. **永続化ストレージ**: IndexedDBによるブラウザ内永続化（セッション管理なし）
3. **TabID分類**: 分析タイプ別の自動整理（finder, trends, wordcloud, positioning, uniqueness, quality）
4. **Excel統合**: マルチシートExcelレポートへの画像埋め込み
5. **ブラウザ互換性**: Node.js依存なしのフロントエンド完結型アーキテクチャ
6. **効率的ストレージ**: LRU削除による50件上限管理
7. **高速クエリ**: ネイティブIndexedDB APIによる最適化されたデータアクセス

## システムアーキテクチャ

### 全体構成
```
┌─────────────────────────────────────────────────────────────┐
│                    Visual Analytics Gallery                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ Screenshot      │  │ Storage         │  │ Excel        │ │
│  │ Capture         │  │ Management      │  │ Integration  │ │
│  │                 │  │                 │  │              │ │
│  │ • html2canvas   │  │ • IndexedDB     │  │ • ExcelJS    │ │
│  │ • 2100×1350px   │  │ • TabID分類     │  │ • Multi-sheet│ │
│  │ • PNG 95%品質   │  │ • LRU管理       │  │ • Image embed│ │
│  │ • DOM Capture   │  │ • Metadata分離  │  │ • Base64変換 │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
│           │                     │                     │    │
│           ▼                     ▼                     ▼    │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │               Browser Runtime Environment               │ │
│  │ • Canvas API • IndexedDB API • Blob/ArrayBuffer       │ │
│  │ • File API   • DOM Selection • Base64 Processing      │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### データフロー
```
1. ユーザー操作
   ↓
2. AI分析画面表示
   ↓
3. スクリーンショットキャプチャ (html2canvas)
   ↓
4. 画像データ生成 (PNG Base64)
   ↓
5. メタデータ作成 (TabID, timestamp, etc.)
   ↓
6. IndexedDB保存 (分離ストレージ)
   ↓
7. UI更新 (ギャラリー表示)
   ↓
8. Excel統合時 (TabID別グループ化)
   ↓
9. Base64→ArrayBuffer変換 (ブラウザ互換)
   ↓
10. ExcelJSワークブック埋め込み
```

## 技術仕様

### 1. スクリーンショットキャプチャ

#### 1.1 キャプチャエンジン
```typescript
interface ScreenshotCapture {
  captureElement: (selector: string, options: CaptureOptions) => Promise<string>;
  optimizeQuality: (canvas: HTMLCanvasElement) => void;
  validateDimensions: (width: number, height: number) => boolean;
}

interface CaptureOptions {
  width: number;           // 2100px (4K対応高解像度)
  height: number;          // 1350px (16:10アスペクト比)
  quality: number;         // 0.95 (PNG高品質)
  format: 'png' | 'jpeg';  // PNG推奨（ロスレス）
  backgroundColor: string; // '#ffffff' (白背景)
  scale: number;           // 1.0 (デフォルトスケール)
  logging: boolean;        // true (詳細ログ)
}
```

#### 1.2 実装詳細
```typescript
class ScreenshotCaptureService {
  async captureAnalysisScreen(tabId: string, name: string): Promise<boolean> {
    try {
      const targetElement = document.querySelector('#analysis-container');
      if (!targetElement) {
        throw new Error('キャプチャ対象要素が見つかりません');
      }

      // html2canvasによる高品質キャプチャ
      const canvas = await html2canvas(targetElement, {
        width: 2100,
        height: 1350,
        scale: 1,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: false,
        imageTimeout: 15000,
        logging: false
      });

      // PNG形式で高品質出力
      const base64Data = canvas.toDataURL('image/png', 0.95);
      
      // メタデータ作成
      const metadata: ScreenshotMetadata = {
        id: `screenshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        name: name || `${tabId}_${new Date().toISOString().split('T')[0]}`,
        description: `${this.getTabDisplayName(tabId)}分析結果`,
        tabId: tabId,
        width: canvas.width,
        height: canvas.height,
        size: this.calculateBase64Size(base64Data)
      };

      // 分離ストレージに保存
      await this.storageService.saveScreenshot(metadata, base64Data);
      
      return true;
    } catch (error) {
      console.error('スクリーンショットキャプチャエラー:', error);
      return false;
    }
  }

  private calculateBase64Size(base64Data: string): number {
    // Base64文字列のバイト数計算
    const base64 = base64Data.split(',')[1];
    return Math.round((base64.length * 3) / 4);
  }
}
```

### 2. IndexedDBストレージシステム

#### 2.1 データベーススキーマ
```typescript
interface ScreenshotDatabase {
  version: 1;
  stores: {
    screenshots: {
      keyPath: 'id';
      indexes: [
        { name: 'timestamp', keyPath: 'timestamp' },
        { name: 'tabId', keyPath: 'tabId' },
        { name: 'name', keyPath: 'name' }
      ];
    };
    screenshotData: {
      keyPath: 'id';
      indexes: [];
    };
  };
}

interface ScreenshotMetadata {
  id: string;              // 一意識別子
  timestamp: number;       // 作成日時 (Unix timestamp)
  name: string;            // ユーザー定義名
  description: string;     // 説明
  tabId: string;           // 分析タブID
  width: number;           // 画像幅 (px)
  height: number;          // 画像高さ (px)
  size: number;            // ファイルサイズ (bytes)
}

interface ScreenshotData {
  id: string;              // metadataとの関連付け
  data: string;            // Base64エンコードされた画像データ
}
```

#### 2.2 ストレージ管理
```typescript
class ScreenshotStorageService {
  private db: IDBDatabase;
  private readonly MAX_SCREENSHOTS = 50;
  
  // 効率的なTabID別カウント
  async countByTabId(tabId: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['screenshots'], 'readonly');
      const store = transaction.objectStore('screenshots');
      const index = store.index('tabId');
      const request = index.count(tabId);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // 高速TabID別取得
  async getByTabId(tabId: string): Promise<ScreenshotMetadata[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['screenshots'], 'readonly');
      const store = transaction.objectStore('screenshots');
      const index = store.index('tabId');
      const request = index.getAll(tabId);
      
      request.onsuccess = () => {
        const results = request.result.sort((a, b) => b.timestamp - a.timestamp);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // LRU自動削除
  async maintainStorageLimit(): Promise<void> {
    const total = await this.getTotalCount();
    if (total > this.MAX_SCREENSHOTS) {
      const excess = total - this.MAX_SCREENSHOTS;
      await this.deleteOldestScreenshots(excess);
    }
  }

  private async deleteOldestScreenshots(count: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['screenshots', 'screenshotData'], 'readwrite');
      const metadataStore = transaction.objectStore('screenshots');
      const dataStore = transaction.objectStore('screenshotData');
      const index = metadataStore.index('timestamp');
      
      // 古い順でカーソル取得
      const request = index.openCursor();
      let deleted = 0;
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor && deleted < count) {
          const id = cursor.value.id;
          
          // メタデータとデータの両方を削除
          metadataStore.delete(id);
          dataStore.delete(id);
          
          deleted++;
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // 効率的な保存（トランザクション使用）
  async saveScreenshot(metadata: ScreenshotMetadata, imageData: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['screenshots', 'screenshotData'], 'readwrite');
      const metadataStore = transaction.objectStore('screenshots');
      const dataStore = transaction.objectStore('screenshotData');
      
      // メタデータとデータを同時保存
      metadataStore.add(metadata);
      dataStore.add({ id: metadata.id, data: imageData });
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    
    // 保存後にストレージ上限チェック
    await this.maintainStorageLimit();
  }
}
```

### 3. Excel統合システム

#### 3.1 画像埋め込み処理
```typescript
class ExcelImageIntegration {
  // ブラウザ互換Base64→ArrayBuffer変換
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    // dataURL prefixを除去
    const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
    
    // atob()でバイナリ文字列に変換
    const binaryString = atob(base64Data);
    const length = binaryString.length;
    const bytes = new Uint8Array(length);
    
    // 1文字ずつバイト値に変換
    for (let i = 0; i < length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return bytes.buffer; // ExcelJS互換のArrayBuffer
  }

  // TabID別マルチシート生成
  async generateVisualAnalyticsSheets(workbook: ExcelJS.Workbook): Promise<void> {
    const screenshots = await this.storageService.getAllScreenshots();
    const groupedByTab = this.groupScreenshotsByTabId(screenshots);
    
    for (const [tabId, tabScreenshots] of groupedByTab) {
      if (tabScreenshots.length === 0) continue;
      
      await this.createTabSheet(workbook, tabId, tabScreenshots);
    }
  }

  private async createTabSheet(
    workbook: ExcelJS.Workbook, 
    tabId: string, 
    screenshots: ScreenshotMetadata[]
  ): Promise<void> {
    const sheetName = `Visual Analytics - ${this.getTabDisplayName(tabId)}`;
    const worksheet = workbook.addWorksheet(sheetName);
    
    // ヘッダー設定
    worksheet.columns = [
      { header: '名前', key: 'name', width: 25 },
      { header: '作成日時', key: 'timestamp', width: 20 },
      { header: '説明', key: 'description', width: 30 },
      { header: 'サイズ', key: 'size', width: 12 },
      { header: '画像', key: 'image', width: 50 }
    ];

    let currentRow = 2; // ヘッダーの次の行から開始
    
    for (const screenshot of screenshots) {
      // メタデータ行の設定
      worksheet.getCell(`A${currentRow}`).value = screenshot.name;
      worksheet.getCell(`B${currentRow}`).value = new Date(screenshot.timestamp);
      worksheet.getCell(`C${currentRow}`).value = screenshot.description;
      worksheet.getCell(`D${currentRow}`).value = `${Math.round(screenshot.size / 1024)}KB`;
      
      // 画像データの取得と埋め込み
      try {
        const imageData = await this.storageService.getScreenshotData(screenshot.id);
        if (imageData) {
          const imageBuffer = this.base64ToArrayBuffer(imageData);
          
          // ExcelJSで画像を追加
          const imageId = workbook.addImage({
            buffer: imageBuffer,
            extension: 'png',
          });
          
          // 画像を指定セルに配置（アスペクト比維持）
          worksheet.addImage(imageId, {
            tl: { col: 4, row: currentRow - 1 }, // E列に配置
            ext: { width: 400, height: 300 }     // 表示サイズ
          });
          
          // 画像行の高さを調整
          worksheet.getRow(currentRow).height = 225; // 300px相当
        }
      } catch (error) {
        console.error(`画像埋め込みエラー (${screenshot.id}):`, error);
        worksheet.getCell(`E${currentRow}`).value = '画像読み込みエラー';
      }
      
      currentRow++;
    }
    
    // シート全体の書式設定
    worksheet.getRow(1).font = { bold: true };
    worksheet.autoFilter = 'A1:E1';
  }

  private groupScreenshotsByTabId(screenshots: ScreenshotMetadata[]): Map<string, ScreenshotMetadata[]> {
    const grouped = new Map<string, ScreenshotMetadata[]>();
    
    for (const screenshot of screenshots) {
      if (!grouped.has(screenshot.tabId)) {
        grouped.set(screenshot.tabId, []);
      }
      grouped.get(screenshot.tabId)!.push(screenshot);
    }
    
    // 各グループ内で時系列ソート（新しい順）
    for (const [tabId, group] of grouped) {
      group.sort((a, b) => b.timestamp - a.timestamp);
    }
    
    return grouped;
  }

  private getTabDisplayName(tabId: string): string {
    const displayNames = {
      'finder': '類似企業検索',
      'trends': 'トレンド分析',
      'wordcloud': 'ワードクラウド',
      'positioning': 'ポジショニングマップ',
      'uniqueness': '独自性分析',
      'quality': '品質評価'
    };
    return displayNames[tabId] || tabId;
  }
}
```

### 4. UI/UXコンポーネント

#### 4.1 ギャラリーUI
```typescript
export const VisualAnalyticsGallery: React.FC = () => {
  const [screenshots, setScreenshots] = useState<ScreenshotMetadata[]>([]);
  const [storageUsage, setStorageUsage] = useState<StorageInfo>();
  const [isCapturing, setIsCapturing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<string>('all');

  // 効率的なデータ読み込み
  const loadScreenshots = useCallback(async () => {
    try {
      if (selectedTab === 'all') {
        const allScreenshots = await screenshotStorage.getAllScreenshots();
        setScreenshots(allScreenshots);
      } else {
        const tabScreenshots = await screenshotStorage.getByTabId(selectedTab);
        setScreenshots(tabScreenshots);
      }
      
      // ストレージ使用量の更新
      const usage = await screenshotStorage.getStorageUsage();
      setStorageUsage(usage);
    } catch (error) {
      console.error('スクリーンショット読み込みエラー:', error);
    }
  }, [selectedTab]);

  // キャプチャ実行
  const handleCapture = useCallback(async (tabId: string, name: string) => {
    setIsCapturing(true);
    try {
      const success = await screenshotCapture.captureAnalysisScreen(tabId, name);
      if (success) {
        await loadScreenshots(); // リストを更新
        toast.success('スクリーンショットを保存しました');
      } else {
        toast.error('スクリーンショットの保存に失敗しました');
      }
    } finally {
      setIsCapturing(false);
    }
  }, [loadScreenshots]);

  // 削除処理
  const handleDelete = useCallback(async (id: string) => {
    try {
      await screenshotStorage.deleteScreenshot(id);
      await loadScreenshots();
      toast.success('スクリーンショットを削除しました');
    } catch (error) {
      console.error('削除エラー:', error);
      toast.error('削除に失敗しました');
    }
  }, [loadScreenshots]);

  return (
    <div className="space-y-6">
      {/* キャプチャコントロール */}
      <CaptureControls 
        onCapture={handleCapture}
        isCapturing={isCapturing}
        disabled={screenshots.length >= 50}
      />
      
      {/* タブフィルター */}
      <TabFilter 
        selectedTab={selectedTab}
        onTabChange={setSelectedTab}
        screenshots={screenshots}
      />
      
      {/* ギャラリーグリッド */}
      <ScreenshotGrid 
        screenshots={screenshots}
        onDelete={handleDelete}
        onPreview={handlePreview}
      />
      
      {/* ストレージ使用量 */}
      <StorageUsageDisplay usage={storageUsage} />
      
      {/* Excel統合パネル */}
      <ExcelIntegrationPanel screenshots={screenshots} />
    </div>
  );
};
```

#### 4.2 キャプチャコントロール
```typescript
const CaptureControls: React.FC<CaptureControlsProps> = ({
  onCapture, 
  isCapturing, 
  disabled
}) => {
  const [customName, setCustomName] = useState('');
  const currentTabId = useAnalysisStore(state => state.activeTab);

  const handleQuickCapture = useCallback(() => {
    const defaultName = `${getTabDisplayName(currentTabId)}_${new Date().toLocaleDateString('ja-JP')}`;
    onCapture(currentTabId, customName || defaultName);
    setCustomName('');
  }, [currentTabId, customName, onCapture]);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Label htmlFor="screenshot-name">スクリーンショット名（オプション）</Label>
          <Input
            id="screenshot-name"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder={`${getTabDisplayName(currentTabId)}分析結果`}
            disabled={isCapturing}
          />
        </div>
        
        <Button
          onClick={handleQuickCapture}
          disabled={disabled || isCapturing}
          className="flex items-center gap-2"
        >
          {isCapturing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              キャプチャ中...
            </>
          ) : (
            <>
              <Camera className="w-4 h-4" />
              スクリーンショット撮影
            </>
          )}
        </Button>
      </div>
      
      {disabled && (
        <Alert className="mt-3">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            ストレージ上限（50件）に達しています。古いスクリーンショットを削除してください。
          </AlertDescription>
        </Alert>
      )}
    </Card>
  );
};
```

## パフォーマンス最適化

### 1. キャプチャ最適化
```typescript
// 高速化テクニック
const optimizedCapture = {
  // 非同期処理によるUIブロック防止
  async: true,
  
  // メモリ使用量削減
  canvas: {
    willReadFrequently: true,
    alpha: false
  },
  
  // 描画最適化
  rendering: {
    useCORS: true,
    allowTaint: false,
    foreignObjectRendering: false
  },
  
  // タイムアウト設定
  timeout: 15000
};
```

### 2. ストレージ最適化
```typescript
// インデックス活用による高速クエリ
const optimizedQueries = {
  // TabID別カウント（O(log n)）
  countByTabId: 'index.count()',
  
  // 時系列ソート（インデックス活用）
  sortByTimestamp: 'index.openCursor(range, direction)',
  
  // バッチ削除（トランザクション）
  batchDelete: 'transaction.objectStore().delete()'
};
```

### 3. メモリ管理
```typescript
class MemoryManager {
  // Base64データのメモリ効率計算
  calculateMemoryUsage(base64Data: string): number {
    // Base64は元データの133%のサイズ
    const actualSize = (base64Data.length * 3) / 4;
    return actualSize;
  }
  
  // ガベージコレクション推奨
  suggestCleanup(): boolean {
    const usage = this.getTotalMemoryUsage();
    return usage > 50 * 1024 * 1024; // 50MB超過
  }
}
```

## エラーハンドリング

### 1. キャプチャエラー
```typescript
class CaptureErrorHandler {
  async handleCaptureError(error: Error): Promise<CaptureResult> {
    if (error.name === 'SecurityError') {
      return {
        success: false,
        error: 'セキュリティ制限によりキャプチャできません（CORS）',
        suggestions: ['ページを再読み込みしてください', 'ブラウザの設定を確認してください']
      };
    }
    
    if (error.name === 'QuotaExceededError') {
      return {
        success: false,
        error: 'ストレージ容量が不足しています',
        suggestions: ['古いスクリーンショットを削除してください', 'ブラウザのキャッシュをクリアしてください']
      };
    }
    
    if (error.message.includes('html2canvas')) {
      return {
        success: false,
        error: 'レンダリングエラーが発生しました',
        suggestions: ['対象要素が表示されているか確認してください', 'ページが完全に読み込まれてから実行してください']
      };
    }
    
    return {
      success: false,
      error: '不明なエラーが発生しました',
      suggestions: ['再試行してください', 'ブラウザを更新してください']
    };
  }
}
```

### 2. ストレージエラー
```typescript
class StorageErrorHandler {
  async handleStorageError(error: DOMException): Promise<StorageResult> {
    switch (error.name) {
      case 'QuotaExceededError':
        await this.autoCleanup();
        return { success: false, recovered: true, message: '古いデータを自動削除しました' };
        
      case 'InvalidStateError':
        await this.reinitializeDatabase();
        return { success: false, recovered: true, message: 'データベースを再初期化しました' };
        
      case 'DataError':
        return { success: false, recovered: false, message: 'データが破損しています' };
        
      default:
        return { success: false, recovered: false, message: 'ストレージエラーが発生しました' };
    }
  }
}
```

## ブラウザ互換性

### サポート対象
- **Chrome**: 80+ ✅
- **Firefox**: 75+ ✅  
- **Safari**: 13+ ✅
- **Edge**: 80+ ✅

### 必要なAPI
- Canvas API
- IndexedDB
- Blob/ArrayBuffer
- atob/btoa
- html2canvas (external library)

### フォールバック戦略
```typescript
class CompatibilityChecker {
  checkSupport(): CompatibilityResult {
    const support = {
      canvas: 'HTMLCanvasElement' in window,
      indexedDB: 'indexedDB' in window,
      blob: 'Blob' in window,
      base64: 'atob' in window && 'btoa' in window
    };
    
    const unsupported = Object.entries(support)
      .filter(([key, supported]) => !supported)
      .map(([key]) => key);
      
    return {
      isSupported: unsupported.length === 0,
      unsupportedFeatures: unsupported,
      suggestions: this.getSuggestions(unsupported)
    };
  }
}
```

## セキュリティ考慮事項

### 1. CORS対応
- html2canvasのuseCORS設定
- 外部リソースのallowTaint制御
- 同一オリジンポリシー準拠

### 2. データ保護
- ローカルストレージのみ使用（サーバー送信なし）
- 機密データの自動削除
- ブラウザのセキュリティ機能活用

### 3. リソース制限
- 50件上限による容量制御
- メモリ使用量監視
- 自動クリーンアップ機能

## 運用・保守

### 1. 監視指標
```typescript
interface Metrics {
  captureSuccess: number;      // キャプチャ成功率
  averageCaptureTime: number;  // 平均キャプチャ時間
  storageUsage: number;        // ストレージ使用量
  errorRate: number;           // エラー率
  cleanupFrequency: number;    // 自動削除頻度
}
```

### 2. トラブルシューティング
- キャプチャ失敗の診断ツール
- ストレージ状態の確認機能
- パフォーマンスプロファイリング
- エラーログの収集

### 3. アップグレード戦略
- データマイグレーション計画
- 後方互換性の維持
- 段階的機能追加

## 将来の拡張計画

### Phase 4候補機能
1. **動画キャプチャ**: 分析プロセスの録画機能
2. **クラウド同期**: 複数デバイス間でのスクリーンショット共有
3. **AI自動命名**: 分析内容に基づいた自動ファイル名生成
4. **カスタム注釈**: キャプチャ画像への注釈・編集機能
5. **PDF統合**: Excel以外の形式でのレポート生成

## 結論

Visual Analytics Galleryは、AI分析結果の視覚的永続化により、データ分析の価値を最大化する革新的システムです。

### ✅ 技術的成果
- **高品質キャプチャ**: 2100×1350px高解像度スクリーンショット
- **効率的ストレージ**: IndexedDB最適化による高速アクセス
- **Excel統合**: ブラウザ互換の画像埋め込み技術
- **優れたUX**: 直感的な操作と自動管理

### 🚀 ビジネス価値
- **分析結果の永続化**: 一時的な画面を恒久的な資産に変換
- **レポート品質向上**: 視覚的な分析結果をビジネス文書に統合
- **効率的なデータ管理**: 自動分類と整理による運用負荷軽減
- **プレゼンテーション支援**: 高品質な分析画像の即座利用

Phase 3完了により、Visual Analytics Galleryは企業分析プラットフォームの差別化要因となり、Phase 4での更なる進化の基盤を提供します。

---

**最終更新**: 2025-07-13  
**Phase**: 3完了 (Visual Analytics Gallery with Excel Integration)  
**次期計画**: Phase 4 (AI-powered insights and enterprise features)
# コンポーネントアーキテクチャ設計書

## 概要

MVV分析システムのReactコンポーネント構成、データフロー、状態管理について詳述します。

## 1. 全体アーキテクチャ

### 1.1 コンポーネント階層
```
App.tsx
├── AuthGuard
│   ├── Login
│   └── Dashboard
│       ├── CompanyManager
│       │   ├── CompanyList
│       │   ├── CompanyForm
│       │   ├── CSVImporter
│       │   └── CompanyInfoTooltip
│       ├── MVVExtractor
│       │   ├── BatchProcessor
│       │   ├── CompanySelector
│       │   └── ProcessingStatus
│       ├── MVVAnalysisDashboard ⭐
│       │   ├── SimilarCompanyFinder
│       │   ├── MVVTrendAnalysis
│       │   ├── WordCloudDashboard ⭐
│       │   ├── CompetitivePositioningMap ⭐
│       │   ├── UniquenessScoreDashboard ⭐
│       │   ├── MVVQualityAssessment ⭐
│       │   └── VisualAnalyticsGallery 🎯
│       ├── ResultsViewer
│       │   ├── ResultsTable
│       │   ├── MVVDisplay
│       │   └── ExcelExportWizard 📊
│       ├── AdminPanel 🔧
│       │   ├── DataDiagnostics
│       │   ├── RecoveryTools
│       │   └── SystemDiagnostics
│       └── BackupRestore
│           └── BackupRestorePanel
└── Common Components
    ├── LoadingSpinner
    ├── Modal
    ├── ErrorBoundary
    └── NotificationToast
```

⭐ = リアルタイム分析コンポーネント  
🎯 = Visual Analytics機能  
📊 = Excel Export機能  
🔧 = 管理者パネル

### 1.2 状態管理アーキテクチャ
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   UI Components │◄──►│   Zustand Store │◄──►│   IndexedDB     │
│                 │    │                 │    │                 │
│ - Dashboard     │    │ - analysisStore │    │ - companies     │
│ - Word Cloud    │    │ - companyStore  │    │ - embeddings    │
│ - Positioning   │    │ - authStore     │    │ - similarities  │
│ - Uniqueness    │    │ - mvvStore      │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Services Layer                              │
│ - similarityCalculator.ts                                       │
│ - progressiveCalculator.ts                                      │
│ - similarityCache.ts                                            │
│ - hybridDataLoader.ts                                           │
└─────────────────────────────────────────────────────────────────┘
```

## 2. 主要コンポーネント詳細

### 2.1 MVVAnalysisDashboard
**責務**: 分析機能の統合インターフェース
```typescript
export const MVVAnalysisDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('finder');
  const { data, isLoading, loadAnalysisData } = useAnalysisStore();
  
  // タブ定義とルーティング
  const tabs = [
    { id: 'finder', name: '類似企業検索', component: SimilarCompanyFinder },
    { id: 'trends', name: 'トレンド分析', component: MVVTrendAnalysis },
    { id: 'wordcloud', name: 'ワードクラウド', component: WordCloudDashboard },
    { id: 'positioning', name: 'ポジショニング', component: CompetitivePositioningMap },
    { id: 'uniqueness', name: '独自性分析 (β)', component: UniquenessScoreDashboard },
    { id: 'quality', name: '品質評価 (β)', component: MVVQualityAssessment }
  ];
  
  return (
    <ErrorBoundary>
      {/* タブナビゲーション */}
      {/* 動的コンテンツレンダリング */}
    </ErrorBoundary>
  );
};
```

### 2.2 WordCloudDashboard
**責務**: インタラクティブワードクラウド表示
```typescript
export const WordCloudDashboard: React.FC = () => {
  // フィルタリング状態
  const [selectedType, setSelectedType] = useState<MVVType>('all');
  const [categoryLevel, setCategoryLevel] = useState<'major' | 'middle'>('major');
  const [minFrequency, setMinFrequency] = useState<number>(2);
  
  // キーワード分析（リアルタイム計算）
  const { keywordAnalysis } = useMemo(() => {
    return analyzeKeywords(data?.companies, {
      selectedType,
      categoryLevel,
      minFrequency
    });
  }, [data, selectedType, categoryLevel, minFrequency]);
  
  // インタラクションハンドリング
  const handleWordClick = useCallback((word: WordData) => {
    setSelectedWordDetails(extractWordDetails(word, data?.companies));
  }, [data]);
  
  return (
    <>
      {/* フィルターUI */}
      <WordCloudFilters {...filterProps} />
      
      {/* インタラクティブワードクラウド */}
      <WordCloud 
        words={keywordAnalysis}
        onWordClick={handleWordClick}
        width={800}
        height={500}
      />
      
      {/* 詳細モーダル */}
      {selectedWordDetails && (
        <WordDetailsModal {...selectedWordDetails} />
      )}
    </>
  );
};
```

### 2.3 CompetitivePositioningMap
**責務**: MDS-based競合ポジショニング可視化
```typescript
export const CompetitivePositioningMap: React.FC = () => {
  // ビューポート制御
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewBox, setViewBox] = useState({ x: -100, y: -100, width: 200, height: 200 });
  const [isDragging, setIsDragging] = useState(false);
  
  // ポジション計算（重い処理）
  const { positions, clusters } = useMemo(() => {
    const similarityMatrix = calculateSimilarityMatrix(companies);
    const positions = performMDS(similarityMatrix, companies);
    const clusters = performCategoryClustering(positions);
    
    return { positions, clusters };
  }, [companies]);
  
  // インタラクション処理
  const dragHandlers = useDragHandlers(zoomLevel, viewBox, setViewBox);
  const zoomHandlers = useZoomHandlers(setZoomLevel);
  
  return (
    <div className="space-y-6">
      {/* コントロールパネル */}
      <PositioningControls {...controlProps} />
      
      {/* SVGマップ */}
      <svg 
        {...dragHandlers}
        {...zoomHandlers}
        viewBox={`${viewBox.x / zoomLevel} ${viewBox.y / zoomLevel} ${viewBox.width / zoomLevel} ${viewBox.height / zoomLevel}`}
      >
        {/* グリッド、軸、企業ポイント */}
        <MapElements positions={positions} clusters={clusters} />
      </svg>
      
      {/* 企業詳細サイドパネル */}
      <CompanyDetailsPanel selectedCompany={selectedCompany} />
    </div>
  );
};
```

### 2.4 UniquenessScoreDashboard
**責務**: 多要素独自性スコア計算・表示
```typescript
export const UniquenessScoreDashboard: React.FC = () => {
  // スコア計算（重い処理 - 最適化が重要）
  const uniquenessData = useMemo(() => {
    const monitor = new PerformanceMonitor();
    monitor.startTimer('uniqueness-calculation');
    
    const results = companies.map(company => ({
      ...company,
      uniquenessMetrics: calculateUniquenessScore(company, companies, {
        baseWeight: 0.3,
        industryWeight: 0.4,
        crossIndustryWeight: 0.2,
        rarityWeight: 0.1
      })
    }));
    
    monitor.endTimer('uniqueness-calculation');
    return results;
  }, [companies]);
  
  // ソートとフィルタリング
  const sortedData = useMemo(() => {
    return [...uniquenessData].sort((a, b) => 
      b.uniquenessMetrics.finalScore - a.uniquenessMetrics.finalScore
    );
  }, [uniquenessData, sortConfig]);
  
  return (
    <>
      {/* 統計サマリー */}
      <UniquenessStatistics data={uniquenessData} />
      
      {/* ランキングテーブル */}
      <UniquenessTable 
        data={sortedData}
        onSort={handleSort}
        onCompanySelect={setSelectedCompany}
      />
      
      {/* 詳細ブレークダウン */}
      <ScoreBreakdown company={selectedCompany} />
    </>
  );
};
```

### 2.5 VisualAnalyticsGallery
**責務**: AI分析画面のスクリーンショット管理とExcel統合
```typescript
export const VisualAnalyticsGallery: React.FC = () => {
  // ストレージ状態管理
  const [screenshots, setScreenshots] = useState<ScreenshotMetadata[]>([]);
  const [storageUsage, setStorageUsage] = useState<StorageInfo>();
  const [isCapturing, setIsCapturing] = useState(false);
  
  // スクリーンショット機能
  const captureAnalysisScreen = useCallback(async (tabId: string, name: string) => {
    setIsCapturing(true);
    try {
      const screenshot = await screenshotCapture.captureElement('#analysis-container', {
        width: 2100,
        height: 1350,
        quality: 0.95
      });
      
      await screenshotStorage.saveScreenshot({
        tabId,
        name,
        description: `${tabId}分析結果`,
        data: screenshot
      });
      
      await refreshScreenshots();
    } finally {
      setIsCapturing(false);
    }
  }, []);
  
  return (
    <div className="space-y-6">
      {/* キャプチャコントロール */}
      <CaptureControls onCapture={captureAnalysisScreen} isCapturing={isCapturing} />
      
      {/* ギャラリー表示 */}
      <ScreenshotGrid screenshots={screenshots} onDelete={handleDelete} />
      
      {/* Excel統合パネル */}
      <ExcelIntegrationPanel screenshots={screenshots} />
      
      {/* ストレージ使用量 */}
      <StorageUsageDisplay usage={storageUsage} />
    </div>
  );
};
```

### 2.6 ExcelExportWizard
**責務**: 専門的なExcelレポート生成のステップバイステップウィザード
```typescript
export const ExcelExportWizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<ExportStep>('configure');
  const [exportConfig, setExportConfig] = useState<ExportConfiguration>();
  const [isExporting, setIsExporting] = useState(false);
  
  // エクスポート設定
  const exportSteps = [
    { id: 'configure', name: 'エクスポート設定', component: ConfigurationStep },
    { id: 'preview', name: 'プレビュー', component: PreviewStep },
    { id: 'generate', name: '生成・ダウンロード', component: GenerationStep }
  ];
  
  // エクスポート実行
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const workbook = await excelProcessor.generateComprehensiveReport({
        companies: exportConfig.selectedCompanies,
        includeVisualAnalytics: exportConfig.includeVisualAnalytics,
        includeDetailedProfiles: exportConfig.includeDetailedProfiles,
        customSheets: exportConfig.customSheets
      });
      
      await workbook.download(`MVV分析レポート_${new Date().toISOString().split('T')[0]}.xlsx`);
    } finally {
      setIsExporting(false);
    }
  }, [exportConfig]);
  
  return (
    <Card className="max-w-4xl mx-auto">
      {/* ステップインジケーター */}
      <StepIndicator steps={exportSteps} currentStep={currentStep} />
      
      {/* 動的ステップコンテンツ */}
      <StepContent
        step={currentStep}
        config={exportConfig}
        onConfigChange={setExportConfig}
        onNext={() => setCurrentStep(getNextStep(currentStep))}
        onPrevious={() => setCurrentStep(getPreviousStep(currentStep))}
        onExport={handleExport}
        isExporting={isExporting}
      />
    </Card>
  );
};
```

### 2.7 AdminPanel
**責務**: システム管理・診断機能（隠しメニュー：Ctrl+Shift+A）
```typescript
export const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('diagnostics');
  const { isAdminMode } = useAdminMode();
  
  if (!isAdminMode) return null;
  
  const adminTabs = [
    { id: 'diagnostics', name: 'データ診断', component: DataDiagnostics },
    { id: 'recovery', name: '回復ツール', component: RecoveryTools },
    { id: 'system', name: 'システム診断', component: SystemDiagnostics }
  ];
  
  return (
    <div className="admin-panel fixed inset-0 bg-black bg-opacity-50 z-50">
      <Card className="max-w-6xl mx-auto mt-8 h-[80vh]">
        <div className="flex h-full">
          {/* サイドメニュー */}
          <AdminSidebar
            tabs={adminTabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
          
          {/* メインコンテンツ */}
          <div className="flex-1 p-6">
            <AdminTabContent tab={activeTab} />
          </div>
        </div>
        
        {/* 閉じるボタン */}
        <AdminCloseButton onClose={() => window.location.reload()} />
      </Card>
    </div>
  );
};
```

## 3. 状態管理

### 3.1 analysisStore (Zustand)
```typescript
interface AnalysisState {
  // データ
  data: AnalysisData | null;
  isLoading: boolean;
  error: string | null;
  
  // キャッシュ
  similarityCache: Map<string, number>;
  lastCalculated: Date | null;
  
  // アクション
  loadAnalysisData: (forceReload?: boolean) => Promise<void>;
  calculateSimilarity: (id1: string, id2: string) => Promise<number>;
  clearCache: () => void;
  setError: (error: string | null) => void;
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  // 初期状態
  data: null,
  isLoading: false,
  error: null,
  similarityCache: new Map(),
  lastCalculated: null,
  
  // データ読み込み
  loadAnalysisData: async (forceReload = false) => {
    const { data, lastCalculated } = get();
    
    // キャッシュ有効性チェック
    if (!forceReload && data && isRecentData(lastCalculated)) {
      return;
    }
    
    set({ isLoading: true, error: null });
    
    try {
      const hybridData = await hybridDataLoader.loadAnalysisData();
      set({ 
        data: hybridData,
        isLoading: false,
        lastCalculated: new Date()
      });
    } catch (error) {
      set({ 
        error: error.message,
        isLoading: false 
      });
    }
  },
  
  // 類似度計算（キャッシュ付き）
  calculateSimilarity: async (id1: string, id2: string) => {
    const { data, similarityCache } = get();
    const cacheKey = id1 < id2 ? `${id1}_${id2}` : `${id2}_${id1}`;
    
    // キャッシュヒット
    if (similarityCache.has(cacheKey)) {
      return similarityCache.get(cacheKey)!;
    }
    
    // 新規計算
    const company1 = data?.companies.find(c => c.id === id1);
    const company2 = data?.companies.find(c => c.id === id2);
    
    if (!company1 || !company2) return 0;
    
    const similarity = calculateEmbeddingSimilarity(
      company1.embeddings!,
      company2.embeddings!
    );
    
    // キャッシュ更新
    const newCache = new Map(similarityCache);
    newCache.set(cacheKey, similarity);
    set({ similarityCache: newCache });
    
    return similarity;
  }
}));
```

### 3.2 パフォーマンス最適化パターン
```typescript
// 1. メモ化による再計算防止
const expensiveCalculation = useMemo(() => {
  return performHeavyCalculation(data);
}, [data, dependencies]);

// 2. コールバックの安定化
const handleInteraction = useCallback((event: InteractionEvent) => {
  performAction(event);
}, [stableDependencies]);

// 3. デバウンスによるAPI呼び出し制限
const debouncedSearch = useMemo(
  () => debounce((query: string) => {
    performSearch(query);
  }, 300),
  []
);

// 4. 仮想化による大量データ表示
const VirtualizedList = ({ items }: { items: LargeDataset }) => {
  return (
    <FixedSizeList
      height={600}
      itemCount={items.length}
      itemSize={80}
      itemData={items}
    >
      {ItemRenderer}
    </FixedSizeList>
  );
};
```

## 4. データフロー

### 4.1 初期化フロー
```
1. App起動
   ↓
2. AuthGuard認証確認
   ↓
3. Dashboard読み込み
   ↓
4. analysisStore.loadAnalysisData()
   ↓
5. hybridDataLoader.loadAnalysisData()
   ↓
6. IndexedDB → companies + embeddings
   ↓
7. UI状態更新 → コンポーネント再レンダリング
```

### 4.2 インタラクションフロー
```
1. ユーザー操作 (企業選択、フィルター変更)
   ↓
2. イベントハンドラ起動
   ↓
3. 必要に応じて計算実行
   ↓
4. キャッシュ確認 → ヒット/ミス判定
   ↓
5. 新規計算 or キャッシュ値取得
   ↓
6. 状態更新 → UI再描画
```

## 5. エラーハンドリング

### 5.1 ErrorBoundary実装
```typescript
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // エラー詳細のログ出力
    console.error('🚨 Component Error:', error, errorInfo);
    
    // 外部監視サービスへの送信（本番環境）
    if (process.env.NODE_ENV === 'production') {
      reportError(error, errorInfo);
    }
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback 
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      );
    }
    
    return this.props.children;
  }
}
```

### 5.2 非同期エラー処理
```typescript
const useAsyncError = () => {
  const [error, setError] = useState<Error | null>(null);
  
  const executeAsync = useCallback(async <T>(
    asyncFn: () => Promise<T>,
    errorMessage?: string
  ): Promise<T | null> => {
    try {
      setError(null);
      return await asyncFn();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(errorMessage || 'Unknown error');
      setError(error);
      return null;
    }
  }, []);
  
  return { error, executeAsync, clearError: () => setError(null) };
};
```

## 6. テスト戦略

### 6.1 単体テスト
```typescript
// コンポーネントテスト例
describe('WordCloudDashboard', () => {
  it('should render word cloud with filtered data', () => {
    const mockData = createMockAnalysisData();
    render(<WordCloudDashboard />, {
      wrapper: ({ children }) => (
        <AnalysisStoreProvider value={mockData}>
          {children}
        </AnalysisStoreProvider>
      )
    });
    
    expect(screen.getByText('MVVキーワードワードクラウド')).toBeInTheDocument();
    expect(screen.getAllByTestId('word-cloud-item')).toHaveLength(10);
  });
});
```

### 6.2 統合テスト
```typescript
// データフロー統合テスト
describe('Analysis Data Flow', () => {
  it('should calculate similarity and update cache', async () => {
    const store = useAnalysisStore.getState();
    await store.loadAnalysisData();
    
    const similarity = await store.calculateSimilarity('company1', 'company2');
    
    expect(similarity).toBeGreaterThanOrEqual(0);
    expect(similarity).toBeLessThanOrEqual(1);
    expect(store.similarityCache.has('company1_company2')).toBe(true);
  });
});
```

---

**最終更新**: 2025-07-13  
**バージョン**: 2.0  
**実装状況**: Phase 3完了（Visual Analytics Gallery with Excel Integration）  
**コンポーネント数**: 48個（リアルタイム分析: 5個、Visual Analytics: 1個、Excel Export: 1個、Admin Panel: 1個）
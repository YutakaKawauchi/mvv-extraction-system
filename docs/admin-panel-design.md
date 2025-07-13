# Admin Panel 設計書

**最終更新**: 2025-07-13  
**Phase**: 3完了（Admin Panel with Hidden Menu Access）

## 概要

Admin Panelは、MVV分析システムの高度な管理・診断機能を提供する隠しメニューシステムです。Ctrl+Shift+Aの特殊キーコンビネーションでアクセスし、データ診断、回復ツール、システム診断の3つの主要機能を通じて、システムの健全性維持と運用支援を行います。

## 設計目標

### ✅ 達成済み目標
1. **隠しメニューアクセス**: Ctrl+Shift+Aによる秘匿性の高いアクセス方法
2. **データ診断機能**: 企業データ整合性、MVV完全性、JSIC分類の自動チェック
3. **回復ツール**: バルク抽出、単体テスト実行、バッチ処理の復旧機能
4. **システム診断**: API健全性、パフォーマンス監視、ストレージ分析
5. **セキュアアクセス**: 管理者権限の確認と操作ログの記録
6. **モーダルUI**: オーバーレイ形式による非侵入的な管理インターフェース
7. **リアルタイム監視**: システム状態のライブ監視とアラート機能

## システムアーキテクチャ

### 全体構成
```
┌─────────────────────────────────────────────────────────────┐
│                      Admin Panel System                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │ Hidden Access   │  │ Data Diagnostics│  │ System Mon  │  │
│  │                 │  │                 │  │             │  │
│  │ • Ctrl+Shift+A  │  │ • Integrity Chk │  │ • API Health│  │
│  │ • Auth Check    │  │ • MVV Complete  │  │ • Perf Mon  │  │
│  │ • Modal UI      │  │ • JSIC Valid    │  │ • Storage   │  │
│  │ • Session Log   │  │ • Data Quality  │  │ • Error Log │  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
│           │                     │                     │     │
│           ▼                     ▼                     ▼     │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │               Recovery Tools Engine                     │  │
│  │ • Bulk Extraction  • Single Test  • Batch Processing   │  │
│  │ • Pipeline Retry   • Data Repair  • Cache Management   │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### アクセスフロー
```
1. 隠しキーコンビネーション (Ctrl+Shift+A)
   ↓
2. 認証確認 (JWT/セッション検証)
   ↓
3. Admin Panel モーダル表示
   ↓
4. 3つのメインタブ表示
   ├─ データ診断
   ├─ 回復ツール  
   └─ システム診断
   ↓
5. 各機能の実行と結果表示
   ↓
6. 操作ログの記録
   ↓
7. パネル閉じる (Escape または Close button)
```

## 技術仕様

### 1. 隠しアクセスシステム

#### 1.1 キーボードショートカット
```typescript
interface AdminAccessConfig {
  keyCombo: 'ctrl+shift+a';
  timeout: 5000;           // 5秒以内に入力
  sessionRequired: true;   // 認証セッション必須
  logAccess: true;         // アクセスログ記録
}

class HiddenMenuAccess {
  private keySequence: string[] = [];
  private timeoutId: NodeJS.Timeout | null = null;
  private readonly TARGET_SEQUENCE = ['Control', 'Shift', 'KeyA'];

  constructor() {
    this.initializeKeyboardListener();
  }

  private initializeKeyboardListener(): void {
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('keyup', this.handleKeyUp.bind(this));
  }

  private handleKeyDown(event: KeyboardEvent): void {
    // 管理者パネルが既に開いている場合は無視
    if (this.isAdminPanelOpen()) return;
    
    // 特定のキーコンビネーションをチェック
    if (event.ctrlKey && event.shiftKey && event.code === 'KeyA') {
      event.preventDefault();
      this.triggerAdminPanel();
      return;
    }
  }

  private async triggerAdminPanel(): Promise<void> {
    try {
      // 認証状態確認
      const isAuthenticated = await this.checkAuthStatus();
      if (!isAuthenticated) {
        console.warn('Admin panel access denied: Authentication required');
        this.showAuthRequiredMessage();
        return;
      }

      // アクセスログ記録
      await this.logAdminAccess();

      // Admin Panel表示
      this.showAdminPanel();
    } catch (error) {
      console.error('Admin panel access error:', error);
    }
  }

  private async checkAuthStatus(): Promise<boolean> {
    const authStore = useAuthStore.getState();
    if (!authStore.isAuthenticated) return false;

    // JWT検証
    try {
      const response = await fetch('/.netlify/functions/auth-validate-v2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async logAdminAccess(): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action: 'admin_panel_access',
      user: useAuthStore.getState().user?.username || 'unknown',
      userAgent: navigator.userAgent,
      sessionId: this.generateSessionId()
    };

    // ローカルストレージに記録（開発環境）
    if (import.meta.env.DEV) {
      const logs = JSON.parse(localStorage.getItem('admin_logs') || '[]');
      logs.push(logEntry);
      localStorage.setItem('admin_logs', JSON.stringify(logs.slice(-100))); // 最大100件
    }

    console.log('Admin panel accessed:', logEntry);
  }
}
```

#### 1.2 Admin Panel UI
```typescript
export const AdminPanel: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('diagnostics');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const hiddenAccess = new HiddenMenuAccess();
    
    // Admin Panel表示イベントリスナー
    const handleAdminPanelShow = () => setIsVisible(true);
    document.addEventListener('show-admin-panel', handleAdminPanelShow);

    // ESCキーで閉じる
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isVisible) {
        setIsVisible(false);
      }
    };
    document.addEventListener('keydown', handleEscKey);

    return () => {
      document.removeEventListener('show-admin-panel', handleAdminPanelShow);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isVisible]);

  if (!isVisible) return null;

  const adminTabs: AdminTabConfig[] = [
    {
      id: 'diagnostics',
      name: 'データ診断',
      icon: Database,
      component: DataDiagnostics,
      description: '企業データの整合性とMVV完全性をチェック'
    },
    {
      id: 'recovery',
      name: '回復ツール',
      icon: RefreshCw,
      component: RecoveryTools,
      description: 'バルク抽出と失敗データの回復処理'
    },
    {
      id: 'system',
      name: 'システム診断',
      icon: Activity,
      component: SystemDiagnostics,
      description: 'API健全性とパフォーマンス監視'
    }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <Card className="w-full max-w-6xl h-[80vh] bg-white shadow-2xl">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-red-600" />
            <h2 className="text-xl font-bold">システム管理パネル</h2>
            <Badge variant="outline" className="text-xs">
              Hidden Access
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex h-full">
          {/* サイドメニュー */}
          <div className="w-64 border-r bg-gray-50 p-4">
            <nav className="space-y-2">
              {adminTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  <div>
                    <div className="font-medium">{tab.name}</div>
                    <div className="text-xs text-gray-500">{tab.description}</div>
                  </div>
                </button>
              ))}
            </nav>

            {/* システム情報 */}
            <div className="mt-6 p-3 bg-white rounded-lg border">
              <h4 className="font-medium text-sm mb-2">システム情報</h4>
              <div className="space-y-1 text-xs text-gray-600">
                <div>Version: 3.0.0 (Phase 3)</div>
                <div>Build: {import.meta.env.VITE_BUILD_ID || 'dev'}</div>
                <div>User: {useAuthStore(state => state.user?.username)}</div>
                <div>Session: {new Date().toLocaleTimeString('ja-JP')}</div>
              </div>
            </div>
          </div>

          {/* メインコンテンツ */}
          <div className="flex-1 p-6 overflow-auto">
            <ErrorBoundary fallback={<AdminErrorFallback />}>
              <AdminTabContent 
                tab={activeTab}
                isLoading={isLoading}
                onLoadingChange={setIsLoading}
              />
            </ErrorBoundary>
          </div>
        </div>
      </Card>
    </div>
  );
};
```

### 2. データ診断システム

#### 2.1 整合性チェック
```typescript
class DataIntegrityChecker {
  async performComprehensiveCheck(): Promise<DiagnosticResult> {
    const results: DiagnosticResult = {
      timestamp: new Date(),
      checks: [],
      summary: { passed: 0, failed: 0, warnings: 0 },
      recommendations: []
    };

    // 企業データ整合性チェック
    const companyCheck = await this.checkCompanyDataIntegrity();
    results.checks.push(companyCheck);

    // MVVデータ完全性チェック
    const mvvCheck = await this.checkMVVDataCompleteness();
    results.checks.push(mvvCheck);

    // JSIC分類検証
    const jsicCheck = await this.checkJSICClassificationValidity();
    results.checks.push(jsicCheck);

    // Visual Analytics整合性
    const visualCheck = await this.checkVisualAnalyticsIntegrity();
    results.checks.push(visualCheck);

    // データ品質評価
    const qualityCheck = await this.checkDataQuality();
    results.checks.push(qualityCheck);

    // サマリー計算
    results.summary = this.calculateSummary(results.checks);
    results.recommendations = this.generateRecommendations(results.checks);

    return results;
  }

  private async checkCompanyDataIntegrity(): Promise<CheckResult> {
    const companies = await companyStore.getAllCompanies();
    const issues: Issue[] = [];
    let healthyCount = 0;

    for (const company of companies) {
      const companyIssues: Issue[] = [];

      // 必須フィールドチェック
      if (!company.name?.trim()) {
        companyIssues.push({
          type: 'error',
          field: 'name',
          message: '企業名が空です',
          suggestion: '企業名を入力してください'
        });
      }

      if (!company.website?.trim()) {
        companyIssues.push({
          type: 'warning',
          field: 'website',
          message: 'ウェブサイトURLが未設定です',
          suggestion: '公式ウェブサイトURLを追加してください'
        });
      }

      // URL形式チェック
      if (company.website && !this.isValidURL(company.website)) {
        companyIssues.push({
          type: 'error',
          field: 'website',
          message: '無効なURL形式です',
          suggestion: 'http://またはhttps://で始まる有効なURLを入力してください'
        });
      }

      // カテゴリチェック
      if (!company.category || company.category === 'その他') {
        companyIssues.push({
          type: 'warning',
          field: 'category',
          message: '業界カテゴリが未分類です',
          suggestion: '適切な業界カテゴリを設定してください'
        });
      }

      if (companyIssues.length === 0) {
        healthyCount++;
      } else {
        issues.push(...companyIssues.map(issue => ({
          ...issue,
          companyId: company.id,
          companyName: company.name
        })));
      }
    }

    return {
      name: '企業データ整合性',
      status: issues.filter(i => i.type === 'error').length === 0 ? 'passed' : 'failed',
      totalItems: companies.length,
      healthyItems: healthyCount,
      issues,
      metrics: {
        completenessRate: (healthyCount / companies.length) * 100,
        errorRate: (issues.filter(i => i.type === 'error').length / companies.length) * 100
      }
    };
  }

  private async checkMVVDataCompleteness(): Promise<CheckResult> {
    const companies = await companyStore.getAllCompanies();
    const mvvData = await mvvStore.getAllMVVResults();
    const issues: Issue[] = [];
    let completeCount = 0;

    for (const company of companies) {
      const mvv = mvvData.find(m => m.companyId === company.id);
      
      if (!mvv) {
        issues.push({
          type: 'warning',
          companyId: company.id,
          companyName: company.name,
          field: 'mvv',
          message: 'MVVデータが未抽出です',
          suggestion: 'MVV抽出を実行してください'
        });
        continue;
      }

      const mvvIssues: Issue[] = [];

      // Mission チェック
      if (!mvv.mission?.trim()) {
        mvvIssues.push({
          type: 'warning',
          field: 'mission',
          message: 'Missionが未設定です',
          suggestion: 'Mission（使命）を抽出または手動入力してください'
        });
      }

      // Vision チェック
      if (!mvv.vision?.trim()) {
        mvvIssues.push({
          type: 'warning',
          field: 'vision',
          message: 'Visionが未設定です',
          suggestion: 'Vision（理念）を抽出または手動入力してください'
        });
      }

      // Values チェック
      if (!mvv.values || mvv.values.length === 0) {
        mvvIssues.push({
          type: 'warning',
          field: 'values',
          message: 'Valuesが未設定です',
          suggestion: 'Values（価値観）を抽出または手動入力してください'
        });
      }

      // 信頼度チェック
      if (mvv.confidence_scores) {
        ['mission', 'vision', 'values'].forEach(key => {
          const score = mvv.confidence_scores[key];
          if (score !== undefined && score < 0.7) {
            mvvIssues.push({
              type: 'warning',
              field: `${key}_confidence`,
              message: `${key}の信頼度が低いです (${(score * 100).toFixed(1)}%)`,
              suggestion: '手動確認または再抽出を推奨します'
            });
          }
        });
      }

      if (mvvIssues.length === 0) {
        completeCount++;
      } else {
        issues.push(...mvvIssues.map(issue => ({
          ...issue,
          companyId: company.id,
          companyName: company.name
        })));
      }
    }

    return {
      name: 'MVVデータ完全性',
      status: completeCount === companies.length ? 'passed' : 'warning',
      totalItems: companies.length,
      healthyItems: completeCount,
      issues,
      metrics: {
        completenessRate: (completeCount / companies.length) * 100,
        extractionRate: (mvvData.length / companies.length) * 100
      }
    };
  }

  private async checkVisualAnalyticsIntegrity(): Promise<CheckResult> {
    const screenshots = await screenshotStorage.getAllScreenshots();
    const issues: Issue[] = [];
    let validCount = 0;

    // ストレージ整合性チェック
    for (const screenshot of screenshots) {
      try {
        const imageData = await screenshotStorage.getScreenshotData(screenshot.id);
        if (!imageData) {
          issues.push({
            type: 'error',
            field: 'imageData',
            message: `画像データが見つかりません (${screenshot.id})`,
            suggestion: 'スクリーンショットを再キャプチャしてください'
          });
        } else {
          validCount++;
        }
      } catch (error) {
        issues.push({
          type: 'error',
          field: 'storage',
          message: `ストレージアクセスエラー (${screenshot.id})`,
          suggestion: 'IndexedDBの状態を確認してください'
        });
      }
    }

    // TabID妥当性チェック
    const validTabIds = ['finder', 'trends', 'wordcloud', 'positioning', 'uniqueness', 'quality'];
    const invalidTabIds = screenshots.filter(s => !validTabIds.includes(s.tabId));
    
    if (invalidTabIds.length > 0) {
      issues.push({
        type: 'warning',
        field: 'tabId',
        message: `無効なTabIDが${invalidTabIds.length}件あります`,
        suggestion: '該当データの削除または修正を検討してください'
      });
    }

    return {
      name: 'Visual Analytics整合性',
      status: issues.filter(i => i.type === 'error').length === 0 ? 'passed' : 'failed',
      totalItems: screenshots.length,
      healthyItems: validCount,
      issues,
      metrics: {
        validDataRate: screenshots.length > 0 ? (validCount / screenshots.length) * 100 : 100,
        storageUsage: await this.calculateStorageUsage()
      }
    };
  }
}
```

#### 2.2 データ診断UI
```typescript
const DataDiagnostics: React.FC = () => {
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<string | null>(null);

  const runDiagnostics = useCallback(async () => {
    setIsRunning(true);
    try {
      const checker = new DataIntegrityChecker();
      const result = await checker.performComprehensiveCheck();
      setDiagnosticResult(result);
    } catch (error) {
      console.error('Diagnostic error:', error);
    } finally {
      setIsRunning(false);
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* 診断実行ボタン */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">データ診断</h3>
        <Button
          onClick={runDiagnostics}
          disabled={isRunning}
          className="flex items-center gap-2"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              診断実行中...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              診断開始
            </>
          )}
        </Button>
      </div>

      {/* 診断結果サマリー */}
      {diagnosticResult && (
        <>
          <Card className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {diagnosticResult.summary.passed}
                </div>
                <div className="text-sm text-green-700">合格</div>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {diagnosticResult.summary.warnings}
                </div>
                <div className="text-sm text-yellow-700">警告</div>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {diagnosticResult.summary.failed}
                </div>
                <div className="text-sm text-red-700">エラー</div>
              </div>
            </div>
          </Card>

          {/* 詳細チェック結果 */}
          <div className="space-y-4">
            {diagnosticResult.checks.map((check, index) => (
              <DiagnosticCheckCard
                key={index}
                check={check}
                isSelected={selectedCheck === check.name}
                onSelect={() => setSelectedCheck(
                  selectedCheck === check.name ? null : check.name
                )}
              />
            ))}
          </div>

          {/* 推奨事項 */}
          {diagnosticResult.recommendations.length > 0 && (
            <Card className="p-4">
              <h4 className="font-medium mb-3">推奨事項</h4>
              <ul className="space-y-2">
                {diagnosticResult.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />
                    <span className="text-sm">{rec}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
```

### 3. 回復ツールシステム

#### 3.1 バルク操作
```typescript
class RecoveryToolsEngine {
  async executeBlkExtraction(
    companyIds: string[],
    provider: 'openai' | 'perplexity',
    options: BulkExtractionOptions
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      total: companyIds.length,
      successful: 0,
      failed: 0,
      results: [],
      startTime: new Date(),
      endTime: null
    };

    const batchSize = options.batchSize || (import.meta.env.PROD ? 2 : 5);
    const delay = options.delay || (import.meta.env.PROD ? 2000 : 1000);

    // バッチ処理
    for (let i = 0; i < companyIds.length; i += batchSize) {
      const batch = companyIds.slice(i, i + batchSize);
      const batchPromises = batch.map(async (companyId, index) => {
        try {
          // 段階的遅延
          if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, delay * index));
          }

          const company = await companyStore.getCompany(companyId);
          if (!company) {
            throw new Error('企業データが見つかりません');
          }

          // MVV抽出実行
          const response = await this.callExtractionAPI(company, provider);
          if (response.success) {
            await mvvStore.updateMVVResult(companyId, response.data);
            result.successful++;
            result.results.push({
              companyId,
              companyName: company.name,
              status: 'success',
              data: response.data
            });
          } else {
            throw new Error(response.error || '抽出に失敗しました');
          }
        } catch (error) {
          result.failed++;
          result.results.push({
            companyId,
            companyName: company?.name || 'Unknown',
            status: 'failed',
            error: error.message
          });
        }
      });

      await Promise.allSettled(batchPromises);

      // バッチ間遅延
      if (i + batchSize < companyIds.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    result.endTime = new Date();
    return result;
  }

  async repairDataInconsistencies(diagnosticResult: DiagnosticResult): Promise<RepairResult> {
    const repairs: RepairOperation[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const check of diagnosticResult.checks) {
      for (const issue of check.issues) {
        if (issue.type === 'error' && issue.companyId) {
          try {
            const repair = await this.attemptAutoRepair(issue);
            if (repair.success) {
              successCount++;
              repairs.push({
                issueId: `${issue.companyId}_${issue.field}`,
                action: repair.action,
                status: 'success',
                details: repair.details
              });
            } else {
              failureCount++;
              repairs.push({
                issueId: `${issue.companyId}_${issue.field}`,
                action: 'attempted',
                status: 'failed',
                details: repair.error
              });
            }
          } catch (error) {
            failureCount++;
            repairs.push({
              issueId: `${issue.companyId}_${issue.field}`,
              action: 'error',
              status: 'failed',
              details: error.message
            });
          }
        }
      }
    }

    return {
      totalIssues: diagnosticResult.checks.reduce((sum, check) => sum + check.issues.length, 0),
      repairedCount: successCount,
      failedCount: failureCount,
      repairs,
      timestamp: new Date()
    };
  }

  private async attemptAutoRepair(issue: Issue): Promise<AutoRepairResult> {
    switch (issue.field) {
      case 'website':
        if (issue.message.includes('無効なURL')) {
          // URL修正の試行
          const company = await companyStore.getCompany(issue.companyId);
          if (company?.website) {
            const correctedUrl = this.correctURL(company.website);
            if (correctedUrl !== company.website) {
              await companyStore.updateCompany(issue.companyId, { website: correctedUrl });
              return {
                success: true,
                action: 'url_correction',
                details: `URL修正: ${company.website} → ${correctedUrl}`
              };
            }
          }
        }
        break;

      case 'category':
        if (issue.message.includes('未分類')) {
          // 自動カテゴリ推定
          const company = await companyStore.getCompany(issue.companyId);
          if (company?.name) {
            const estimatedCategory = await this.estimateCategory(company.name, company.website);
            if (estimatedCategory && estimatedCategory !== 'その他') {
              await companyStore.updateCompany(issue.companyId, { category: estimatedCategory });
              return {
                success: true,
                action: 'category_estimation',
                details: `カテゴリ推定: ${estimatedCategory}`
              };
            }
          }
        }
        break;
    }

    return {
      success: false,
      error: 'Automatic repair not available for this issue type'
    };
  }
}
```

#### 3.2 回復ツールUI
```typescript
const RecoveryTools: React.FC = () => {
  const [activeOperation, setActiveOperation] = useState<string | null>(null);
  const [operationResult, setOperationResult] = useState<OperationResult | null>(null);

  const operations: RecoveryOperation[] = [
    {
      id: 'bulk-mvv-extraction',
      name: 'バルクMVV抽出',
      description: '選択した企業のMVVを一括抽出します',
      icon: Download,
      component: BulkExtractionTool,
      risk: 'medium'
    },
    {
      id: 'data-repair',
      name: 'データ修復',
      description: '診断で発見された問題を自動修復します',
      icon: Wrench,
      component: DataRepairTool,
      risk: 'low'
    },
    {
      id: 'pipeline-retry',
      name: 'パイプライン再実行',
      description: '失敗したパイプライン処理を再実行します',
      icon: RefreshCw,
      component: PipelineRetryTool,
      risk: 'medium'
    },
    {
      id: 'cache-management',
      name: 'キャッシュ管理',
      description: 'システムキャッシュのクリアと最適化を行います',
      icon: Database,
      component: CacheManagementTool,
      risk: 'low'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">回復ツール</h3>
        <Alert className="mb-4">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            これらのツールはシステムデータに影響を与える可能性があります。実行前に必ずバックアップを作成してください。
          </AlertDescription>
        </Alert>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {operations.map((operation) => (
          <Card
            key={operation.id}
            className={`p-4 cursor-pointer transition-colors ${
              activeOperation === operation.id
                ? 'border-blue-500 bg-blue-50'
                : 'hover:bg-gray-50'
            }`}
            onClick={() => setActiveOperation(operation.id)}
          >
            <div className="flex items-start gap-3">
              <operation.icon className="w-6 h-6 text-blue-600 mt-1" />
              <div className="flex-1">
                <h4 className="font-medium">{operation.name}</h4>
                <p className="text-sm text-gray-600 mt-1">{operation.description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={operation.risk === 'high' ? 'destructive' : operation.risk === 'medium' ? 'secondary' : 'outline'}>
                    {operation.risk === 'high' ? '高リスク' : operation.risk === 'medium' ? '中リスク' : '低リスク'}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* 選択された操作の詳細 */}
      {activeOperation && (
        <Card className="p-6">
          <RecoveryOperationDetail
            operationId={activeOperation}
            onResult={setOperationResult}
            onClose={() => setActiveOperation(null)}
          />
        </Card>
      )}

      {/* 操作結果 */}
      {operationResult && (
        <OperationResultDisplay
          result={operationResult}
          onClose={() => setOperationResult(null)}
        />
      )}
    </div>
  );
};
```

### 4. システム診断

#### 4.1 API健全性監視
```typescript
class SystemHealthMonitor {
  async performHealthCheck(): Promise<SystemHealthResult> {
    const healthChecks = await Promise.allSettled([
      this.checkAPIEndpoints(),
      this.checkDatabaseConnectivity(),
      this.checkExternalServices(),
      this.checkPerformanceMetrics(),
      this.checkStorageStatus()
    ]);

    const results = healthChecks.map((check, index) => ({
      name: ['API Endpoints', 'Database', 'External Services', 'Performance', 'Storage'][index],
      status: check.status === 'fulfilled' ? check.value.status : 'failed',
      details: check.status === 'fulfilled' ? check.value.details : check.reason?.message,
      metrics: check.status === 'fulfilled' ? check.value.metrics : {}
    }));

    return {
      overallStatus: results.every(r => r.status === 'healthy') ? 'healthy' : 'unhealthy',
      timestamp: new Date(),
      checks: results,
      summary: this.generateHealthSummary(results)
    };
  }

  private async checkAPIEndpoints(): Promise<HealthCheckResult> {
    const endpoints = [
      { name: 'Health Check', url: '/.netlify/functions/health' },
      { name: 'Auth Validate', url: '/.netlify/functions/auth-validate-v2' },
      { name: 'MVV Extract', url: '/.netlify/functions/extract-mvv' },
      { name: 'Company Info', url: '/.netlify/functions/extract-company-info' }
    ];

    const results = await Promise.allSettled(
      endpoints.map(async (endpoint) => {
        const start = performance.now();
        try {
          const response = await fetch(endpoint.url, {
            method: endpoint.name === 'Health Check' ? 'GET' : 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(endpoint.name !== 'Health Check' && {
                'X-API-Key': 'health-check-key'
              })
            },
            ...(endpoint.name !== 'Health Check' && {
              body: JSON.stringify({ test: true })
            })
          });

          const responseTime = performance.now() - start;
          return {
            name: endpoint.name,
            status: response.status < 500 ? 'healthy' : 'unhealthy',
            responseTime,
            statusCode: response.status
          };
        } catch (error) {
          return {
            name: endpoint.name,
            status: 'failed',
            responseTime: performance.now() - start,
            error: error.message
          };
        }
      })
    );

    const endpointResults = results.map(r => r.status === 'fulfilled' ? r.value : r.reason);
    const healthyCount = endpointResults.filter(r => r.status === 'healthy').length;

    return {
      status: healthyCount === endpoints.length ? 'healthy' : 'unhealthy',
      details: `${healthyCount}/${endpoints.length} endpoints healthy`,
      metrics: {
        healthyEndpoints: healthyCount,
        totalEndpoints: endpoints.length,
        averageResponseTime: endpointResults.reduce((sum, r) => sum + (r.responseTime || 0), 0) / endpoints.length,
        endpointDetails: endpointResults
      }
    };
  }

  private async checkPerformanceMetrics(): Promise<HealthCheckResult> {
    const metrics = {
      memoryUsage: this.getMemoryUsage(),
      indexedDBSize: await this.getIndexedDBSize(),
      cacheHitRate: await this.getCacheHitRate(),
      averageAnalysisTime: await this.getAverageAnalysisTime()
    };

    const isHealthy = (
      metrics.memoryUsage.percentage < 80 &&
      metrics.indexedDBSize < 100 * 1024 * 1024 && // 100MB
      metrics.cacheHitRate > 50
    );

    return {
      status: isHealthy ? 'healthy' : 'warning',
      details: `Memory: ${metrics.memoryUsage.percentage.toFixed(1)}%, Cache: ${metrics.cacheHitRate.toFixed(1)}%`,
      metrics
    };
  }

  private getMemoryUsage(): MemoryUsage {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      };
    }
    return { used: 0, total: 0, limit: 0, percentage: 0 };
  }
}
```

#### 4.2 システム診断UI
```typescript
const SystemDiagnostics: React.FC = () => {
  const [healthResult, setHealthResult] = useState<SystemHealthResult | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitoringInterval, setMonitoringInterval] = useState<NodeJS.Timeout | null>(null);

  const runHealthCheck = useCallback(async () => {
    const monitor = new SystemHealthMonitor();
    const result = await monitor.performHealthCheck();
    setHealthResult(result);
  }, []);

  const startMonitoring = useCallback(() => {
    if (monitoringInterval) return;
    
    setIsMonitoring(true);
    runHealthCheck(); // 即座に実行
    
    const interval = setInterval(runHealthCheck, 30000); // 30秒間隔
    setMonitoringInterval(interval);
  }, [runHealthCheck, monitoringInterval]);

  const stopMonitoring = useCallback(() => {
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
      setMonitoringInterval(null);
    }
    setIsMonitoring(false);
  }, [monitoringInterval]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">システム診断</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={runHealthCheck}
            disabled={isMonitoring}
          >
            手動チェック
          </Button>
          {isMonitoring ? (
            <Button
              variant="destructive"
              onClick={stopMonitoring}
              className="flex items-center gap-2"
            >
              <Square className="w-4 h-4" />
              監視停止
            </Button>
          ) : (
            <Button
              onClick={startMonitoring}
              className="flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              監視開始
            </Button>
          )}
        </div>
      </div>

      {/* システム状態概要 */}
      {healthResult && (
        <>
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-4 h-4 rounded-full ${
                  healthResult.overallStatus === 'healthy'
                    ? 'bg-green-500'
                    : 'bg-red-500'
                }`}
              />
              <h4 className="font-medium">
                システム状態: {healthResult.overallStatus === 'healthy' ? '正常' : '異常'}
              </h4>
              {isMonitoring && (
                <Badge variant="outline" className="ml-auto">
                  <Activity className="w-3 h-3 mr-1" />
                  監視中
                </Badge>
              )}
            </div>
            <div className="text-sm text-gray-600">
              最終更新: {healthResult.timestamp.toLocaleString('ja-JP')}
            </div>
          </Card>

          {/* 詳細チェック結果 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {healthResult.checks.map((check, index) => (
              <HealthCheckCard key={index} check={check} />
            ))}
          </div>

          {/* パフォーマンスメトリクス */}
          <PerformanceMetricsDisplay metrics={healthResult.summary.metrics} />
        </>
      )}
    </div>
  );
};
```

## セキュリティ

### アクセス制御
- JWT認証による管理者権限確認
- 操作ログの自動記録
- セッション有効期限チェック
- 悪意のあるアクセスの検出

### 監査ログ
```typescript
interface AdminAuditLog {
  timestamp: string;
  userId: string;
  action: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  sessionId: string;
}
```

## 運用・保守

### 監視指標
- 管理者パネルアクセス頻度
- 診断実行回数と結果
- 回復操作の成功率
- システム健全性トレンド

### アラート機能
- 重大なデータ整合性エラー
- システム健全性の異常
- 大量のエラー発生
- パフォーマンス劣化

## 結論

Admin Panelは、MVV分析システムの信頼性と運用効率を支える重要なインフラストラクチャです。

### ✅ 技術的成果
- **隠しアクセス**: セキュアな管理者専用インターフェース
- **包括的診断**: データ整合性からシステム健全性まで全方位監視
- **自動回復**: 問題の自動検出と修復機能
- **リアルタイム監視**: 継続的なシステム状態監視

### 🚀 運用価値
- **予防保守**: 問題の早期発見と自動修復
- **運用効率**: 手動作業の自動化と効率化
- **システム信頼性**: 継続的な健全性監視による安定稼働
- **トラブルシューティング**: 迅速な問題解決とデータ回復

Phase 3完了により、Admin Panelはエンタープライズレベルの運用管理機能を提供し、Phase 4での更なる機能拡張の基盤を確立しました。

---

**最終更新**: 2025-07-13  
**Phase**: 3完了 (Admin Panel with Comprehensive Management Features)  
**次期計画**: Phase 4 (Enhanced monitoring and enterprise operations)
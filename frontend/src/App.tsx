import { useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { ErrorBoundary, NotificationToast, ScrollToTopButton } from './components/common';
import { AuthGuard } from './components/auth';
import { AdminPanel } from './components/admin';
import { ProductionTester } from './components/debug/ProductionTester';
import { useIndexedDB } from './hooks/useIndexedDB';
import { useNotification } from './hooks/useNotification';
import { useAdminMode } from './hooks/useAdminMode';
import { useDebugMode } from './hooks/useDebugMode';
import { useCompanyStore } from './stores/companyStore';
import './services/manualMigration'; // Load debug tools

function App() {
  const { isInitialized, error: dbError } = useIndexedDB();
  const { notifications, removeNotification } = useNotification();
  const { isAdminMode, closeAdminMode } = useAdminMode();
  const { isDebugVisible, closeDebug } = useDebugMode();
  const { loadCompanies } = useCompanyStore();

  useEffect(() => {
    if (isInitialized) {
      // シンプルに企業データをロードするだけ
      loadCompanies().catch(error => {
        console.error('Failed to load companies:', error);
      });
    }
  }, [isInitialized, loadCompanies]);

  if (dbError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
          <div className="text-center">
            <div className="text-red-600 text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              データベースエラー
            </h1>
            <p className="text-gray-600 mb-4">
              IndexedDBの初期化に失敗しました。ブラウザの設定を確認してください。
            </p>
            <div className="text-left text-sm text-gray-500 bg-gray-50 p-3 rounded">
              <p className="font-medium mb-1">解決方法:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>ブラウザのプライベートモードを無効にしてください</li>
                <li>ブラウザのローカルストレージが有効か確認してください</li>
                <li>ページを再読み込みしてください</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h1 className="text-xl font-medium text-gray-900 mb-2">
            システムを初期化中...
          </h1>
          <p className="text-gray-600">
            データベースの準備をしています
          </p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <AuthGuard>
        <div className="App">
          <Dashboard />
          
          {/* Admin Panel (Hidden Menu) */}
          <AdminPanel
            isOpen={isAdminMode}
            onClose={closeAdminMode}
          />
          
          {/* Production Tester (Debug Mode) */}
          <ProductionTester
            isVisible={isDebugVisible}
            onClose={closeDebug}
          />
          
          {/* Global Notifications */}
          <div className="fixed top-4 right-4 z-50 space-y-2">
            {notifications.map((notification) => (
              <NotificationToast
                key={notification.id}
                type={notification.type}
                title={notification.title}
                message={notification.message}
                duration={notification.duration}
                onClose={() => removeNotification(notification.id)}
              />
            ))}
          </div>
          
          {/* Scroll to Top Button */}
          <ScrollToTopButton />
        </div>
      </AuthGuard>
    </ErrorBoundary>
  );
}

export default App;
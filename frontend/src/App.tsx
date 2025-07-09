import { useEffect, useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { ErrorBoundary, NotificationToast, ScrollToTopButton } from './components/common';
import { AuthGuard } from './components/auth';
import { useIndexedDB } from './hooks/useIndexedDB';
import { useNotification } from './hooks/useNotification';
import { useCompanyStore } from './stores/companyStore';
import { migrateCompanyStatuses, isMigrationNeeded } from './services/dataMigration';
import './services/manualMigration'; // Load debug tools

function App() {
  const { isInitialized, error: dbError } = useIndexedDB();
  const { notifications, removeNotification } = useNotification();
  const { loadCompanies } = useCompanyStore();
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationCompleted, setMigrationCompleted] = useState(false);

  useEffect(() => {
    if (isInitialized && !migrationCompleted) {
      handleDataMigration();
    }
  }, [isInitialized, migrationCompleted]);

  const handleDataMigration = async () => {
    try {
      setIsMigrating(true);
      
      // Check if migration is needed
      const needsMigration = await isMigrationNeeded();
      
      if (needsMigration) {
        console.log('Starting data migration...');
        const result = await migrateCompanyStatuses();
        
        if (result.success) {
          console.log(`Migration completed successfully. Migrated ${result.migratedCount} companies.`);
        } else {
          console.warn('Migration completed with errors:', result.errors);
        }
      } else {
        console.log('No migration needed');
      }
      
      setMigrationCompleted(true);
      
      // Load companies after migration
      await loadCompanies();
      
    } catch (error) {
      console.error('Migration failed:', error);
      setMigrationCompleted(true); // Continue even if migration fails
      await loadCompanies(); // Still try to load companies
    } finally {
      setIsMigrating(false);
    }
  };

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
            <p className="text-sm text-gray-500">
              エラー: {dbError}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              再読み込み
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized || isMigrating) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h1 className="text-xl font-medium text-gray-900 mb-2">
            {!isInitialized ? 'システムを初期化中...' : 'データ移行中...'}
          </h1>
          <p className="text-gray-600">
            {!isInitialized ? 'データベースの準備をしています' : '既存データを新しい形式に移行しています'}
          </p>
          {isMigrating && (
            <p className="text-sm text-gray-500 mt-2">
              企業ステータスを Phase 1/Phase 2 システムに移行中...
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <AuthGuard>
        <div className="App">
          <Dashboard />
          
          {/* Notifications */}
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

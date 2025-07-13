/**
 * IndexedDB Screenshot Storage Service
 * スクリーンショットデータの永続化と高効率管理
 */

import type { AnalysisScreenshot } from './screenshotCapture';

interface ScreenshotMetadata {
  id: string;
  timestamp: number;
  name: string;
  description: string;
  tabId: string;
  width: number;
  height: number;
  size: number; // データサイズ（bytes）
}

interface ScreenshotData {
  id: string;
  dataUrl: string;
  metadata: ScreenshotMetadata;
}

type StorageEventListener = (screenshots: AnalysisScreenshot[]) => void;

export class ScreenshotStorageService {
  private static readonly DB_NAME = 'MVVScreenshotDB';
  private static readonly DB_VERSION = 2; // セッション管理削除のためバージョンアップ
  private static readonly STORE_NAME = 'screenshots';
  private static readonly METADATA_STORE = 'metadata';
  private static readonly MAX_SCREENSHOTS = 50; // 最大保存数
  
  private static db: IDBDatabase | null = null;
  private static listeners: Set<StorageEventListener> = new Set();

  /**
   * データベース初期化
   */
  static async initialize(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('📦 Screenshot IndexedDB initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // スクリーンショットデータストア
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const screenshotStore = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
          screenshotStore.createIndex('timestamp', 'metadata.timestamp', { unique: false });
          screenshotStore.createIndex('tabId', 'metadata.tabId', { unique: false });
        }

        // メタデータストア
        if (!db.objectStoreNames.contains(this.METADATA_STORE)) {
          db.createObjectStore(this.METADATA_STORE, { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * スクリーンショットを保存
   */
  static async saveScreenshot(screenshot: AnalysisScreenshot): Promise<void> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const metadata: ScreenshotMetadata = {
      id: screenshot.id,
      timestamp: screenshot.timestamp,
      name: screenshot.name,
      description: screenshot.description,
      tabId: screenshot.tabId,
      width: screenshot.width,
      height: screenshot.height,
      size: screenshot.dataUrl.length * 0.75 // Base64サイズ概算
    };

    const data: ScreenshotData = {
      id: screenshot.id,
      dataUrl: screenshot.dataUrl,
      metadata
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME, this.METADATA_STORE], 'readwrite');
      
      transaction.oncomplete = () => {
        console.log(`💾 Screenshot saved: ${screenshot.name}`);
        this.notifyListeners();
        resolve();
      };
      
      transaction.onerror = () => {
        console.error('Failed to save screenshot:', transaction.error);
        reject(transaction.error);
      };

      // データ保存
      const screenshotStore = transaction.objectStore(this.STORE_NAME);
      screenshotStore.put(data);

      // メタデータ保存
      const metadataStore = transaction.objectStore(this.METADATA_STORE);
      metadataStore.put(metadata);
    });
  }

  /**
   * 複数のスクリーンショットを一括保存
   */
  static async saveScreenshots(screenshots: AnalysisScreenshot[]): Promise<void> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    // 古いデータをクリーンアップ
    await this.cleanupOldScreenshots();

    // 一括保存
    const promises = screenshots.map(screenshot => this.saveScreenshot(screenshot));
    await Promise.all(promises);

    console.log(`📦 Bulk saved ${screenshots.length} screenshots to IndexedDB`);
  }


  /**
   * すべてのスクリーンショットを取得（時系列順）
   */
  static async getScreenshots(): Promise<AnalysisScreenshot[]> {
    await this.initialize();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result as ScreenshotData[];
        const screenshots = results
          .sort((a, b) => b.metadata.timestamp - a.metadata.timestamp)
          .map(data => ({
            id: data.id,
            name: data.metadata.name,
            description: data.metadata.description,
            dataUrl: data.dataUrl,
            width: data.metadata.width,
            height: data.metadata.height,
            timestamp: data.metadata.timestamp,
            tabId: data.metadata.tabId
          }));

        resolve(screenshots);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * スクリーンショットを削除
   */
  static async deleteScreenshot(id: string): Promise<void> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME, this.METADATA_STORE], 'readwrite');
      
      transaction.oncomplete = () => {
        console.log(`🗑️ Screenshot deleted: ${id}`);
        this.notifyListeners();
        resolve();
      };
      
      transaction.onerror = () => {
        reject(transaction.error);
      };

      const screenshotStore = transaction.objectStore(this.STORE_NAME);
      screenshotStore.delete(id);

      const metadataStore = transaction.objectStore(this.METADATA_STORE);
      metadataStore.delete(id);
    });
  }

  /**
   * すべてのスクリーンショットを削除
   */
  static async clearAllScreenshots(): Promise<void> {
    const screenshots = await this.getScreenshots();
    const promises = screenshots.map(screenshot => this.deleteScreenshot(screenshot.id));
    await Promise.all(promises);
    console.log(`🧹 Cleared ${screenshots.length} screenshots from storage`);
  }

  /**
   * 古いスクリーンショットのクリーンアップ
   */
  static async cleanupOldScreenshots(): Promise<void> {
    await this.initialize();
    if (!this.db) return;

    const allScreenshots = await this.getScreenshots();
    
    if (allScreenshots.length <= this.MAX_SCREENSHOTS) return;

    // 古いものから削除
    const toDelete = allScreenshots
      .slice(this.MAX_SCREENSHOTS)
      .map(screenshot => screenshot.id);

    const promises = toDelete.map(id => this.deleteScreenshot(id));
    await Promise.all(promises);

    console.log(`🧹 Cleaned up ${toDelete.length} old screenshots`);
  }

  /**
   * ストレージ使用量を取得
   */
  static async getStorageUsage(): Promise<{ count: number; totalSize: number }> {
    await this.initialize();
    if (!this.db) return { count: 0, totalSize: 0 };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.METADATA_STORE], 'readonly');
      const store = transaction.objectStore(this.METADATA_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const metadata = request.result as ScreenshotMetadata[];
        const count = metadata.length;
        const totalSize = metadata.reduce((sum, meta) => sum + meta.size, 0);
        
        resolve({ count, totalSize });
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * TabID別のスクリーンショット数を効率的に取得
   */
  static async getScreenshotCountsByTabId(): Promise<Record<string, number>> {
    await this.initialize();
    if (!this.db) return {};

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('tabId');
      
      const counts: Record<string, number> = {};
      
      // カーソルを使って効率的にカウント
      const cursorRequest = index.openCursor();
      
      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const tabId = cursor.key as string;
          counts[tabId] = (counts[tabId] || 0) + 1;
          cursor.continue();
        } else {
          // カーソル完了
          resolve(counts);
        }
      };
      
      cursorRequest.onerror = () => {
        reject(cursorRequest.error);
      };
    });
  }

  /**
   * 総スクリーンショット数を効率的に取得
   */
  static async getTotalScreenshotCount(): Promise<number> {
    await this.initialize();
    if (!this.db) return 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const countRequest = store.count();

      countRequest.onsuccess = () => {
        resolve(countRequest.result);
      };

      countRequest.onerror = () => {
        reject(countRequest.error);
      };
    });
  }

  /**
   * リスナーを追加（リアルタイム更新用）
   */
  static addListener(listener: StorageEventListener): void {
    this.listeners.add(listener);
  }

  /**
   * リスナーを削除
   */
  static removeListener(listener: StorageEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * リスナーに変更を通知
   */
  private static async notifyListeners(): Promise<void> {
    if (this.listeners.size === 0) return;

    try {
      const screenshots = await this.getScreenshots();
      this.listeners.forEach(listener => {
        try {
          listener(screenshots);
        } catch (error) {
          console.error('Error in storage listener:', error);
        }
      });
    } catch (error) {
      console.error('Failed to notify listeners:', error);
    }
  }


  /**
   * データベースを閉じる
   */
  static close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('📦 Screenshot IndexedDB closed');
    }
  }
}
/**
 * Advanced Screenshot Capture Service for AI Analysis Screens
 * Captures high-quality images of MVV analysis dashboards for Excel integration
 * Multi-library fallback support for maximum compatibility
 */

import * as htmlToImage from 'html-to-image';
// @ts-ignore - dom-to-image-more lacks TypeScript definitions
import * as domtoimage from 'dom-to-image-more';
import { ScreenshotStorageService } from './screenshotStorage';

export interface ScreenshotOptions {
  width?: number;
  height?: number;
  quality?: number;
  backgroundColor?: string;
  scale?: number;
  useCORS?: boolean;
  allowTaint?: boolean;
  removeWatermarks?: boolean;
  optimizeForExcel?: boolean;
  preferredLibrary?: 'html-to-image' | 'dom-to-image' | 'auto';
  autoSaveToIndexedDB?: boolean; // IndexedDBへの自動保存
}

export interface AnalysisScreenshot {
  id: string;
  name: string;
  description: string;
  dataUrl: string;
  width: number;
  height: number;
  timestamp: number;
  tabId: string;
}

export class ScreenshotCaptureService {
  private static readonly DEFAULT_OPTIONS: ScreenshotOptions = {
    width: 1200,
    height: 800,
    quality: 0.95,
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: false,
    allowTaint: false,
    removeWatermarks: true,
    optimizeForExcel: true,
    preferredLibrary: 'auto',
    autoSaveToIndexedDB: false
  };

  private static readonly ANALYSIS_SCREENS = {
    finder: {
      name: '類似企業検索',
      description: 'リアルタイム企業類似度分析画面',
      selector: '[data-analysis-screen="finder"]'
    },
    trends: {
      name: 'トレンド分析', 
      description: 'MVVキーワードトレンド分析画面',
      selector: '[data-analysis-screen="trends"]'
    },
    wordcloud: {
      name: 'ワードクラウド',
      description: 'インタラクティブキーワードクラウド画面', 
      selector: '[data-analysis-screen="wordcloud"]'
    },
    positioning: {
      name: 'ポジショニングマップ',
      description: '競合ポジショニング分析画面',
      selector: '[data-analysis-screen="positioning"]'
    },
    uniqueness: {
      name: '独自性分析',
      description: '企業独自性スコア分析画面',
      selector: '[data-analysis-screen="uniqueness"]'
    },
    quality: {
      name: '品質評価',
      description: 'MVV品質評価システム画面',
      selector: '[data-analysis-screen="quality"]'
    }
  } as const;

  /**
   * 指定された分析画面のスクリーンショットを撮影
   */
  static async captureAnalysisScreen(
    tabId: keyof typeof this.ANALYSIS_SCREENS,
    options: Partial<ScreenshotOptions> = {}
  ): Promise<AnalysisScreenshot> {
    const screenConfig = this.ANALYSIS_SCREENS[tabId];
    if (!screenConfig) {
      throw new Error(`Unknown analysis screen: ${tabId}`);
    }

    const finalOptions = { ...this.DEFAULT_OPTIONS, ...options };
    
    // 画面要素を取得
    const element = document.querySelector(screenConfig.selector) as HTMLElement;
    if (!element) {
      throw new Error(`Analysis screen element not found: ${screenConfig.selector}`);
    }

    // スクリーンショット撮影前の準備
    await this.prepareElementForCapture(element);

    try {
      // 要素の前処理
      if (finalOptions.removeWatermarks || finalOptions.optimizeForExcel) {
        await this.preprocessElementForCapture(element, finalOptions);
      }

      // フォールバック機能付きスクリーンショット撮影
      const dataUrl = await this.captureWithFallback(element, finalOptions);

      // 画像サイズを取得（画像からサイズを推定）
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const screenshot: AnalysisScreenshot = {
        id: `analysis_${tabId}_${Date.now()}`,
        name: screenConfig.name,
        description: screenConfig.description,
        dataUrl,
        width: img.naturalWidth,
        height: img.naturalHeight,
        timestamp: Date.now(),
        tabId
      };

      // IndexedDBへの自動保存
      if (finalOptions.autoSaveToIndexedDB) {
        try {
          await ScreenshotStorageService.saveScreenshot(screenshot);
          console.log(`💾 Auto-saved screenshot to IndexedDB: ${screenshot.name}`);
        } catch (error) {
          console.warn('Failed to auto-save screenshot to IndexedDB:', error);
          // 保存失敗でもスクリーンショット作成は続行
        }
      }

      return screenshot;

    } finally {
      // クリーンアップ
      await this.cleanupAfterCapture(element);
    }
  }

  /**
   * 選択された分析画面のスクリーンショットを順次撮影
   */
  static async captureSelectedAnalysisScreens(
    selectedTabIds: string[],
    onProgress?: (current: number, total: number, screenName: string) => void,
    options: Partial<ScreenshotOptions> = {}
  ): Promise<AnalysisScreenshot[]> {
    const screenshots: AnalysisScreenshot[] = [];
    
    for (let i = 0; i < selectedTabIds.length; i++) {
      const tabId = selectedTabIds[i];
      const screenConfig = this.ANALYSIS_SCREENS[tabId as keyof typeof this.ANALYSIS_SCREENS];
      
      if (!screenConfig) {
        console.warn(`Unknown tab ID: ${tabId}`);
        continue;
      }
      
      if (onProgress) {
        onProgress(i + 1, selectedTabIds.length, screenConfig.name);
      }

      try {
        // タブ切り替えを待機
        await this.switchToAnalysisTab(tabId);
        await this.waitForContentLoad();

        // スクリーンショット撮影
        const screenshot = await this.captureAnalysisScreen(tabId as keyof typeof this.ANALYSIS_SCREENS, options);
        screenshots.push(screenshot);

        // タブ切り替え後の短い待機
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`Failed to capture ${screenConfig.name}:`, error);
        // エラーが発生しても他の画面の撮影は続行
      }
    }

    // 撮影完了後は必ずギャラリータブに戻る
    await this.switchToAnalysisTab('gallery');
    await new Promise(resolve => setTimeout(resolve, 300)); // ギャラリータブの描画完了を待機

    // IndexedDBへの一括自動保存
    if (options.autoSaveToIndexedDB && screenshots.length > 0) {
      try {
        await ScreenshotStorageService.saveScreenshots(screenshots);
        console.log(`💾 Auto-saved ${screenshots.length} screenshots to IndexedDB`);
      } catch (error) {
        console.warn('Failed to auto-save screenshots to IndexedDB:', error);
      }
    }

    console.log(`📸 選択画面撮影完了: ${screenshots.length}件`);
    return screenshots;
  }

  /**
   * 全ての分析画面のスクリーンショットを順次撮影
   */
  static async captureAllAnalysisScreens(
    onProgress?: (current: number, total: number, screenName: string) => void,
    options: Partial<ScreenshotOptions> = {}
  ): Promise<AnalysisScreenshot[]> {
    const screenshots: AnalysisScreenshot[] = [];
    const tabIds = Object.keys(this.ANALYSIS_SCREENS) as Array<keyof typeof this.ANALYSIS_SCREENS>;
    
    // 現在のタブを記憶（撮影後に戻るため）
    const originalTab = this.getCurrentActiveTab();
    
    for (let i = 0; i < tabIds.length; i++) {
      const tabId = tabIds[i];
      const screenConfig = this.ANALYSIS_SCREENS[tabId];
      
      if (onProgress) {
        onProgress(i + 1, tabIds.length, screenConfig.name);
      }

      try {
        // タブ切り替えを待機
        await this.switchToAnalysisTab(tabId);
        await this.waitForContentLoad();

        // スクリーンショット撮影
        const screenshot = await this.captureAnalysisScreen(tabId as keyof typeof this.ANALYSIS_SCREENS, options);
        screenshots.push(screenshot);

        // タブ切り替え後の短い待機
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`Failed to capture ${screenConfig.name}:`, error);
        // エラーが発生しても他の画面の撮影は続行
      }
    }

    // 元のタブに戻る（ギャラリータブの場合は戻らない - 状態を保持するため）
    if (originalTab && originalTab !== 'gallery') {
      await this.switchToAnalysisTab(originalTab);
    }
    // ギャラリータブの場合は何もしない（既にギャラリータブにいる状態を維持）

    // IndexedDBへの一括自動保存
    if (options.autoSaveToIndexedDB && screenshots.length > 0) {
      try {
        await ScreenshotStorageService.saveScreenshots(screenshots);
        console.log(`💾 Auto-saved ${screenshots.length} screenshots to IndexedDB`);
      } catch (error) {
        console.warn('Failed to auto-save screenshots to IndexedDB:', error);
      }
    }

    console.log(`📸 全スクリーンショット撮影完了: ${screenshots.length}件`);
    return screenshots;
  }

  /**
   * 要素の前処理（html-to-image用）
   */
  private static async preprocessElementForCapture(
    element: HTMLElement, 
    options: ScreenshotOptions
  ): Promise<void> {
    // 一時的なスタイル変更のため、変更前の状態を保存
    const originalStyles = new Map<Element, string>();
    
    if (options.optimizeForExcel) {
      // 最小フォントサイズの調整
      const textElements = element.querySelectorAll('*');
      textElements.forEach(el => {
        const htmlEl = el as HTMLElement;
        const computedStyle = window.getComputedStyle(el);
        const fontSize = parseInt(computedStyle.fontSize);
        
        if (fontSize < 12) {
          originalStyles.set(el, htmlEl.style.fontSize);
          htmlEl.style.fontSize = '12px';
        }
      });
    }
    
    // 透かし要素の非表示
    if (options.removeWatermarks) {
      const watermarkSelectors = [
        '.watermark',
        '.development-only',
        '[data-exclude-from-screenshot]'
      ];
      
      watermarkSelectors.forEach(selector => {
        const elements = element.querySelectorAll(selector);
        elements.forEach(el => {
          const htmlEl = el as HTMLElement;
          originalStyles.set(el, htmlEl.style.display);
          htmlEl.style.display = 'none';
        });
      });
    }
    
    // 変更された要素の情報を一時保存（クリーンアップ用）
    (element as any).__tempStyleChanges = originalStyles;
  }

  /**
   * スクリーンショット撮影前の要素準備
   */
  private static async prepareElementForCapture(element: HTMLElement): Promise<void> {
    // スクロール位置をトップに設定
    element.scrollTop = 0;
    
    // 背景色を明示的に設定（透明度問題を回避）
    const originalBgColor = element.style.backgroundColor;
    element.style.backgroundColor = '#ffffff';
    (element as any).__originalBgColor = originalBgColor;
    
    // 動的コンテンツの読み込み完了を待機
    await this.waitForContentLoad();
    
    // レイアウトが安定するまで待機
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  /**
   * 撮影後のクリーンアップ
   */
  private static async cleanupAfterCapture(element: HTMLElement): Promise<void> {
    // 背景色を元に戻す
    const originalBgColor = (element as any).__originalBgColor;
    if (originalBgColor !== undefined) {
      element.style.backgroundColor = originalBgColor;
      delete (element as any).__originalBgColor;
    }
    
    // 前処理で行った一時的なスタイル変更を元に戻す
    const originalStyles = (element as any).__tempStyleChanges as Map<Element, string>;
    
    if (originalStyles) {
      originalStyles.forEach((originalValue, el) => {
        const htmlEl = el as HTMLElement;
        if (originalValue) {
          htmlEl.style.fontSize = originalValue;
          htmlEl.style.display = originalValue;
        } else {
          htmlEl.style.removeProperty('font-size');
          htmlEl.style.removeProperty('display');
        }
      });
      
      // 一時データを削除
      delete (element as any).__tempStyleChanges;
    }
  }

  /**
   * 現在アクティブなタブを取得
   */
  private static getCurrentActiveTab(): string | null {
    // アクティブなタブボタンを探す（通常はborder-blue-500クラスを持つ）
    const activeTabButton = document.querySelector('[data-tab-id].border-blue-500') as HTMLElement;
    if (activeTabButton) {
      return activeTabButton.getAttribute('data-tab-id');
    }
    return null;
  }

  /**
   * 分析タブに切り替え
   */
  private static async switchToAnalysisTab(tabId: string): Promise<void> {
    // タブボタンを探してクリック
    const tabButton = document.querySelector(`[data-tab-id="${tabId}"]`) as HTMLButtonElement;
    if (tabButton) {
      tabButton.click();
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  /**
   * コンテンツの読み込み完了を待機
   */
  private static async waitForContentLoad(): Promise<void> {
    return new Promise(resolve => {
      // 既存の画像とコンテンツの読み込み完了を確認
      const images = document.querySelectorAll('img');
      const charts = document.querySelectorAll('canvas, svg');
      
      if (images.length === 0 && charts.length === 0) {
        resolve();
        return;
      }

      let loadedCount = 0;
      const totalCount = images.length + charts.length;

      const checkComplete = () => {
        loadedCount++;
        if (loadedCount >= totalCount) {
          resolve();
        }
      };

      // 画像の読み込み確認
      images.forEach(img => {
        if (img.complete) {
          checkComplete();
        } else {
          img.addEventListener('load', checkComplete);
          img.addEventListener('error', checkComplete);
        }
      });

      // チャートの読み込み確認（既に描画されていると仮定）
      charts.forEach(() => checkComplete());

      // タイムアウト設定（5秒）
      setTimeout(resolve, 5000);
    });
  }

  /**
   * フォールバック機能付きスクリーンショット撮影
   */
  private static async captureWithFallback(
    element: HTMLElement, 
    options: ScreenshotOptions
  ): Promise<string> {
    const libraries = this.getLibraryOrder(options.preferredLibrary || 'auto');
    
    for (const library of libraries) {
      try {
        console.log(`📸 Trying screenshot with ${library}...`);
        const dataUrl = await this.captureWithLibrary(element, options, library);
        console.log(`✅ Screenshot successful with ${library}`);
        return dataUrl;
      } catch (error) {
        console.warn(`❌ Screenshot failed with ${library}:`, error);
        continue;
      }
    }
    
    throw new Error('All screenshot libraries failed');
  }

  /**
   * ライブラリの試行順序を決定
   */
  private static getLibraryOrder(preferred: string): string[] {
    switch (preferred) {
      case 'html-to-image':
        return ['html-to-image', 'dom-to-image'];
      case 'dom-to-image':
        return ['dom-to-image', 'html-to-image'];
      case 'auto':
      default:
        // OKLCH対応の順序: html-to-image優先、フォールバックでdom-to-image
        return ['html-to-image', 'dom-to-image'];
    }
  }

  /**
   * 指定されたライブラリでスクリーンショット撮影
   */
  private static async captureWithLibrary(
    element: HTMLElement,
    options: ScreenshotOptions,
    library: string
  ): Promise<string> {
    const commonOptions = {
      width: options.width,
      height: options.height,
      backgroundColor: options.backgroundColor || '#ffffff',
      quality: options.quality,
      pixelRatio: options.scale || 1,
    };

    const filter = (node: Node) => {
      if (options.removeWatermarks) {
        const el = node as Element;
        if (el.classList?.contains('watermark') || 
            el.classList?.contains('development-only') ||
            el.hasAttribute?.('data-exclude-from-screenshot')) {
          return false;
        }
      }
      return true;
    };

    switch (library) {
      case 'html-to-image':
        return await htmlToImage.toPng(element, {
          ...commonOptions,
          pixelRatio: options.scale,
          skipAutoScale: true,
          preferredFontFormat: 'woff2',
          filter,
          style: {
            transform: 'scale(1)',
            transformOrigin: 'top left',
          }
        });

      case 'dom-to-image':
        return await domtoimage.toPng(element, {
          ...commonOptions,
          scale: options.scale,
          filter,
          style: {
            transform: 'scale(1)',
            transformOrigin: 'top left',
          }
        });

      default:
        throw new Error(`Unknown library: ${library}`);
    }
  }

  /**
   * 注意: 複数のライブラリで最大互換性を実現
   * html-to-image: OKLCH色自動対応、高画質
   * dom-to-image-more: フォールバック、安定性
   */

  /**
   * スクリーンショットをBlob形式で取得
   */
  static async screenshotToBlob(screenshot: AnalysisScreenshot): Promise<Blob> {
    const response = await fetch(screenshot.dataUrl);
    return response.blob();
  }

  /**
   * 複数のスクリーンショットをZIP形式でダウンロード
   */
  static async downloadScreenshotsAsZip(screenshots: AnalysisScreenshot[]): Promise<void> {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    for (const screenshot of screenshots) {
      const blob = await this.screenshotToBlob(screenshot);
      zip.file(`${screenshot.name}_${new Date(screenshot.timestamp).toISOString().split('T')[0]}.png`, blob);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    
    // ダウンロード
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zipBlob);
    link.download = `mvv_analysis_screenshots_${new Date().toISOString().split('T')[0]}.zip`;
    link.click();
    
    // クリーンアップ
    URL.revokeObjectURL(link.href);
  }
}
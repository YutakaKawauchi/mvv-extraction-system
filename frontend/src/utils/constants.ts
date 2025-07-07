export const CONSTANTS = {
  // API設定
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8888/.netlify/functions',
  API_SECRET: import.meta.env.VITE_API_SECRET || '',
  ENVIRONMENT: import.meta.env.VITE_ENVIRONMENT || 'development',

  // バッチ処理設定
  BATCH_SIZE: 5,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // ミリ秒

  // ストレージ設定
  DB_NAME: 'mvv_extraction_db',
  DB_VERSION: 1,

  // UI設定
  DEFAULT_PAGE_SIZE: 20,
  TOAST_DURATION: 3000,

  // カテゴリー
  COMPANY_CATEGORIES: [
    'ヘルスケア',
    'メディカル',
    'デジタルヘルス',
    'バイオテクノロジー',
    '医療機器',
    '製薬',
    'その他'
  ],

  // ステータスラベル
  STATUS_LABELS: {
    pending: '未処理',
    processing: '処理中',
    completed: '完了',
    error: 'エラー'
  }
} as const;
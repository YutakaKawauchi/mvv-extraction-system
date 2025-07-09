export const CONSTANTS = {
  // API設定
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8888/.netlify/functions',
  API_SECRET: import.meta.env.VITE_API_SECRET || '',
  ENVIRONMENT: import.meta.env.VITE_ENVIRONMENT || 'development',

  // バッチ処理設定
  BATCH_SIZE: import.meta.env.PROD ? 2 : 5, // プロダクション環境では並列数を削減
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // ミリ秒
  PROCESSING_DELAY: import.meta.env.PROD ? 2000 : 1000, // プロダクション環境では処理間隔を増加

  // ストレージ設定
  DB_NAME: 'mvv_extraction_db',
  DB_VERSION: 2,

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
    mvv_extracted: 'MVV抽出済み',
    fully_completed: '完全完了',
    mvv_extraction_error: 'MVV抽出エラー',
    embeddings_generation_error: 'Embeddings生成エラー',
    error: 'エラー'
  }
} as const;
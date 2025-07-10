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
  
  // 一時的な機能フラグ（開発完了後は削除）
  FEATURES: {
    COMPANY_INFO_MIGRATION: false, // マイグレーション完了のため無効化
  },

  // カテゴリー（JSIC大分類）
  COMPANY_CATEGORIES: [
    '農業，林業',
    '漁業',
    '鉱業，採石業，砂利採取業',
    '建設業',
    '製造業',
    '電気・ガス・熱供給・水道業',
    '情報通信業',
    '運輸業，郵便業',
    '卸売業，小売業',
    '金融業，保険業',
    '不動産業，物品賃貸業',
    '学術研究，専門・技術サービス業',
    '宿泊業，飲食サービス業',
    '生活関連サービス業，娯楽業',
    '教育，学習支援業',
    '医療，福祉',
    '複合サービス事業',
    'サービス業（他に分類されないもの）',
    '公務（他に分類されるものを除く）',
    '分類不能の産業'
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
/**
 * JSIC大分類カテゴリの正規化ユーティリティ
 */

// 正式なJSIC大分類マッピング
const JSIC_MAJOR_CATEGORIES = {
  'A': '農業，林業',
  'B': '漁業',
  'C': '鉱業，採石業，砂利採取業',
  'D': '建設業',
  'E': '製造業',
  'F': '電気・ガス・熱供給・水道業',
  'G': '情報通信業',
  'H': '運輸業，郵便業',
  'I': '卸売業，小売業',
  'J': '金融業，保険業',
  'K': '不動産業，物品賃貸業',
  'L': '学術研究，専門・技術サービス業',
  'M': '宿泊業，飲食サービス業',
  'N': '生活関連サービス業，娯楽業',
  'O': '教育，学習支援業',
  'P': '医療，福祉',
  'Q': '複合サービス事業',
  'R': 'サービス業（他に分類されないもの）',
  'S': '公務（他に分類されるものを除く）',
  'T': '分類不能の産業'
};

// 大分類名の正規化
export function normalizeJSICMajorCategory(categoryName: string | null | undefined): string {
  if (!categoryName) return '未分類';
  
  // カンマ区切りの場合、最初の分類を採用
  const firstCategory = categoryName.split('，')[0].split(',')[0].trim();
  
  // 正式な大分類名に一致するか確認
  const normalizedCategory = Object.values(JSIC_MAJOR_CATEGORIES).find(
    officialName => {
      // 完全一致
      if (officialName === firstCategory) return true;
      
      // スペースの有無を無視して比較
      const normalized1 = officialName.replace(/\s/g, '');
      const normalized2 = firstCategory.replace(/\s/g, '');
      if (normalized1 === normalized2) return true;
      
      // 部分一致（主要キーワード）
      const keywords = ['製造業', '情報通信業', '医療', '福祉', 'サービス業', '卸売業', '小売業'];
      return keywords.some(keyword => 
        firstCategory.includes(keyword) && officialName.includes(keyword)
      );
    }
  );
  
  return normalizedCategory || firstCategory || '未分類';
}

// カテゴリコードから大分類名を取得
export function getJSICMajorCategoryFromCode(code: string | null | undefined): string {
  if (!code) return '未分類';
  const upperCode = code.toUpperCase();
  return JSIC_MAJOR_CATEGORIES[upperCode as keyof typeof JSIC_MAJOR_CATEGORIES] || '未分類';
}

// 産業分類から正規化されたカテゴリを生成
export function generateNormalizedCategory(classification?: any): string {
  if (!classification) return '未分類';
  
  // 1. 大分類コードがある場合は優先
  if (classification.jsicMajorCategory) {
    const categoryFromCode = getJSICMajorCategoryFromCode(classification.jsicMajorCategory);
    if (categoryFromCode !== '未分類') return categoryFromCode;
  }
  
  // 2. 大分類名を正規化
  if (classification.jsicMajorName) {
    return normalizeJSICMajorCategory(classification.jsicMajorName);
  }
  
  // 3. その他のフォールバック
  if (classification.jsicMiddleName) {
    return normalizeJSICMajorCategory(classification.jsicMiddleName);
  }
  
  if (classification.primaryIndustry) {
    return classification.primaryIndustry;
  }
  
  if (classification.businessType) {
    return classification.businessType;
  }
  
  return '未分類';
}
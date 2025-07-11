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

// JSIC中分類マッピング（主要な業界のみ）
const JSIC_MIDDLE_CATEGORIES = {
  // 製造業（E）の中分類
  '090': '食料品製造業',
  '100': '飲料・たばこ・飼料製造業',
  '110': '繊維工業',
  '120': '木材・木製品製造業（家具を除く）',
  '130': '家具・装身具製造業',
  '140': 'パルプ・紙・紙加工品製造業',
  '150': '印刷・同関連業',
  '160': '化学工業',
  '170': '石油製品・石炭製品製造業',
  '180': 'プラスチック製品製造業（別掲を除く）',
  '190': 'ゴム製品製造業',
  '200': 'なめし革・同製品・毛皮製造業',
  '210': '窯業・土石製品製造業',
  '220': '鉄鋼業',
  '230': '非鉄金属製造業',
  '240': '金属製品製造業',
  '250': 'はん用機械器具製造業',
  '260': '生産用機械器具製造業',
  '270': '業務用機械器具製造業',
  '280': '電子部品・デバイス・電子回路製造業',
  '290': '電気機械器具製造業',
  '300': '情報通信機械器具製造業',
  '310': '輸送用機械器具製造業',
  '320': 'その他の製造業',
  
  // 情報通信業（G）の中分類
  '371': '通信業',
  '375': '放送業',
  '378': '情報サービス業',
  '391': 'インターネット附随サービス業',
  '392': '映像・音声・文字情報制作業',
  
  // 医療，福祉（P）の中分類
  '831': '医療業',
  '832': '保健衛生',
  '833': '社会保険・社会福祉・介護事業',
  
  // 卸売業，小売業（I）の中分類
  '501': '各種商品卸売業',
  '511': '繊維・衣服等卸売業',
  '521': '飲食料品卸売業',
  '531': '建築材料，鉱物・金属材料等卸売業',
  '541': '機械器具卸売業',
  '551': 'その他の卸売業',
  '561': '各種商品小売業',
  '571': '織物・衣服・身の回り品小売業',
  '581': '飲食料品小売業',
  '591': '機械器具小売業',
  '601': 'その他の小売業',
  
  // 金融業，保険業（J）の中分類
  '621': '銀行業',
  '622': '協同組織金融業',
  '631': '貸金業，クレジットカード業等非預金信用機関',
  '632': '金融商品取引業，商品先物取引業',
  '633': '補助的金融業等',
  '641': '保険業（保険媒介代理業，保険サービス業を含む）',
  
  // 不動産業，物品賃貸業（K）の中分類
  '681': '不動産取引業',
  '682': '不動産賃貸業・管理業',
  '691': '物品賃貸業',
  
  // 学術研究，専門・技術サービス業（L）の中分類
  '711': '学術・開発研究機関',
  '721': '専門サービス業（他に分類されないもの）',
  '731': '広告業',
  '741': '技術サービス業（他に分類されないもの）'
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

// 中分類コードから中分類名を取得
export function getJSICMiddleCategoryFromCode(code: string | null | undefined): string {
  if (!code) return '未分類';
  return JSIC_MIDDLE_CATEGORIES[code as keyof typeof JSIC_MIDDLE_CATEGORIES] || '未分類';
}

// 中分類コードから大分類を逆引き
export function getMajorCategoryFromMiddleCode(middleCode: string | null | undefined): string {
  if (!middleCode) return '未分類';
  
  const codeNum = parseInt(middleCode, 10);
  if (isNaN(codeNum)) return '未分類';
  
  // JSIC中分類コードから大分類を判定
  if (codeNum >= 10 && codeNum <= 50) return '農業，林業';           // A
  if (codeNum >= 60 && codeNum <= 80) return '漁業';                  // B
  if (codeNum >= 90 && codeNum <= 120) return '鉱業，採石業，砂利採取業'; // C
  if (codeNum >= 140 && codeNum <= 170) return '建設業';             // D
  if (codeNum >= 90 && codeNum <= 320) return '製造業';              // E
  if (codeNum >= 330 && codeNum <= 360) return '電気・ガス・熱供給・水道業'; // F
  if (codeNum >= 371 && codeNum <= 399) return '情報通信業';         // G
  if (codeNum >= 420 && codeNum <= 499) return '運輸業，郵便業';      // H
  if (codeNum >= 501 && codeNum <= 609) return '卸売業，小売業';      // I
  if (codeNum >= 621 && codeNum <= 669) return '金融業，保険業';      // J
  if (codeNum >= 681 && codeNum <= 699) return '不動産業，物品賃貸業'; // K
  if (codeNum >= 711 && codeNum <= 759) return '学術研究，専門・技術サービス業'; // L
  if (codeNum >= 761 && codeNum <= 799) return '宿泊業，飲食サービス業'; // M
  if (codeNum >= 801 && codeNum <= 829) return '生活関連サービス業，娯楽業'; // N
  if (codeNum >= 841 && codeNum <= 859) return '教育，学習支援業';    // O
  if (codeNum >= 831 && codeNum <= 839) return '医療，福祉';          // P
  if (codeNum >= 871 && codeNum <= 879) return '複合サービス事業';    // Q
  if (codeNum >= 881 && codeNum <= 929) return 'サービス業（他に分類されないもの）'; // R
  if (codeNum >= 931 && codeNum <= 999) return '公務（他に分類されるものを除く）'; // S
  
  return '分類不能の産業'; // T
}

// 利用可能なJSIC中分類の一覧を取得
export function getAvailableMiddleCategories(): Array<{ code: string; name: string; majorCategory: string }> {
  return Object.entries(JSIC_MIDDLE_CATEGORIES).map(([code, name]) => ({
    code,
    name,
    majorCategory: getMajorCategoryFromMiddleCode(code)
  }));
}

// 大分類に属する中分類の一覧を取得
export function getMiddleCategoriesByMajor(majorCategory: string): Array<{ code: string; name: string }> {
  return Object.entries(JSIC_MIDDLE_CATEGORIES)
    .filter(([code]) => getMajorCategoryFromMiddleCode(code) === majorCategory)
    .map(([code, name]) => ({ code, name }));
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
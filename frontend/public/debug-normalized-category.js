/**
 * 正規化済み大分類カテゴリシミュレーション
 */

// JSIC大分類マッピング（正規化用）
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

// カテゴリ正規化関数
function normalizeCategory(classification) {
  if (!classification) return '未分類';
  
  // 1. 大分類コードがある場合は優先
  if (classification.jsicMajorCategory) {
    const categoryFromCode = JSIC_MAJOR_CATEGORIES[classification.jsicMajorCategory.toUpperCase()];
    if (categoryFromCode) return categoryFromCode;
  }
  
  // 2. 大分類名を正規化
  if (classification.jsicMajorName) {
    // カンマ区切りの場合、最初の分類を採用
    const firstCategory = classification.jsicMajorName.split('，')[0].split(',')[0].trim();
    
    // 正式な大分類名に一致するか確認
    const normalizedCategory = Object.values(JSIC_MAJOR_CATEGORIES).find(
      officialName => {
        // スペースの有無を無視して比較
        const normalized1 = officialName.replace(/\s/g, '');
        const normalized2 = firstCategory.replace(/\s/g, '');
        return normalized1 === normalized2 || officialName === firstCategory;
      }
    );
    
    return normalizedCategory || firstCategory || '未分類';
  }
  
  // 3. その他のフォールバック
  return classification.jsicMiddleName || 
         classification.primaryIndustry || 
         classification.businessType || 
         '未分類';
}

// 正規化済みカテゴリでのシミュレーション
window.simulateNormalizedCategoryUpdate = async function() {
  console.log('🔄 正規化済み大分類カテゴリシミュレーション...');
  
  try {
    const request = indexedDB.open('mvv_extraction_db');
    
    request.onsuccess = function(event) {
      const db = event.target.result;
      
      const companiesTransaction = db.transaction(['companies'], 'readonly');
      const companiesStore = companiesTransaction.objectStore('companies');
      const companiesRequest = companiesStore.getAll();
      
      const infoTransaction = db.transaction(['companyInfo'], 'readonly');
      const infoStore = infoTransaction.objectStore('companyInfo');
      const infoRequest = infoStore.getAll();
      
      Promise.all([
        new Promise(resolve => {
          companiesRequest.onsuccess = () => resolve(companiesRequest.result);
        }),
        new Promise(resolve => {
          infoRequest.onsuccess = () => resolve(infoRequest.result);
        })
      ]).then(([companies, companyInfos]) => {
        
        const infoMap = {};
        companyInfos.forEach(info => {
          infoMap[info.companyId] = info;
        });
        
        console.log('\n📊 正規化済み大分類カテゴリシミュレーション結果:');
        console.log('現在のカテゴリ → 新しいカテゴリ（正規化済み大分類）\n');
        
        const categoryStats = {};
        let changeCount = 0;
        let sampleChanges = [];
        
        companies.forEach(company => {
          const info = infoMap[company.id];
          if (info && info.industryClassification) {
            const classification = info.industryClassification;
            
            // 正規化されたカテゴリを生成
            const newCategory = normalizeCategory(classification);
            
            const currentCategory = company.category || '未設定';
            
            // 新しいカテゴリの統計
            categoryStats[newCategory] = (categoryStats[newCategory] || 0) + 1;
            
            if (currentCategory !== newCategory) {
              changeCount++;
              
              if (sampleChanges.length < 10) {
                sampleChanges.push({
                  company: company.name,
                  current: currentCategory,
                  new: newCategory,
                  code: classification.jsicMajorCategory,
                  rawName: classification.jsicMajorName
                });
              }
            }
          }
        });
        
        console.log('📊 正規化後のカテゴリ分布:');
        console.table(categoryStats);
        
        console.log('\n🔍 変更サンプル（上位10件）:');
        sampleChanges.forEach(change => {
          console.log(`${change.company}:`);
          console.log(`  現在: "${change.current}"`);
          console.log(`  新規: "${change.new}"`);
          console.log(`  コード: ${change.code || 'なし'}, 元の名称: "${change.rawName || 'なし'}"`);
          console.log('');
        });
        
        const categoryCount = Object.keys(categoryStats).length;
        console.log(`📈 正規化後のカテゴリ数: ${categoryCount}種類`);
        console.log(`📈 変更が必要な企業: ${changeCount}/${companies.length}社`);
        
        if (changeCount > 0) {
          console.log('\n✅ 正規化により、統一された大分類カテゴリになります！');
          console.log('💡 updateToNormalizedCategories() を実行してください。');
        }
      });
    };
    
  } catch (error) {
    console.error('❌ 正規化シミュレーションエラー:', error);
  }
};

// 正規化済みカテゴリへの更新実行
window.updateToNormalizedCategories = async function() {
  console.log('🔄 正規化済み大分類カテゴリに更新中...');
  
  try {
    const request = indexedDB.open('mvv_extraction_db');
    
    request.onsuccess = function(event) {
      const db = event.target.result;
      
      const transaction = db.transaction(['companies', 'companyInfo'], 'readwrite');
      const companiesStore = transaction.objectStore('companies');
      const infoStore = transaction.objectStore('companyInfo');
      
      const companiesRequest = companiesStore.getAll();
      const infoRequest = infoStore.getAll();
      
      Promise.all([
        new Promise(resolve => {
          companiesRequest.onsuccess = () => resolve(companiesRequest.result);
        }),
        new Promise(resolve => {
          infoRequest.onsuccess = () => resolve(infoRequest.result);
        })
      ]).then(([companies, companyInfos]) => {
        
        const infoMap = {};
        companyInfos.forEach(info => {
          infoMap[info.companyId] = info;
        });
        
        let updateCount = 0;
        const updatePromises = [];
        const categoryStats = {};
        
        companies.forEach(company => {
          const info = infoMap[company.id];
          if (info && info.industryClassification) {
            const classification = info.industryClassification;
            
            // 正規化されたカテゴリを生成
            const newCategory = normalizeCategory(classification);
            
            // 統計収集
            categoryStats[newCategory] = (categoryStats[newCategory] || 0) + 1;
            
            if (company.category !== newCategory) {
              company.category = newCategory;
              company.updatedAt = Date.now();
              
              const updatePromise = new Promise((resolve, reject) => {
                const updateRequest = companiesStore.put(company);
                updateRequest.onsuccess = () => {
                  console.log(`✅ ${company.name}: "${newCategory}"`);
                  updateCount++;
                  resolve();
                };
                updateRequest.onerror = () => reject(updateRequest.error);
              });
              
              updatePromises.push(updatePromise);
            }
          }
        });
        
        Promise.all(updatePromises).then(() => {
          console.log(`\n🎉 正規化済み大分類カテゴリ更新完了: ${updateCount}社を更新しました`);
          console.log('\n📊 最終的なカテゴリ分布:');
          console.table(categoryStats);
          console.log('\n📄 ページをリロードして変更を確認してください');
          console.log('📊 これでシンプルなカテゴリで分析が可能になります！');
        }).catch(error => {
          console.error('❌ 更新エラー:', error);
        });
      });
    };
    
  } catch (error) {
    console.error('❌ 更新処理エラー:', error);
  }
};

console.log('🛠️  正規化済み大分類カテゴリツールが読み込まれました');
console.log('');
console.log('利用可能な関数:');
console.log('1. simulateNormalizedCategoryUpdate() - 正規化済みカテゴリシミュレーション');
console.log('2. updateToNormalizedCategories() - 正規化済みカテゴリに更新実行');
console.log('');
console.log('まず simulateNormalizedCategoryUpdate() を実行してください！');
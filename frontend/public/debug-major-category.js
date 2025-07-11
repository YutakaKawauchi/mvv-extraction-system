/**
 * 大分類カテゴリシミュレーション
 */

// 大分類カテゴリでのシミュレーション
window.simulateMajorCategoryUpdate = async function() {
  console.log('🔄 大分類カテゴリでのシミュレーション...');
  
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
        
        console.log('\n📊 大分類カテゴリシミュレーション結果:');
        console.log('現在のカテゴリ → 新しいカテゴリ（大分類）\n');
        
        const categoryStats = {};
        let changeCount = 0;
        let sampleChanges = [];
        
        companies.forEach(company => {
          const info = infoMap[company.id];
          if (info && info.industryClassification) {
            const classification = info.industryClassification;
            
            // 大分類優先でカテゴリ生成
            const newCategory = 
              classification.jsicMajorName || 
              classification.jsicMiddleName || 
              classification.primaryIndustry || 
              classification.businessType || 
              '未分類';
            
            const currentCategory = company.category || '未設定';
            
            // 新しいカテゴリの統計
            categoryStats[newCategory] = (categoryStats[newCategory] || 0) + 1;
            
            if (currentCategory !== newCategory) {
              changeCount++;
              
              if (sampleChanges.length < 10) {
                sampleChanges.push({
                  company: company.name,
                  current: currentCategory,
                  new: newCategory
                });
              }
            }
          }
        });
        
        console.log('📊 新しいカテゴリ分布（大分類）:');
        console.table(categoryStats);
        
        console.log('\n🔍 変更サンプル（上位10件）:');
        sampleChanges.forEach(change => {
          console.log(`${change.company}:`);
          console.log(`  現在: "${change.current}"`);
          console.log(`  新規: "${change.new}"`);
          console.log('');
        });
        
        const categoryCount = Object.keys(categoryStats).length;
        console.log(`📈 大分類カテゴリ数: ${categoryCount}種類`);
        console.log(`📈 変更が必要な企業: ${changeCount}/${companies.length}社`);
        
        if (changeCount > 0) {
          console.log('\n✅ 大分類での整理により、シンプルで分析しやすくなります！');
          console.log('💡 updateToMajorCategories() を実行してください。');
        }
      });
    };
    
  } catch (error) {
    console.error('❌ 大分類シミュレーションエラー:', error);
  }
};

// 大分類カテゴリへの更新実行
window.updateToMajorCategories = async function() {
  console.log('🔄 大分類カテゴリに更新中...');
  
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
        
        companies.forEach(company => {
          const info = infoMap[company.id];
          if (info && info.industryClassification) {
            const classification = info.industryClassification;
            
            // 大分類優先でカテゴリ生成
            const newCategory = 
              classification.jsicMajorName || 
              classification.jsicMiddleName || 
              classification.primaryIndustry || 
              classification.businessType || 
              '未分類';
            
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
          console.log(`\n🎉 大分類カテゴリ更新完了: ${updateCount}社を更新しました`);
          console.log('📄 ページをリロードして変更を確認してください');
          console.log('📊 これで分析時に階層構造での詳細分析が可能になります！');
        }).catch(error => {
          console.error('❌ 更新エラー:', error);
        });
      });
    };
    
  } catch (error) {
    console.error('❌ 更新処理エラー:', error);
  }
};

console.log('🛠️  大分類カテゴリツールが読み込まれました');
console.log('');
console.log('利用可能な関数:');
console.log('1. simulateMajorCategoryUpdate() - 大分類カテゴリシミュレーション');
console.log('2. updateToMajorCategories() - 大分類カテゴリに更新実行');
console.log('');
console.log('まず simulateMajorCategoryUpdate() を実行してください！');
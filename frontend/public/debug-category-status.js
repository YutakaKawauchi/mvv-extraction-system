/**
 * 現在のDBカテゴリデータ状況確認スクリプト（修正版）
 * ブラウザのコンソールで実行してください
 */

// データベースとテーブル構造を確認
window.checkDatabaseStructure = async function() {
  console.log('🔍 データベース構造を確認中...');
  
  try {
    const request = indexedDB.open('mvv_extraction_db');
    
    request.onsuccess = function(event) {
      const db = event.target.result;
      console.log(`📊 データベース: ${db.name} (バージョン: ${db.version})`);
      console.log('テーブル一覧:');
      
      const objectStoreNames = Array.from(db.objectStoreNames);
      objectStoreNames.forEach(name => {
        console.log(`- ${name}`);
      });
      
      console.log('\n次に debugCategoryStatus() を実行してください');
    };
    
    request.onerror = function(event) {
      console.error('❌ データベースアクセスエラー:', event.target.error);
    };
    
  } catch (error) {
    console.error('❌ データベース確認エラー:', error);
  }
};

// 企業データとカテゴリ状況を確認
window.debugCategoryStatus = async function() {
  console.log('📊 現在のDBカテゴリデータ状況を確認中...');
  
  try {
    const request = indexedDB.open('mvv_extraction_db');
    
    request.onsuccess = function(event) {
      const db = event.target.result;
      
      // 利用可能なテーブル名を確認
      const objectStoreNames = Array.from(db.objectStoreNames);
      console.log('利用可能なテーブル:', objectStoreNames);
      
      // 企業データの確認
      if (objectStoreNames.includes('companies')) {
        const companiesTransaction = db.transaction(['companies'], 'readonly');
        const companiesStore = companiesTransaction.objectStore('companies');
        const companiesRequest = companiesStore.getAll();
        
        companiesRequest.onsuccess = function() {
          const companies = companiesRequest.result;
          console.log(`\n📋 企業データ (${companies.length}社):`);
          
          const categoryStats = {};
          companies.forEach(company => {
            const category = company.category || '未設定';
            categoryStats[category] = (categoryStats[category] || 0) + 1;
          });
          
          console.table(categoryStats);
          
          // サンプル企業の詳細表示
          console.log('\n🔍 サンプル企業の現在のカテゴリ:');
          companies.slice(0, 5).forEach(company => {
            console.log(`- ${company.name}: "${company.category || '未設定'}"`);
          });
        };
      }
      
      // 企業情報データの確認
      if (objectStoreNames.includes('companyInfo')) {
        const infoTransaction = db.transaction(['companyInfo'], 'readonly');
        const infoStore = infoTransaction.objectStore('companyInfo');
        const infoRequest = infoStore.getAll();
        
        infoRequest.onsuccess = function() {
          const companyInfos = infoRequest.result;
          console.log(`\n🏢 企業情報データ (${companyInfos.length}件):`);
          
          let withIndustryClassification = 0;
          let sampleClassifications = [];
          
          companyInfos.forEach(info => {
            if (info.jsicMajorName || info.primaryIndustry || info.businessType) {
              withIndustryClassification++;
              
              if (sampleClassifications.length < 3) {
                sampleClassifications.push({
                  companyId: info.companyId,
                  jsicMajor: info.jsicMajorName,
                  primary: info.primaryIndustry,
                  business: info.businessType
                });
              }
            }
          });
          
          console.log(`産業分類データ有り: ${withIndustryClassification}件`);
          if (sampleClassifications.length > 0) {
            console.log('\n📊 サンプル産業分類データ:');
            console.table(sampleClassifications);
          }
        };
      } else {
        console.log('\n⚠️ companyInfoテーブルが見つかりません');
      }
    };
    
    request.onerror = function(event) {
      console.error('❌ データベースアクセスエラー:', event.target.error);
    };
    
  } catch (error) {
    console.error('❌ データ確認エラー:', error);
  }
};

// カテゴリ再生成のシミュレーション
window.simulateCategoryRegeneration = async function() {
  console.log('🔄 新しい優先順位でのカテゴリ再生成をシミュレーション...');
  
  try {
    const request = indexedDB.open('mvv_extraction_db');
    
    request.onsuccess = function(event) {
      const db = event.target.result;
      
      const objectStoreNames = Array.from(db.objectStoreNames);
      
      if (!objectStoreNames.includes('companies')) {
        console.error('❌ companiesテーブルが見つかりません');
        return;
      }
      
      const companiesTransaction = db.transaction(['companies'], 'readonly');
      const companiesStore = companiesTransaction.objectStore('companies');
      const companiesRequest = companiesStore.getAll();
      
      companiesRequest.onsuccess = function() {
        const companies = companiesRequest.result;
        
        if (objectStoreNames.includes('companyInfo')) {
          const infoTransaction = db.transaction(['companyInfo'], 'readonly');
          const infoStore = infoTransaction.objectStore('companyInfo');
          const infoRequest = infoStore.getAll();
          
          infoRequest.onsuccess = function() {
            const companyInfos = infoRequest.result;
            
            const infoMap = {};
            companyInfos.forEach(info => {
              infoMap[info.companyId] = info;
            });
            
            console.log('\n📊 カテゴリ変更シミュレーション結果:');
            console.log('現在のカテゴリ → 新しいカテゴリ（主業界優先）\n');
            
            let changeCount = 0;
            companies.forEach(company => {
              const info = infoMap[company.id];
              if (info) {
                // 新しい優先順位でカテゴリ生成
                const newCategory = 
                  info.primaryIndustry || 
                  info.jsicMiddleName || 
                  info.jsicMajorName || 
                  info.businessType || 
                  '未分類';
                
                const currentCategory = company.category || '未設定';
                
                if (currentCategory !== newCategory) {
                  console.log(`${company.name}:`);
                  console.log(`  現在: "${currentCategory}"`);
                  console.log(`  新規: "${newCategory}"`);
                  console.log('');
                  changeCount++;
                }
              }
            });
            
            console.log(`📈 変更が必要な企業: ${changeCount}/${companies.length}社`);
            
            if (changeCount > 0) {
              console.log('\n⚠️  カテゴリ更新が推奨されます。');
              console.log('💡 updateCategoriesFromIndustryClassification() を実行してください。');
            } else {
              console.log('\n✅ カテゴリ更新は不要です。');
            }
          };
        } else {
          console.log('⚠️ companyInfoテーブルがないため、シミュレーションをスキップします');
        }
      };
    };
    
  } catch (error) {
    console.error('❌ シミュレーションエラー:', error);
  }
};

// カテゴリ一括更新関数
window.updateCategoriesFromIndustryClassification = async function() {
  console.log('🔄 カテゴリを産業分類データから一括更新中...');
  
  try {
    const request = indexedDB.open('mvv_extraction_db');
    
    request.onsuccess = function(event) {
      const db = event.target.result;
      
      const objectStoreNames = Array.from(db.objectStoreNames);
      
      if (!objectStoreNames.includes('companies') || !objectStoreNames.includes('companyInfo')) {
        console.error('❌ 必要なテーブルが見つかりません');
        return;
      }
      
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
          if (info) {
            // 新しい優先順位でカテゴリ生成
            const newCategory = 
              info.primaryIndustry || 
              info.jsicMiddleName || 
              info.jsicMajorName || 
              info.businessType || 
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
          console.log(`\n🎉 カテゴリ更新完了: ${updateCount}社を更新しました`);
          console.log('📄 ページをリロードして変更を確認してください');
        }).catch(error => {
          console.error('❌ 更新エラー:', error);
        });
      });
    };
    
  } catch (error) {
    console.error('❌ 更新処理エラー:', error);
  }
};

console.log('🛠️  カテゴリデバッグツールが読み込まれました（修正版）');
console.log('');
console.log('利用可能な関数:');
console.log('0. checkDatabaseStructure() - データベース構造確認');
console.log('1. debugCategoryStatus() - 現在のデータ状況確認');
console.log('2. simulateCategoryRegeneration() - 変更シミュレーション');
console.log('3. updateCategoriesFromIndustryClassification() - 実際の更新実行');
console.log('');
console.log('まず checkDatabaseStructure() を実行してください！');
/**
 * 修正版カテゴリデバッグスクリプト
 * industryClassificationオブジェクト構造に対応
 */

// 企業データとカテゴリ状況を確認（修正版）
window.debugCategoryStatusFixed = async function() {
  console.log('📊 現在のDBカテゴリデータ状況を確認中（修正版）...');
  
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
        
        console.log(`📋 企業データ: ${companies.length}社`);
        console.log(`🏢 企業情報データ: ${companyInfos.length}件`);
        
        // 産業分類データの確認（修正版）
        let withIndustryClassification = 0;
        let sampleClassifications = [];
        
        companyInfos.forEach(info => {
          // industryClassificationオブジェクト内をチェック
          const classification = info.industryClassification;
          if (classification && (
            classification.jsicMajorName || 
            classification.primaryIndustry || 
            classification.businessType
          )) {
            withIndustryClassification++;
            
            if (sampleClassifications.length < 5) {
              sampleClassifications.push({
                companyId: info.companyId,
                jsicMajor: classification.jsicMajorName,
                jsicMiddle: classification.jsicMiddleName,
                primary: classification.primaryIndustry,
                business: classification.businessType
              });
            }
          }
        });
        
        console.log(`産業分類データ有り: ${withIndustryClassification}/${companyInfos.length}件`);
        
        if (sampleClassifications.length > 0) {
          console.log('\n📊 サンプル産業分類データ:');
          console.table(sampleClassifications);
        }
        
        // 企業名も表示
        console.log('\n🏢 産業分類データがある企業:');
        companyInfos.forEach(info => {
          const classification = info.industryClassification;
          if (classification && (
            classification.jsicMajorName || 
            classification.primaryIndustry || 
            classification.businessType
          )) {
            const company = companies.find(c => c.id === info.companyId);
            if (company) {
              console.log(`✅ ${company.name}: 主業界="${classification.primaryIndustry}", 業種="${classification.businessType}"`);
            }
          }
        });
      });
    };
    
  } catch (error) {
    console.error('❌ 修正版確認エラー:', error);
  }
};

// カテゴリ再生成シミュレーション（修正版）
window.simulateCategoryRegenerationFixed = async function() {
  console.log('🔄 新しい優先順位でのカテゴリ再生成をシミュレーション（修正版）...');
  
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
        
        console.log('\n📊 カテゴリ変更シミュレーション結果（修正版）:');
        console.log('現在のカテゴリ → 新しいカテゴリ（主業界優先）\n');
        
        let changeCount = 0;
        let dataAvailableCount = 0;
        
        companies.forEach(company => {
          const info = infoMap[company.id];
          if (info && info.industryClassification) {
            const classification = info.industryClassification;
            
            // 新しい優先順位でカテゴリ生成（主業界優先）
            const newCategory = 
              classification.primaryIndustry || 
              classification.jsicMiddleName || 
              classification.jsicMajorName || 
              classification.businessType || 
              '未分類';
            
            const currentCategory = company.category || '未設定';
            
            if (classification.primaryIndustry || classification.businessType) {
              dataAvailableCount++;
              
              if (currentCategory !== newCategory) {
                console.log(`${company.name}:`);
                console.log(`  現在: "${currentCategory}"`);
                console.log(`  新規: "${newCategory}"`);
                console.log('');
                changeCount++;
              }
            }
          }
        });
        
        console.log(`📈 産業分類データあり: ${dataAvailableCount}/${companies.length}社`);
        console.log(`📈 変更が必要な企業: ${changeCount}/${dataAvailableCount}社`);
        
        if (dataAvailableCount > 0 && changeCount > 0) {
          console.log('\n⚠️  一部企業でカテゴリ更新が推奨されます。');
          console.log('💡 updateCategoriesFromIndustryClassificationFixed() を実行してください。');
        } else if (dataAvailableCount === 0) {
          console.log('\n❌ 産業分類データがある企業がありません。');
        } else {
          console.log('\n✅ カテゴリ更新は不要です。');
        }
      });
    };
    
  } catch (error) {
    console.error('❌ 修正版シミュレーションエラー:', error);
  }
};

console.log('🛠️  修正版カテゴリデバッグツールが読み込まれました');
console.log('');
console.log('利用可能な関数:');
console.log('1. debugCategoryStatusFixed() - 修正版データ状況確認');
console.log('2. simulateCategoryRegenerationFixed() - 修正版変更シミュレーション');
console.log('');
console.log('まず debugCategoryStatusFixed() を実行してください！');
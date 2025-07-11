// companyInfoテーブルの詳細調査
window.debugCompanyInfoDetails = async function() {
  console.log('🔍 companyInfoテーブルの詳細調査...');
  
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
        
        console.log(`📊 企業データ: ${companies.length}社`);
        console.log(`📊 企業情報データ: ${companyInfos.length}件`);
        
        // サンプル企業の詳細確認
        const sampleCompany = companies[0];
        console.log('\n🔍 サンプル企業:', sampleCompany.name);
        console.log('- ID:', sampleCompany.id);
        console.log('- 現在のカテゴリ:', sampleCompany.category);
        
        // 対応するcompanyInfoを探す
        const matchingInfo = companyInfos.find(info => info.companyId === sampleCompany.id);
        
        if (matchingInfo) {
          console.log('\n✅ 対応するcompanyInfo見つかりました:');
          console.log('- companyId:', matchingInfo.companyId);
          console.log('- 全フィールド:', Object.keys(matchingInfo));
          console.log('- jsicMajorName:', matchingInfo.jsicMajorName);
          console.log('- jsicMiddleName:', matchingInfo.jsicMiddleName);
          console.log('- primaryIndustry:', matchingInfo.primaryIndustry);
          console.log('- businessType:', matchingInfo.businessType);
          console.log('- 完全なオブジェクト:', matchingInfo);
        } else {
          console.log('\n❌ 対応するcompanyInfoが見つかりません');
          
          // 先頭3件のcompanyInfoのcompanyIdを確認
          console.log('\n📋 companyInfoの先頭3件のcompanyId:');
          companyInfos.slice(0, 3).forEach(info => {
            console.log(`- ${info.companyId}`);
          });
          
          // 先頭3件の企業のIDを確認
          console.log('\n📋 企業の先頭3件のID:');
          companies.slice(0, 3).forEach(company => {
            console.log(`- ${company.id} (${company.name})`);
          });
        }
        
        // 産業分類データがある企業を探す
        console.log('\n🔍 産業分類データがある企業情報:');
        let foundWithData = 0;
        companyInfos.forEach(info => {
          if (info.jsicMajorName || info.primaryIndustry || info.businessType) {
            if (foundWithData < 3) {
              console.log(`- ${info.companyId}:`);
              console.log(`  jsicMajor: ${info.jsicMajorName}`);
              console.log(`  primary: ${info.primaryIndustry}`);
              console.log(`  business: ${info.businessType}`);
            }
            foundWithData++;
          }
        });
        
        console.log(`\n📊 産業分類データあり: ${foundWithData}/${companyInfos.length}件`);
        
        if (foundWithData === 0) {
          console.log('\n❌ 産業分類データが全く入っていません！');
          console.log('💡 companyInfoの自動取得が失敗している可能性があります');
        }
      });
    };
    
  } catch (error) {
    console.error('❌ 詳細調査エラー:', error);
  }
};

console.log('🛠️ companyInfo詳細デバッグツール読み込み完了');
console.log('実行: debugCompanyInfoDetails()');
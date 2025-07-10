/**
 * 埋め込みベクトルのデバッグ用コード
 * ブラウザコンソールで実行してください
 */

// IndexedDBから企業データを取得してデバッグ
async function debugEmbeddingsIssue() {
  console.log('🔍 埋め込みベクトル問題のデバッグ開始');
  
  try {
    // 1. IndexedDBから企業データを取得
    const companies = await window.db.companies.toArray();
    console.log(`📊 総企業数: ${companies.length}`);
    
    // 2. 企業データの状態を分析
    const statusCounts = {};
    const embeddingsCounts = {
      withEmbeddings: 0,
      withoutEmbeddings: 0,
      mvvExtracted: 0,
      fullyCompleted: 0
    };
    
    const sampleCompanies = [];
    
    companies.forEach(company => {
      // ステータス集計
      statusCounts[company.status] = (statusCounts[company.status] || 0) + 1;
      
      // 埋め込みベクトル集計
      if (company.embeddings && Array.isArray(company.embeddings) && company.embeddings.length > 0) {
        embeddingsCounts.withEmbeddings++;
      } else {
        embeddingsCounts.withoutEmbeddings++;
      }
      
      // MVV抽出済み企業の集計
      if (company.status === 'mvv_extracted') {
        embeddingsCounts.mvvExtracted++;
      }
      
      // 完全完了企業の集計
      if (company.status === 'fully_completed') {
        embeddingsCounts.fullyCompleted++;
      }
      
      // サンプルデータの収集（最初の5社）
      if (sampleCompanies.length < 5) {
        sampleCompanies.push({
          id: company.id,
          name: company.name,
          status: company.status,
          hasEmbeddings: !!(company.embeddings && Array.isArray(company.embeddings) && company.embeddings.length > 0),
          embeddingsLength: company.embeddings ? company.embeddings.length : 0,
          hasMission: !!company.mission,
          hasVision: !!company.vision,
          hasValues: !!company.values,
          category: company.category
        });
      }
    });
    
    console.log('📈 企業ステータス集計:', statusCounts);
    console.log('🎯 埋め込みベクトル集計:', embeddingsCounts);
    console.log('📋 サンプル企業データ:', sampleCompanies);
    
    // 3. 分析に使用されるべき企業をフィルタリング
    const analysisReadyCompanies = companies.filter(company => 
      (company.status === 'mvv_extracted' || company.status === 'fully_completed') && 
      company.embeddings && 
      Array.isArray(company.embeddings) && 
      company.embeddings.length > 0
    );
    
    console.log(`✅ 分析対象企業数: ${analysisReadyCompanies.length}`);
    
    // 4. 問題のある企業を特定
    const problemCompanies = companies.filter(company => 
      (company.status === 'mvv_extracted' || company.status === 'fully_completed') && 
      (!company.embeddings || !Array.isArray(company.embeddings) || company.embeddings.length === 0)
    );
    
    console.log(`⚠️ 問題のある企業数: ${problemCompanies.length}`);
    
    if (problemCompanies.length > 0) {
      console.log('🔍 問題企業の詳細:');
      problemCompanies.slice(0, 10).forEach(company => {
        console.log(`  - ${company.name}: ステータス=${company.status}, 埋め込み=${company.embeddings ? 'あり（長さ:' + company.embeddings.length + '）' : 'なし'}`);
      });
    }
    
    // 5. AnalysisStoreの状態を確認
    if (window.useAnalysisStore) {
      console.log('📊 AnalysisStore状態確認中...');
      const store = window.useAnalysisStore.getState();
      console.log('AnalysisStore data:', store.data);
      console.log('AnalysisStore isLoading:', store.isLoading);
      console.log('AnalysisStore error:', store.error);
      
      // getFilteredCompanies()の結果を確認
      const filteredCompanies = store.getFilteredCompanies();
      console.log(`🎯 フィルタ済み企業数: ${filteredCompanies.length}`);
      
      if (filteredCompanies.length > 0) {
        const embeddingsAnalysis = filteredCompanies.map(company => ({
          name: company.name,
          hasEmbeddings: !!(company.embeddings && Array.isArray(company.embeddings) && company.embeddings.length > 0),
          embeddingsLength: company.embeddings ? company.embeddings.length : 0,
          source: company.source
        }));
        
        console.log('📋 フィルタ済み企業の埋め込み状況:', embeddingsAnalysis.slice(0, 10));
        
        const withEmbeddings = embeddingsAnalysis.filter(c => c.hasEmbeddings).length;
        const withoutEmbeddings = embeddingsAnalysis.filter(c => !c.hasEmbeddings).length;
        
        console.log(`✅ 埋め込みあり: ${withEmbeddings}, ❌ 埋め込みなし: ${withoutEmbeddings}`);
      }
    }
    
    // 6. 推奨修正アクション
    console.log('\n🔧 推奨修正アクション:');
    
    if (embeddingsCounts.withoutEmbeddings > 0) {
      console.log('1. 埋め込みベクトルが不足している企業に対して、MVV抽出を再実行してください');
      console.log('2. APIレスポンスに埋め込みベクトルが含まれているかを確認してください');
    }
    
    if (analysisReadyCompanies.length === 0) {
      console.log('3. 分析対象企業が存在しません。企業管理画面でMVV抽出を実行してください');
    }
    
    console.log('4. 問題が続く場合は、analysisStore.loadAnalysisData(true)を実行してデータを強制再読み込みしてください');
    
    return {
      totalCompanies: companies.length,
      statusCounts,
      embeddingsCounts,
      analysisReadyCompanies: analysisReadyCompanies.length,
      problemCompanies: problemCompanies.length,
      sampleCompanies,
      problemCompaniesDetails: problemCompanies.slice(0, 5).map(c => ({
        name: c.name,
        status: c.status,
        hasEmbeddings: !!(c.embeddings && Array.isArray(c.embeddings) && c.embeddings.length > 0)
      }))
    };
    
  } catch (error) {
    console.error('❌ デバッグ中にエラーが発生:', error);
    throw error;
  }
}

// 埋め込みベクトルを強制的に再生成する関数
async function regenerateEmbeddingsForCompany(companyId) {
  console.log(`🔄 ${companyId} の埋め込みベクトルを再生成中...`);
  
  try {
    // 1. 企業データを取得
    const company = await window.db.companies.get(companyId);
    if (!company) {
      throw new Error(`企業 ${companyId} が見つかりません`);
    }
    
    console.log(`📊 企業: ${company.name}, ステータス: ${company.status}`);
    
    // 2. MVVデータが存在するかチェック
    if (!company.mission && !company.vision && !company.values) {
      console.log('⚠️ MVVデータが存在しません。MVV抽出を先に実行してください');
      return false;
    }
    
    // 3. 埋め込みベクトルの再生成（実際のAPI呼び出し）
    // 注意: この部分は実際の実装に応じて調整が必要
    console.log('🎯 埋め込みベクトル再生成はMVV抽出APIを通じて実行する必要があります');
    console.log('企業管理画面でMVV抽出を再実行してください');
    
    return true;
    
  } catch (error) {
    console.error('❌ 埋め込みベクトル再生成中にエラー:', error);
    throw error;
  }
}

// AnalysisStoreの強制リロード
async function forceReloadAnalysisData() {
  console.log('🔄 AnalysisDataを強制リロード中...');
  
  try {
    if (window.useAnalysisStore) {
      const store = window.useAnalysisStore.getState();
      await store.loadAnalysisData(true);
      console.log('✅ AnalysisDataのリロード完了');
      
      // 再度状態を確認
      const newState = window.useAnalysisStore.getState();
      const filteredCompanies = newState.getFilteredCompanies();
      console.log(`📊 リロード後のフィルタ済み企業数: ${filteredCompanies.length}`);
      
      return filteredCompanies.length;
    } else {
      console.log('❌ useAnalysisStoreが利用できません');
      return 0;
    }
  } catch (error) {
    console.error('❌ AnalysisDataリロード中にエラー:', error);
    throw error;
  }
}

// キャッシュクリア関数
async function clearAnalysisCache() {
  console.log('🧹 分析キャッシュをクリア中...');
  
  try {
    // LocalStorageからキャッシュを削除
    localStorage.removeItem('mvv-hybrid-cache');
    localStorage.removeItem('mvv-hybrid-cache_emergency');
    
    // AnalysisStoreのキャッシュもクリア
    if (window.useAnalysisStore) {
      const store = window.useAnalysisStore.getState();
      if (store.clearCache) {
        store.clearCache();
      }
    }
    
    console.log('✅ キャッシュクリア完了');
    console.log('🔄 ページをリロードしてください');
    
  } catch (error) {
    console.error('❌ キャッシュクリア中にエラー:', error);
    throw error;
  }
}

// 使用方法を表示
console.log('🔧 埋め込みベクトルデバッグ関数が利用可能です:');
console.log('1. debugEmbeddingsIssue() - 問題を診断');
console.log('2. forceReloadAnalysisData() - AnalysisDataを強制リロード');
console.log('3. clearAnalysisCache() - 分析キャッシュをクリア');
console.log('4. regenerateEmbeddingsForCompany(companyId) - 特定企業の埋め込み再生成');
console.log('\n実行例: await debugEmbeddingsIssue()');
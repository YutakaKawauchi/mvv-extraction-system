import type { Company, CompanyStatus } from '../types';

export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const chunk = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const groupCompaniesByStatus = (companies: Company[]): Record<CompanyStatus, Company[]> => {
  return companies.reduce((acc, company) => {
    if (!acc[company.status]) {
      acc[company.status] = [];
    }
    acc[company.status].push(company);
    return acc;
  }, {} as Record<CompanyStatus, Company[]>);
};

export const downloadFile = (content: string, filename: string, type: string = 'text/plain'): void => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
};

// 開発用デバッグヘルパー（プロダクションでは使用しない）
export const devHelpers = {
  testErrorMessageClearInstructions() {
    if (import.meta.env.PROD) {
      console.warn('このヘルパーは開発環境でのみ使用できます');
      return;
    }
    
    console.log('💡 エラーメッセージクリア機能をテストする手順:');
    console.log('1. 企業管理画面でエラー状態の企業を確認');
    console.log('2. MVV抽出画面でその企業を選択して再実行');
    console.log('3. 成功後、企業カードでエラーメッセージが消えることを確認');
    console.log('4. 結果表示画面でもエラーメッセージが表示されないことを確認');
    console.log('');
    console.log('📋 確認ポイント:');
    console.log('- CompanyCard: エラーメッセージ枠が非表示になる');
    console.log('- ExtractionQueue: エラーメッセージが表示されない');  
    console.log('- ResultsTable: エラーメッセージ行が表示されない');
  },

  testDuplicateImportInstructions() {
    if (import.meta.env.PROD) {
      console.warn('このヘルパーは開発環境でのみ使用できます');
      return;
    }
    
    console.log('💡 重複チェック機能をテストする手順:');
    console.log('1. 企業管理画面で既存企業の名前とURLを確認');
    console.log('2. 同じ名前とURLを含むCSVファイルを作成');
    console.log('3. CSVインポートを実行');
    console.log('4. "インポート完了（重複あり）"メッセージを確認');
    console.log('5. 既存企業が重複して追加されていないことを確認');
    console.log('');
    console.log('📋 重複判定条件:');
    console.log('- 企業名とURLが完全一致（大文字小文字無視）');
    console.log('- 前後の空白文字は自動で除去');
    console.log('- 重複した場合はスキップ（既存データは保持）');
  }
};
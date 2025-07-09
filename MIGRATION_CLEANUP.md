# 📋 一時的なマイグレーション機能の削除方法

このドキュメントは、既存企業データの企業情報マイグレーションが完了した後に、一時的なマイグレーション機能を削除する手順を説明します。

## 🗓️ 削除タイミング
- 全ての既存企業の企業情報マイグレーションが完了後
- 新規企業登録時の自動連携機能が実装完了後

## 🔧 削除対象ファイル・コード

### 1. 完全削除するファイル
```bash
# マイグレーション専用コンポーネント
rm frontend/src/components/CompanyManager/CompanyInfoMigrationPanel.tsx

# このドキュメント自体
rm MIGRATION_CLEANUP.md
```

### 2. コード修正が必要なファイル

#### `frontend/src/utils/constants.ts`
```typescript
// 削除: 一時的な機能フラグ
- FEATURES: {
-   COMPANY_INFO_MIGRATION: import.meta.env.VITE_ENVIRONMENT === 'development',
- },
```

#### `frontend/src/components/CompanyManager/CompanyList.tsx`
```typescript
// 削除: インポート
- import { CompanyInfoMigrationPanel } from './CompanyInfoMigrationPanel';
- Database

// 削除: state
- const [showMigrationPanel, setShowMigrationPanel] = useState(false);

// 削除: マイグレーションボタン（行312-322周辺）
- {CONSTANTS.FEATURES.COMPANY_INFO_MIGRATION && (
-   <Button 
-     variant="outline" 
-     onClick={() => setShowMigrationPanel(true)}
-     className="w-full sm:w-auto bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
-   >
-     <Database className="w-4 h-4 mr-2" />
-     <span className="hidden sm:inline">企業情報移行</span>
-     <span className="sm:hidden">移行</span>
-   </Button>
- )}

// 削除: マイグレーションパネル（行570-585周辺）
- {CONSTANTS.FEATURES.COMPANY_INFO_MIGRATION && showMigrationPanel && (
-   <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
-     <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
-       <div className="flex items-center justify-between p-4 border-b">
-         <h2 className="text-xl font-semibold text-gray-900">企業情報移行パネル</h2>
-         <button onClick={() => setShowMigrationPanel(false)} className="text-gray-400 hover:text-gray-600">×</button>
-       </div>
-       <div className="p-4">
-         <CompanyInfoMigrationPanel />
-       </div>
-     </div>
-   </div>
- )}
```

#### `frontend/src/services/dataMigration.ts`
```typescript
// 保持: CompanyInfoMigrationService クラスは継続利用
// - batchExtractCompanyInfo メソッドは新規企業の自動処理に使用可能
// - extractAndSaveCompanyInfo メソッドも単体処理に有用

// オプション: 不要になったメソッドのみ削除
- getCompaniesNeedingInfo(): 既存データ専用
- getCompanyInfoStats(): UI表示専用  
- resetCompanyInfo(): 開発用
```

## ⚡ 簡単削除コマンド

マイグレーション完了後、以下のコマンドで一括削除できます：

```bash
# 1. ファイル削除
rm frontend/src/components/CompanyManager/CompanyInfoMigrationPanel.tsx
rm MIGRATION_CLEANUP.md

# 2. 自動的なコード修正（注意: 手動確認推奨）
# constants.ts の FEATURES セクション削除
sed -i '/FEATURES: {/,/},/d' frontend/src/utils/constants.ts

# 3. CompanyList.tsx の修正は手動で行うことを推奨
echo "⚠️  CompanyList.tsx の修正は手動で行ってください"
echo "📍 削除対象: インポート文、state、マイグレーションボタン、モーダル"
```

## 🔄 代替機能の実装

マイグレーション機能削除後は、以下の自動連携機能で対応：

### 新規企業登録時の自動処理
```typescript
// CompanyForm.tsx または AddCompanySection.tsx
async function addCompanyWithFullInfo(formData: CompanyFormData) {
  // 1. 企業登録
  const company = await addCompany(formData);
  
  // 2. MVV抽出 → 企業情報取得の自動連携
  await processNewCompanyFull(company);
}
```

## ✅ 削除完了チェックリスト

- [ ] CompanyInfoMigrationPanel.tsx 削除
- [ ] constants.ts の FEATURES セクション削除  
- [ ] CompanyList.tsx のマイグレーション関連コード削除
- [ ] インポート文の Database 削除
- [ ] ビルドエラーがないことを確認
- [ ] 新規企業登録の自動連携が動作することを確認
- [ ] MIGRATION_CLEANUP.md 削除

## 📝 注意事項

- **データ損失はありません**: 取得済みの企業情報はそのまま保持されます
- **機能はそのまま**: CompanyInfoMigrationService の核心機能は継続利用可能
- **段階的削除**: 一度に全て削除せず、段階的に削除することも可能

---
*作成日: 2025-07-09*  
*マイグレーション機能完了後に削除予定*
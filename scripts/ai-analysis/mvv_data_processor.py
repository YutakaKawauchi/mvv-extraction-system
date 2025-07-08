#!/usr/bin/env python3
"""
MVV データ前処理スクリプト
95社のMVVデータを読み込み、分析用に前処理を実行
"""

import pandas as pd
import json
import os
from typing import Dict, List, Optional
from datetime import datetime

class MVVDataProcessor:
    def __init__(self, csv_path: str):
        """
        MVVデータプロセッサの初期化
        
        Args:
            csv_path: MVVデータCSVファイルのパス
        """
        self.csv_path = csv_path
        self.data = None
        self.processed_data = None
        
    def load_data(self) -> pd.DataFrame:
        """CSVファイルを読み込み、基本的なデータクリーニングを実行"""
        try:
            # CSVファイル読み込み（BOM対応）
            self.data = pd.read_csv(self.csv_path, encoding='utf-8-sig')
            
            print(f"✅ データ読み込み完了: {len(self.data)} 社")
            print(f"📊 カラム: {list(self.data.columns)}")
            
            # 基本統計情報
            self._print_basic_stats()
            
            return self.data
            
        except Exception as e:
            print(f"❌ データ読み込みエラー: {e}")
            raise
    
    def _print_basic_stats(self):
        """基本統計情報を表示"""
        print("\n📈 基本統計情報:")
        print(f"・総企業数: {len(self.data)}")
        print(f"・完了ステータス: {len(self.data[self.data['status'] == 'completed'])}")
        print(f"・業界カテゴリ数: {self.data['category'].nunique()}")
        
        # 業界別企業数
        category_counts = self.data['category'].value_counts()
        print(f"\n🏢 業界別企業数:")
        for category, count in category_counts.head(10).items():
            print(f"  {category}: {count}社")
        
        # MVVデータの完全性チェック
        mission_filled = len(self.data[self.data['mission'].notna() & (self.data['mission'] != '')])
        vision_filled = len(self.data[self.data['vision'].notna() & (self.data['vision'] != '')])
        values_filled = len(self.data[self.data['values'].notna() & (self.data['values'] != '')])
        
        print(f"\n📝 MVVデータ完全性:")
        print(f"  Mission: {mission_filled}/{len(self.data)} ({mission_filled/len(self.data)*100:.1f}%)")
        print(f"  Vision: {vision_filled}/{len(self.data)} ({vision_filled/len(self.data)*100:.1f}%)")
        print(f"  Values: {values_filled}/{len(self.data)} ({values_filled/len(self.data)*100:.1f}%)")
    
    def preprocess_mvv_data(self) -> List[Dict]:
        """MVVデータを分析用形式に前処理"""
        processed_companies = []
        
        for idx, row in self.data.iterrows():
            try:
                # MVVテキストのクリーニング
                mission = self._clean_text(row.get('mission', ''))
                vision = self._clean_text(row.get('vision', ''))
                values = self._clean_text(row.get('values', ''))
                
                # 統合MVVテキスト作成（類似性分析用）
                combined_mvv = self._create_combined_mvv(mission, vision, values)
                
                company_data = {
                    'id': f"company_{idx+1}",
                    'name': row.get('companyName', ''),
                    'website': row.get('website', ''),
                    'category': row.get('category', ''),
                    'mission': mission,
                    'vision': vision,
                    'values': values,
                    'combined_mvv': combined_mvv,
                    'confidence_scores': {
                        'mission': float(row.get('missionConfidence', 0.0)),
                        'vision': float(row.get('visionConfidence', 0.0)),
                        'values': float(row.get('valuesConfidence', 0.0))
                    },
                    'extraction_source': row.get('extractionSource', ''),
                    'extracted_from': row.get('extractedFrom', ''),
                    'has_complete_mvv': bool(mission and vision and values)
                }
                
                processed_companies.append(company_data)
                
            except Exception as e:
                print(f"⚠️  企業データ処理エラー (行 {idx+1}): {e}")
                continue
        
        self.processed_data = processed_companies
        print(f"\n✅ 前処理完了: {len(processed_companies)} 社のデータを処理")
        
        return processed_companies
    
    def _clean_text(self, text: str) -> str:
        """テキストのクリーニング処理"""
        if pd.isna(text) or text == '':
            return ''
        
        # 基本的なクリーニング
        text = str(text).strip()
        # セミコロンで区切られたValues等の処理
        if ';' in text:
            text = text.replace(';', '、')
        
        return text
    
    def _create_combined_mvv(self, mission: str, vision: str, values: str) -> str:
        """Mission, Vision, Valuesを結合したテキストを作成"""
        parts = []
        
        if mission:
            parts.append(f"Mission: {mission}")
        if vision:
            parts.append(f"Vision: {vision}")
        if values:
            parts.append(f"Values: {values}")
        
        return " | ".join(parts)
    
    def get_analysis_ready_data(self) -> Dict:
        """分析用データ形式で返却"""
        if not self.processed_data:
            raise ValueError("データが前処理されていません。preprocess_mvv_data()を先に実行してください。")
        
        # 完全なMVVデータを持つ企業のみフィルタ
        complete_mvv_companies = [
            company for company in self.processed_data 
            if company['has_complete_mvv']
        ]
        
        # 業界別グループ化
        by_category = {}
        for company in complete_mvv_companies:
            category = company['category']
            if category not in by_category:
                by_category[category] = []
            by_category[category].append(company)
        
        analysis_data = {
            'total_companies': len(self.processed_data),
            'complete_mvv_companies': len(complete_mvv_companies),
            'companies': complete_mvv_companies,
            'by_category': by_category,
            'categories': list(by_category.keys()),
            'processed_at': datetime.now().isoformat()
        }
        
        print(f"\n📊 分析用データ準備完了:")
        print(f"  完全MVVデータ: {len(complete_mvv_companies)}/{len(self.processed_data)} 社")
        print(f"  業界カテゴリ: {len(by_category)} 種類")
        
        return analysis_data
    
    def save_processed_data(self, output_path: str):
        """前処理済みデータをJSONファイルに保存"""
        try:
            analysis_data = self.get_analysis_ready_data()
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(analysis_data, f, ensure_ascii=False, indent=2)
            
            print(f"💾 前処理済みデータ保存完了: {output_path}")
            
        except Exception as e:
            print(f"❌ データ保存エラー: {e}")
            raise

def main():
    """メイン実行関数"""
    print("🚀 MVV データ前処理スクリプト開始\n")
    
    # ファイルパス設定
    csv_path = "../data/analysis-data/mvv-data-95companies.csv"
    output_path = "../data/analysis-data/processed/preprocessed_mvv_data.json"
    
    # 出力ディレクトリ作成
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    try:
        # データ処理実行
        processor = MVVDataProcessor(csv_path)
        processor.load_data()
        processor.preprocess_mvv_data()
        processor.save_processed_data(output_path)
        
        print(f"\n🎉 前処理完了! 次のステップ:")
        print(f"  1. {output_path} で前処理結果を確認")
        print(f"  2. embedding_generator.py でベクトル埋め込み生成")
        print(f"  3. similarity_analyzer.py で類似性分析実行")
        
    except Exception as e:
        print(f"\n❌ 処理失敗: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())
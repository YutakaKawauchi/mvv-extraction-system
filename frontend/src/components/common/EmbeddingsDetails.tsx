import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { findMostSimilar } from '../../services/openai';
import { useCompanyStore } from '../../stores/companyStore';
import type { Company } from '../../types';
import { 
  Brain, 
  BarChart3, 
  TrendingUp, 
  Users, 
  Eye,
  EyeOff,
  Info,
  Sparkles
} from 'lucide-react';

interface EmbeddingsDetailsProps {
  company: Company;
  embeddings: number[];
  onClose: () => void;
}

export const EmbeddingsDetails: React.FC<EmbeddingsDetailsProps> = ({
  company,
  embeddings,
  onClose
}) => {
  const { companies } = useCompanyStore();
  const [showRawData, setShowRawData] = useState(false);
  const [similarCompanies, setSimilarCompanies] = useState<Array<{
    company: Company;
    similarity: number;
  }>>([]);
  const [embeddingsStats, setEmbeddingsStats] = useState<{
    dimensions: number;
    magnitude: number;
    average: number;
    variance: number;
    min: number;
    max: number;
  } | null>(null);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    // Calculate embeddings statistics
    const dimensions = embeddings.length;
    const sum = embeddings.reduce((a, b) => a + b, 0);
    const average = sum / dimensions;
    const variance = embeddings.reduce((acc, val) => acc + Math.pow(val - average, 2), 0) / dimensions;
    const magnitude = Math.sqrt(embeddings.reduce((acc, val) => acc + val * val, 0));
    const min = Math.min(...embeddings);
    const max = Math.max(...embeddings);

    setEmbeddingsStats({
      dimensions,
      magnitude,
      average,
      variance,
      min,
      max
    });

    // Find similar companies
    const otherCompanies = companies.filter(c => 
      c.id !== company.id && 
      c.embeddings && 
      c.embeddings.length > 0
    );

    const embeddingData = otherCompanies.map(c => ({
      id: c.id,
      embedding: c.embeddings!
    }));

    const similarities = findMostSimilar(embeddings, embeddingData, 5);
    
    const similarResults = similarities.map(sim => {
      const relatedCompany = otherCompanies.find(c => c.id === sim.id);
      return {
        company: relatedCompany!,
        similarity: sim.similarity
      };
    }).filter(result => result.company);

    setSimilarCompanies(similarResults);
  }, [embeddings, companies, company.id]);

  const getSimilarityColor = (similarity: number) => {
    if (similarity > 0.8) return 'text-green-600';
    if (similarity > 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatNumber = (num: number, decimals: number = 6) => {
    return num.toFixed(decimals);
  };

  return (
    <div 
      className="fixed inset-0 bg-gray-500/75 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <Brain className="mr-2 h-5 w-5 text-purple-500" />
                Embeddings詳細: {company.name}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                OpenAI text-embedding-3-small によるベクトル化データ
              </p>
            </div>
            <Button variant="outline" onClick={onClose}>
              閉じる
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Embeddings Statistics */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <BarChart3 className="mr-2 h-5 w-5 text-blue-500" />
              ベクトル統計情報
            </h3>
            
            {embeddingsStats && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-white p-3 rounded border">
                  <div className="text-gray-600">次元数</div>
                  <div className="text-lg font-semibold">{embeddingsStats.dimensions}</div>
                </div>
                <div className="bg-white p-3 rounded border">
                  <div className="text-gray-600">ベクトル長</div>
                  <div className="text-lg font-semibold">{formatNumber(embeddingsStats.magnitude, 3)}</div>
                </div>
                <div className="bg-white p-3 rounded border">
                  <div className="text-gray-600">平均値</div>
                  <div className="text-lg font-semibold">{formatNumber(embeddingsStats.average, 6)}</div>
                </div>
                <div className="bg-white p-3 rounded border">
                  <div className="text-gray-600">分散</div>
                  <div className="text-lg font-semibold">{formatNumber(embeddingsStats.variance, 6)}</div>
                </div>
                <div className="bg-white p-3 rounded border">
                  <div className="text-gray-600">最小値</div>
                  <div className="text-lg font-semibold">{formatNumber(embeddingsStats.min, 6)}</div>
                </div>
                <div className="bg-white p-3 rounded border">
                  <div className="text-gray-600">最大値</div>
                  <div className="text-lg font-semibold">{formatNumber(embeddingsStats.max, 6)}</div>
                </div>
              </div>
            )}
          </div>

          {/* Similar Companies */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Users className="mr-2 h-5 w-5 text-green-500" />
              類似企業（トップ5）
            </h3>
            
            {similarCompanies.length > 0 ? (
              <div className="space-y-3">
                {similarCompanies.map((item, index) => (
                  <div key={item.company.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                    <div className="flex items-center space-x-3">
                      <div className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium">{item.company.name}</div>
                        <div className="text-sm text-gray-600">{item.company.category}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-semibold ${getSimilarityColor(item.similarity)}`}>
                        {(item.similarity * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500">
                        類似度
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p>比較可能な企業がありません</p>
                <p className="text-sm mt-1">他の企業のEmbeddingsが生成されていません</p>
              </div>
            )}
          </div>

          {/* MVV Text */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Sparkles className="mr-2 h-5 w-5 text-orange-500" />
              対応するMVVテキスト
            </h3>
            
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              {company.mission && (
                <div>
                  <div className="font-medium text-gray-700">Mission:</div>
                  <div className="text-gray-900">{company.mission}</div>
                </div>
              )}
              {company.vision && (
                <div>
                  <div className="font-medium text-gray-700">Vision:</div>
                  <div className="text-gray-900">{company.vision}</div>
                </div>
              )}
              {company.values && (
                <div>
                  <div className="font-medium text-gray-700">Values:</div>
                  <div className="text-gray-900">{company.values}</div>
                </div>
              )}
            </div>
          </div>

          {/* Raw Embeddings Data */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <TrendingUp className="mr-2 h-5 w-5 text-purple-500" />
                生ベクトルデータ
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRawData(!showRawData)}
              >
                {showRawData ? (
                  <>
                    <EyeOff className="mr-2 h-4 w-4" />
                    隠す
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    表示
                  </>
                )}
              </Button>
            </div>
            
            {showRawData && (
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-auto max-h-64">
                <div className="flex items-center mb-2">
                  <Info className="mr-2 h-4 w-4" />
                  <span className="text-gray-300">
                    {embeddings.length}次元のベクトル（最初の100次元を表示）
                  </span>
                </div>
                <div className="grid grid-cols-10 gap-1">
                  {embeddings.slice(0, 100).map((value, index) => (
                    <div key={index} className="text-right">
                      {formatNumber(value, 4)}
                    </div>
                  ))}
                </div>
                {embeddings.length > 100 && (
                  <div className="text-center mt-2 text-gray-400">
                    ... 残り{embeddings.length - 100}次元
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
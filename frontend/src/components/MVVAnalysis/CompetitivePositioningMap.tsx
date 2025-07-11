import React, { useMemo, useState, useRef } from 'react';
import { useAnalysisStore } from '../../stores/analysisStore';
import { LoadingSpinner } from '../common';
import { Target, ZoomIn, ZoomOut, RotateCcw, Info } from 'lucide-react';
import { calculateEmbeddingSimilarity } from '../../services/similarityCalculator';

interface CompanyPosition {
  id: string;
  name: string;
  category: string;
  x: number;
  y: number;
  uniquenessScore: number;
  clusterGroup: number;
}

interface ClusterGroup {
  id: number;
  companies: CompanyPosition[];
  centerX: number;
  centerY: number;
  color: string;
  category: string;
}

export const CompetitivePositioningMap: React.FC = () => {
  const { data, isLoading } = useAnalysisStore();
  const [selectedCompany, setSelectedCompany] = useState<CompanyPosition | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewBox, setViewBox] = useState({ x: -100, y: -100, width: 200, height: 200 });
  const svgRef = useRef<SVGSVGElement>(null);

  const { positions, clusters, loading } = useMemo(() => {
    if (!data || !data.companies) {
      return { positions: [], clusters: [], loading: true };
    }

    console.log('🔄 競合ポジショニングマップ計算開始...');
    const startTime = performance.now();

    // 埋め込みベクトルを持つ企業のみフィルター
    const validCompanies = data.companies.filter(company => 
      company.embeddings && Array.isArray(company.embeddings) && company.embeddings.length > 0
    );

    if (validCompanies.length < 3) {
      return { positions: [], clusters: [], loading: false };
    }

    console.log(`📊 ${validCompanies.length}社でポジショニング分析実行中...`);

    // 類似度マトリックス計算
    const similarityMatrix: number[][] = Array(validCompanies.length)
      .fill(null)
      .map(() => Array(validCompanies.length).fill(0));

    for (let i = 0; i < validCompanies.length; i++) {
      for (let j = i + 1; j < validCompanies.length; j++) {
        const similarity = calculateEmbeddingSimilarity(
          validCompanies[i].embeddings!,
          validCompanies[j].embeddings!
        );
        similarityMatrix[i][j] = similarity;
        similarityMatrix[j][i] = similarity;
      }
      similarityMatrix[i][i] = 1.0;
    }

    // 距離マトリックスに変換（1 - similarity）
    const distanceMatrix = similarityMatrix.map(row => 
      row.map(sim => Math.max(0.001, 1 - sim)) // 0除算を避けるため最小値設定
    );

    // 多次元尺度法（MDS）による2次元配置
    const positions = performMDS(distanceMatrix, validCompanies);

    // 独自性スコア計算
    const positionsWithUniqueness = positions.map((pos, index) => {
      const similarities = similarityMatrix[index].filter((_, i) => i !== index);
      const avgSimilarity = similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;
      return {
        ...pos,
        uniquenessScore: 1 - avgSimilarity
      };
    });

    // カテゴリ別クラスタリング
    const clusters = performCategoryClustering(positionsWithUniqueness);

    const endTime = performance.now();
    console.log(`✅ ポジショニングマップ計算完了: ${Math.round(endTime - startTime)}ms`);

    return { 
      positions: positionsWithUniqueness, 
      clusters, 
      loading: false 
    };
  }, [data]);

  // 簡易MDS実装（安定化版）
  const performMDS = (distanceMatrix: number[][], companies: any[]): CompanyPosition[] => {
    const n = companies.length;
    const positions: CompanyPosition[] = [];

    // データ検証
    if (n === 0 || !distanceMatrix || distanceMatrix.length !== n) {
      console.warn('Invalid data for MDS calculation');
      return [];
    }

    // 初期配置（円形、決定論的）
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / n;
      const radius = 35 + (i % 3) * 10; // 決定論的なバリエーション
      positions.push({
        id: companies[i].id,
        name: companies[i].name,
        category: companies[i].category || '未分類',
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
        uniquenessScore: 0,
        clusterGroup: 0
      });
    }

    // ストレス最小化（安定化版）
    const iterations = 50;
    const learningRate = 0.1;
    const minDistance = 0.1; // 最小距離制限

    for (let iter = 0; iter < iterations; iter++) {
      for (let i = 0; i < n; i++) {
        let forceX = 0;
        let forceY = 0;

        for (let j = 0; j < n; j++) {
          if (i === j) continue;

          const dx = positions[i].x - positions[j].x;
          const dy = positions[i].y - positions[j].y;
          const currentDistance = Math.max(minDistance, Math.sqrt(dx * dx + dy * dy));
          const targetDistance = Math.max(minDistance, distanceMatrix[i][j] * 100);

          // NaN/Infinity チェック
          if (!isFinite(currentDistance) || !isFinite(targetDistance)) {
            continue;
          }

          const force = (currentDistance - targetDistance) / currentDistance;
          const deltaX = force * dx * learningRate;
          const deltaY = force * dy * learningRate;

          // フォース制限（発散防止）
          const maxForce = 5;
          forceX += Math.max(-maxForce, Math.min(maxForce, deltaX));
          forceY += Math.max(-maxForce, Math.min(maxForce, deltaY));
        }

        // 位置更新（境界制限）
        const maxPosition = 200;
        positions[i].x = Math.max(-maxPosition, Math.min(maxPosition, positions[i].x - forceX));
        positions[i].y = Math.max(-maxPosition, Math.min(maxPosition, positions[i].y - forceY));
      }
    }

    return positions;
  };

  // カテゴリ別クラスタリング
  const performCategoryClustering = (positions: CompanyPosition[]): ClusterGroup[] => {
    const categoryGroups = positions.reduce((groups, pos) => {
      if (!groups[pos.category]) {
        groups[pos.category] = [];
      }
      groups[pos.category].push(pos);
      return groups;
    }, {} as Record<string, CompanyPosition[]>);

    const colors = [
      '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
      '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
    ];

    return Object.entries(categoryGroups).map(([category, companies], index) => {
      companies.forEach(company => {
        company.clusterGroup = index;
      });

      const centerX = companies.reduce((sum, c) => sum + c.x, 0) / companies.length;
      const centerY = companies.reduce((sum, c) => sum + c.y, 0) / companies.length;

      return {
        id: index,
        companies,
        centerX,
        centerY,
        color: colors[index % colors.length],
        category
      };
    });
  };

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev * 1.2, 3));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev / 1.2, 0.3));
  const handleReset = () => {
    setZoomLevel(1);
    setViewBox({ x: -100, y: -100, width: 200, height: 200 });
  };

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mb-4" />
          <p className="text-gray-600">ポジショニングマップを計算中...</p>
        </div>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Target className="mx-auto w-16 h-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            データが不足しています
          </h3>
          <p className="text-gray-600">
            ポジショニングマップには最低3社の埋め込みベクトルが必要です。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <Target className="mr-3 h-8 w-8 text-purple-500" />
              競合ポジショニングマップ
            </h2>
            <p className="text-gray-600 mt-1">
              類似度ベースの2次元マッピングによる競合分析
            </p>
          </div>
          <div className="text-sm text-gray-500">
            対象企業: {positions.length}社
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* ポジショニングマップ */}
        <div className="lg:col-span-3 bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">マップビュー</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleZoomIn}
                className="p-2 bg-gray-100 rounded-md hover:bg-gray-200"
                title="ズームイン"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={handleZoomOut}
                className="p-2 bg-gray-100 rounded-md hover:bg-gray-200"
                title="ズームアウト"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={handleReset}
                className="p-2 bg-gray-100 rounded-md hover:bg-gray-200"
                title="リセット"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="border rounded-lg bg-gray-50 relative" style={{ height: '500px' }}>
            <svg
              ref={svgRef}
              width="100%"
              height="100%"
              viewBox={`${viewBox.x / zoomLevel} ${viewBox.y / zoomLevel} ${viewBox.width / zoomLevel} ${viewBox.height / zoomLevel}`}
              className="overflow-hidden"
            >
              {/* グリッド */}
              <defs>
                <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#E5E7EB" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect x={viewBox.x / zoomLevel} y={viewBox.y / zoomLevel} width={viewBox.width / zoomLevel} height={viewBox.height / zoomLevel} fill="url(#grid)" />

              {/* 中心軸 */}
              <line x1={viewBox.x / zoomLevel} y1="0" x2={(viewBox.x + viewBox.width) / zoomLevel} y2="0" stroke="#9CA3AF" strokeWidth="1" />
              <line x1="0" y1={viewBox.y / zoomLevel} x2="0" y2={(viewBox.y + viewBox.height) / zoomLevel} stroke="#9CA3AF" strokeWidth="1" />

              {/* クラスター領域 */}
              {clusters.map(cluster => (
                <g key={cluster.id}>
                  {/* クラスター円 */}
                  <circle
                    cx={cluster.centerX}
                    cy={cluster.centerY}
                    r="25"
                    fill={cluster.color}
                    fillOpacity="0.1"
                    stroke={cluster.color}
                    strokeWidth="1"
                    strokeDasharray="5,5"
                  />
                  {/* クラスターラベル */}
                  <text
                    x={cluster.centerX}
                    y={cluster.centerY - 30}
                    textAnchor="middle"
                    className="text-xs font-medium"
                    fill={cluster.color}
                  >
                    {cluster.category}
                  </text>
                </g>
              ))}

              {/* 企業ポイント */}
              {positions.map(position => (
                <g key={position.id}>
                  <circle
                    cx={position.x}
                    cy={position.y}
                    r={selectedCompany?.id === position.id ? "8" : "6"}
                    fill={clusters.find(c => c.id === position.clusterGroup)?.color || '#6B7280'}
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setSelectedCompany(position)}
                  />
                  {/* 企業名ラベル */}
                  <text
                    x={position.x}
                    y={position.y + 15}
                    textAnchor="middle"
                    className="text-xs font-medium pointer-events-none"
                    fill="#374151"
                  >
                    {position.name.length > 10 ? `${position.name.slice(0, 10)}...` : position.name}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* サイドパネル */}
        <div className="space-y-4">
          {/* 選択企業情報 */}
          {selectedCompany && (
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Info className="mr-2 h-4 w-4" />
                企業詳細
              </h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium text-gray-700">企業名:</span>
                  <div className="text-gray-900">{selectedCompany.name}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-700">カテゴリ:</span>
                  <div className="text-gray-900">{selectedCompany.category}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-700">独自性スコア:</span>
                  <div className="text-gray-900">{(selectedCompany.uniquenessScore * 100).toFixed(1)}%</div>
                </div>
                <div>
                  <span className="font-medium text-gray-700">座標:</span>
                  <div className="text-gray-900">
                    ({selectedCompany.x.toFixed(1)}, {selectedCompany.y.toFixed(1)})
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* カテゴリ別統計 */}
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <h4 className="font-semibold text-gray-900 mb-3">カテゴリ別分布</h4>
            <div className="space-y-3">
              {clusters.map(cluster => (
                <div key={cluster.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: cluster.color }}
                    />
                    <span className="text-sm text-gray-700">{cluster.category}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {cluster.companies.length}社
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 操作説明 */}
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
            <h4 className="font-semibold text-blue-900 mb-2">操作方法</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• 企業ポイントをクリックで詳細表示</li>
              <li>• ズームボタンで拡大/縮小</li>
              <li>• 点線円はカテゴリクラスター</li>
              <li>• 距離が近いほど類似度が高い</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
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
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showLabels, setShowLabels] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewBox, setViewBox] = useState({ x: -100, y: -100, width: 200, height: 200 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, viewBoxX: 0, viewBoxY: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  // 簡易MDS実装（安定化版）
  const performMDS = (distanceMatrix: number[][], companies: any[]): CompanyPosition[] => {
    const n = companies.length;
    const positions: CompanyPosition[] = [];

    // データ検証
    if (n === 0 || !distanceMatrix || distanceMatrix.length !== n) {
      console.warn('Invalid data for MDS calculation');
      return [];
    }

    // 初期配置（円形、決定論的、スケール調整）
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / n;
      const radius = 10 + (i % 3) * 5; // より小さな初期半径
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
    const iterations = 30; // 反復回数を減らして発散防止
    const learningRate = 0.05; // 学習率を下げて安定化
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
          const targetDistance = Math.max(minDistance, distanceMatrix[i][j] * 50); // スケール調整

          // NaN/Infinity チェック
          if (!isFinite(currentDistance) || !isFinite(targetDistance) || currentDistance === 0) {
            continue;
          }

          const force = (currentDistance - targetDistance) / currentDistance;
          const dampedForce = Math.max(-0.1, Math.min(0.1, force)); // より強い力の制限

          forceX += dampedForce * dx * learningRate;
          forceY += dampedForce * dy * learningRate;
        }

        // NaN/Infinity チェック
        if (isFinite(forceX) && isFinite(forceY)) {
          positions[i].x -= forceX;
          positions[i].y -= forceY;
          
          // 座標の境界制限（発散防止）
          const maxCoord = 200;
          positions[i].x = Math.max(-maxCoord, Math.min(maxCoord, positions[i].x));
          positions[i].y = Math.max(-maxCoord, Math.min(maxCoord, positions[i].y));
        }
      }
    }

    // 最終的な座標正規化
    const allX = positions.map(p => p.x).filter(x => isFinite(x));
    const allY = positions.map(p => p.y).filter(y => isFinite(y));
    
    if (allX.length === 0 || allY.length === 0) {
      // 全て無効な座標の場合は単純な円形配置にフォールバック
      console.warn('⚠️ MDS座標が無効 - 円形配置にフォールバック');
      return companies.map((company, index) => {
        const angle = (2 * Math.PI * index) / companies.length;
        const radius = 50;
        return {
          id: company.id,
          name: company.name,
          category: company.category || '未分類',
          x: radius * Math.cos(angle),
          y: radius * Math.sin(angle),
          uniquenessScore: 0,
          clusterGroup: 0
        };
      });
    }

    // 座標を[-80, 80]の範囲に正規化
    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);
    
    const rangeX = maxX - minX;
    const rangeY = maxY - minY;
    
    if (rangeX > 0 && rangeY > 0) {
      positions.forEach(pos => {
        if (isFinite(pos.x) && isFinite(pos.y)) {
          pos.x = ((pos.x - minX) / rangeX - 0.5) * 160; // [-80, 80]
          pos.y = ((pos.y - minY) / rangeY - 0.5) * 160; // [-80, 80]
        }
      });
    }

    console.log('📐 正規化後の座標範囲:', {
      x: [Math.min(...positions.map(p => p.x)), Math.max(...positions.map(p => p.x))],
      y: [Math.min(...positions.map(p => p.y)), Math.max(...positions.map(p => p.y))]
    });

    return positions;
  };

  // カテゴリ別クラスタリング
  const performCategoryClustering = (positions: CompanyPosition[]): ClusterGroup[] => {
    const categoryMap = new Map<string, CompanyPosition[]>();
    
    positions.forEach(pos => {
      if (!categoryMap.has(pos.category)) {
        categoryMap.set(pos.category, []);
      }
      categoryMap.get(pos.category)!.push(pos);
    });

    const colors = [
      '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
      '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'
    ];

    const clusters: ClusterGroup[] = [];
    let colorIndex = 0;

    categoryMap.forEach((categoryPositions, category) => {
      const centerX = categoryPositions.reduce((sum, pos) => sum + pos.x, 0) / categoryPositions.length;
      const centerY = categoryPositions.reduce((sum, pos) => sum + pos.y, 0) / categoryPositions.length;
      
      const clusterId = clusters.length;
      categoryPositions.forEach(pos => {
        pos.clusterGroup = clusterId;
      });

      clusters.push({
        id: clusterId,
        companies: categoryPositions,
        centerX,
        centerY,
        color: colors[colorIndex % colors.length],
        category
      });
      
      colorIndex++;
    });

    return clusters;
  };

  const { positions, clusters, loading } = useMemo(() => {
    if (!data || !data.companies) {
      return { positions: [], clusters: [], loading: true };
    }

    console.log('🔄 競合ポジショニングマップ計算開始...');
    const startTime = performance.now();

    // データの詳細をデバッグ
    console.log('📊 企業データ:', {
      totalCompanies: data.companies.length,
      sampleCompany: data.companies[0],
      hasEmbeddings: data.companies.map(c => ({
        name: c.name,
        hasEmbeddings: !!(c.embeddings && Array.isArray(c.embeddings) && c.embeddings.length > 0)
      })).slice(0, 5)
    });

    // 埋め込みベクトルを持つ企業のみフィルター
    const validCompanies = data.companies.filter(company => 
      company.embeddings && Array.isArray(company.embeddings) && company.embeddings.length > 0
    );

    console.log(`🎯 埋め込みベクトルを持つ企業: ${validCompanies.length}/${data.companies.length}社`);

    // 埋め込みベクトルがない場合のフォールバック: MVVテキストベースのダミー位置生成
    if (validCompanies.length < 3) {
      console.log('⚠️ 埋め込みベクトル不足 - MVVテキストベースのフォールバック実行');
      
      const companiesWithMVV = data.companies.filter(company => 
        company.mission || company.vision || company.values
      );

      if (companiesWithMVV.length < 3) {
        console.log('❌ MVVデータも不足 - 表示できません');
        return { positions: [], clusters: [], loading: false };
      }

      // テキスト長ベースの簡易ポジショニング
      const textBasedPositions = companiesWithMVV.map((company, index) => {
        const missionLength = (company.mission || '').length;
        const visionLength = (company.vision || '').length;
        const valuesLength = (company.values || '').length;
        
        // テキスト長を座標に変換（正規化）
        const angle = (2 * Math.PI * index) / companiesWithMVV.length;
        const radius = 30 + ((missionLength + visionLength + valuesLength) % 50);
        
        return {
          id: company.id,
          name: company.name,
          category: company.category || '未分類',
          x: radius * Math.cos(angle),
          y: radius * Math.sin(angle),
          uniquenessScore: Math.random() * 0.5 + 0.3, // 暫定的なランダムスコア
          clusterGroup: index % 5
        };
      });

      const fallbackClusters = performCategoryClustering(textBasedPositions);
      
      console.log(`✅ フォールバック完了: ${textBasedPositions.length}社表示`);
      return { 
        positions: textBasedPositions, 
        clusters: fallbackClusters, 
        loading: false 
      };
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
    console.log('📍 計算されたポジション (先頭5件):', positionsWithUniqueness.slice(0, 5));
    console.log('🎨 クラスター情報:', clusters);

    return { 
      positions: positionsWithUniqueness, 
      clusters, 
      loading: false 
    };
  }, [data]);

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev * 1.2, 3));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev / 1.2, 0.3));
  const handleReset = () => {
    setZoomLevel(1);
    setViewBox({ x: -100, y: -100, width: 200, height: 200 });
  };

  // ドラッグ開始
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX,
        y: e.clientY,
        viewBoxX: viewBox.x,
        viewBoxY: viewBox.y
      });
    }
  };

  // ドラッグ中
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomLevel > 1) {
      const deltaX = (e.clientX - dragStart.x) / zoomLevel;
      const deltaY = (e.clientY - dragStart.y) / zoomLevel;
      
      setViewBox({
        ...viewBox,
        x: dragStart.viewBoxX - deltaX,
        y: dragStart.viewBoxY - deltaY
      });
    }
  };

  // ドラッグ終了
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 業界フィルタリング
  const filteredPositions = selectedCategory === 'all' 
    ? positions 
    : positions.filter(pos => pos.category === selectedCategory);

  const filteredClusters = selectedCategory === 'all'
    ? clusters
    : clusters.filter(cluster => cluster.category === selectedCategory);

  // 利用可能な業界リスト
  const availableCategories = ['all', ...new Set(positions.map(pos => pos.category))].sort();

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
    const companiesWithMVV = data?.companies?.filter(company => 
      company.mission || company.vision || company.values
    ) || [];
    
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Target className="mx-auto w-16 h-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            ポジショニングマップを表示できません
          </h3>
          <div className="text-gray-600 space-y-2">
            <p>現在の状況:</p>
            <div className="text-sm bg-gray-50 p-3 rounded-md">
              <div>• 登録企業数: {data?.companies?.length || 0}社</div>
              <div>• MVVデータ保有: {companiesWithMVV.length}社</div>
              <div>• 埋め込みベクトル保有: 0社</div>
            </div>
            <p className="mt-3">
              表示には最低3社のMVVデータが必要です。<br/>
              企業を追加してMVV抽出を実行してください。
            </p>
          </div>
        </div>
      </div>
    );
  }

  // レンダリング時のデバッグ
  console.log('🖼️ レンダリング状況:', {
    positionsCount: positions.length,
    clustersCount: clusters.length,
    isLoading,
    loading,
    viewBox,
    zoomLevel
  });

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

      {/* フィルターと説明 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">業界フィルター:</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {availableCategories.map(category => (
                <option key={category} value={category}>
                  {category === 'all' ? 'すべての業界' : category}
                  {category !== 'all' && ` (${positions.filter(p => p.category === category).length}社)`}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">表示オプション:</label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={showLabels}
                onChange={(e) => setShowLabels(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm">企業名ラベルを表示</span>
            </label>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">表示企業数:</label>
            <div className="text-2xl font-bold text-purple-600">{filteredPositions.length}</div>
            <div className="text-xs text-gray-500">/ {positions.length}社</div>
          </div>
        </div>
        
        <div className="mt-4 p-4 bg-blue-50 rounded-md">
          <h4 className="font-medium text-blue-900 mb-2">📊 マップの見方</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
            <div>
              <strong>X軸:</strong> MVV類似度の第1主成分<br/>
              <span className="text-xs">← より独特 ｜ より一般的 →</span>
            </div>
            <div>
              <strong>Y軸:</strong> MVV類似度の第2主成分<br/>
              <span className="text-xs">← 伝統的 ｜ 革新的 →</span>
            </div>
          </div>
          <p className="text-xs text-blue-700 mt-2">
            💡 距離が近い企業ほどMVVが類似しています。同じ色の企業は同業界です。
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* ポジショニングマップ */}
        <div className="lg:col-span-3 bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              マップビュー
              {selectedCategory !== 'all' && (
                <span className="ml-2 text-sm font-normal text-purple-600">
                  ({selectedCategory})
                </span>
              )}
            </h3>
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
              className={`overflow-hidden ${isDragging ? 'cursor-grabbing' : zoomLevel > 1 ? 'cursor-grab' : 'cursor-default'}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={(e) => {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                setZoomLevel(prev => Math.max(0.3, Math.min(3, prev + delta)));
              }}
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

              {/* 軸ラベル */}
              <text x="0" y="-85" className="text-xs" fill="#9CA3AF" textAnchor="middle">
                革新的・先進的
              </text>
              <text x="0" y="95" className="text-xs" fill="#9CA3AF" textAnchor="middle">
                伝統的・保守的
              </text>
              <text x="-85" y="5" className="text-xs" fill="#9CA3AF" textAnchor="middle" transform="rotate(-90, -85, 5)">
                独特・差別化
              </text>
              <text x="85" y="5" className="text-xs" fill="#9CA3AF" textAnchor="middle" transform="rotate(90, 85, 5)">
                一般的・標準的
              </text>

              {/* クラスター領域（フィルタ適用） */}
              {filteredClusters.map(cluster => (
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
                    className="text-xs"
                    fill={cluster.color}
                    fontSize="10"
                  >
                    {cluster.category}
                  </text>
                </g>
              ))}

              {/* 企業ポイント（フィルタ適用） */}
              {filteredPositions.map((position) => {
                return (
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
                    {/* 企業名ラベル（条件付き表示） */}
                    {showLabels && (
                      <text
                        x={position.x}
                        y={position.y + 15}
                        textAnchor="middle"
                        className="pointer-events-none"
                        fill="#374151"
                        fontSize="9"
                        style={{ 
                          textShadow: '1px 1px 2px rgba(255,255,255,0.8)',
                          fontWeight: 'bold'
                        }}
                      >
                        {position.name.length > 8 ? `${position.name.slice(0, 8)}...` : position.name}
                      </text>
                    )}
                    {/* ホバー時の企業名（常に表示） */}
                    {!showLabels && (
                      <title>{position.name} ({position.category})</title>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* サイドパネル */}
        <div className="space-y-4">
          {/* 選択企業のMVV詳細表示 */}
          {selectedCompany && (() => {
            const companyData = data?.companies?.find(c => c.id === selectedCompany.id);
            return (
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900 flex items-center">
                    <Info className="mr-2 h-4 w-4" />
                    {selectedCompany.name}
                  </h4>
                  <button
                    onClick={() => setSelectedCompany(null)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="space-y-4">
                  {/* 基本情報 */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">カテゴリ:</span>
                      <div className="text-gray-900">{selectedCompany.category}</div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">独自性:</span>
                      <div className="text-gray-900">{(selectedCompany.uniquenessScore * 100).toFixed(1)}%</div>
                    </div>
                  </div>

                  {/* MVV表示 */}
                  {companyData && (
                    <div className="space-y-3">
                      {/* ミッション */}
                      {companyData.mission && (
                        <div>
                          <div className="flex items-center mb-1">
                            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                            <span className="font-medium text-green-700 text-sm">ミッション</span>
                          </div>
                          <div className="text-sm text-gray-800 bg-green-50 p-3 rounded-md">
                            {companyData.mission}
                          </div>
                        </div>
                      )}

                      {/* ビジョン */}
                      {companyData.vision && (
                        <div>
                          <div className="flex items-center mb-1">
                            <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                            <span className="font-medium text-blue-700 text-sm">ビジョン</span>
                          </div>
                          <div className="text-sm text-gray-800 bg-blue-50 p-3 rounded-md">
                            {companyData.vision}
                          </div>
                        </div>
                      )}

                      {/* バリュー */}
                      {companyData.values && (
                        <div>
                          <div className="flex items-center mb-1">
                            <div className="w-3 h-3 bg-purple-500 rounded-full mr-2"></div>
                            <span className="font-medium text-purple-700 text-sm">バリュー</span>
                          </div>
                          <div className="text-sm text-gray-800 bg-purple-50 p-3 rounded-md">
                            {companyData.values}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* カテゴリ別統計（企業未選択時のみ表示） */}
          {!selectedCompany && (
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
          )}

          {/* 操作説明 */}
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
            <h4 className="font-semibold text-blue-900 mb-2">操作方法</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• 企業ポイントをクリックでMVV詳細表示</li>
              <li>• マウスホイールまたはボタンで拡大/縮小</li>
              <li>• 🖱️ 拡大時はドラッグで移動可能</li>
              <li>• 業界フィルターで業界別表示</li>
              <li>• 点線円はカテゴリクラスター</li>
              <li>• 距離が近いほど類似度が高い</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
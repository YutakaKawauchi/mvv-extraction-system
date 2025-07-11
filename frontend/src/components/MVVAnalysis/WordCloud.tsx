import React, { useMemo, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface WordCloudWord {
  text: string;
  frequency: number;
  type: 'mission' | 'vision' | 'values';
  companies?: string[]; // 該当企業のリスト
}

interface WordCloudProps {
  words: WordCloudWord[];
  width?: number;
  height?: number;
  maxWords?: number;
  onWordClick?: (word: WordCloudWord) => void;
}

export const WordCloud: React.FC<WordCloudProps> = ({ 
  words, 
  width = 600, 
  height = 400, 
  maxWords = 50,
  onWordClick 
}) => {
  const [hoveredWord, setHoveredWord] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width, height });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);
  const processedWords = useMemo(() => {
    // 頻度に基づいてソートし、上位の単語のみを取得
    const sortedWords = words
      .slice()
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, maxWords);

    if (sortedWords.length === 0) return [];

    const maxFreq = Math.max(...sortedWords.map(w => w.frequency));
    const minFreq = Math.min(...sortedWords.map(w => w.frequency));
    
    return sortedWords.map((word, index) => {
      // フォントサイズを頻度に基づいて計算（10px - 60px）
      const normalizedFreq = minFreq === maxFreq ? 1 : (word.frequency - minFreq) / (maxFreq - minFreq);
      const fontSize = 10 + normalizedFreq * 50;
      
      // タイプに基づいて色を決定
      const colors = {
        mission: '#059669', // green-600
        vision: '#2563eb',  // blue-600  
        values: '#7c3aed'   // purple-600
      };
      
      // 改善された配置計算（より均等なスパイラル配置）
      const centerX = width / 2;
      const centerY = height / 2;
      
      if (index === 0) {
        // 最も重要な単語は中央に配置
        return {
          ...word,
          x: centerX,
          y: centerY,
          fontSize,
          color: colors[word.type]
        };
      }
      
      // より均等な分散のためのパラメータ調整
      const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // 黄金角（約137.5度）
      const angle = index * goldenAngle;
      const radius = Math.sqrt(index) * Math.min(width, height) * 0.05; // サイズに応じた半径調整
      
      // 境界内での位置調整
      let x = centerX + radius * Math.cos(angle);
      let y = centerY + radius * Math.sin(angle);
      
      // 境界チェックと調整
      const margin = fontSize / 2 + 10;
      x = Math.max(margin, Math.min(width - margin, x));
      y = Math.max(margin, Math.min(height - margin, y));
      
      return {
        ...word,
        x,
        y,
        fontSize,
        color: colors[word.type]
      };
    });
  }, [words, width, height, maxWords]);

  // ズーム機能
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev * 1.2, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev / 1.2, 0.3));
  };

  const handleReset = () => {
    setZoomLevel(1);
    setViewBox({ x: 0, y: 0, width, height });
    setDragOffset({ x: 0, y: 0 });
    setHasMoved(false);
  };

  // ドラッグ機能のハンドラー
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setHasMoved(false);
      setDragStart({
        x: e.clientX,
        y: e.clientY
      });
      e.preventDefault(); // デフォルトの選択を防ぐ
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomLevel > 1) {
      const deltaX = (e.clientX - dragStart.x) / zoomLevel;
      const deltaY = (e.clientY - dragStart.y) / zoomLevel;
      
      // 最小移動距離を設定（誤ドラッグ防止）
      const minMove = 3;
      if (Math.abs(deltaX) > minMove || Math.abs(deltaY) > minMove) {
        setHasMoved(true);
      }
      
      setDragOffset(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      setDragStart({
        x: e.clientX,
        y: e.clientY
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    // 短時間で移動が小さい場合はクリックとして扱う
    setTimeout(() => setHasMoved(false), 100);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setHasMoved(false);
  };

  // タッチイベント対応
  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setHasMoved(false);
      const touch = e.touches[0];
      setDragStart({
        x: touch.clientX,
        y: touch.clientY
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && zoomLevel > 1) {
      const touch = e.touches[0];
      const deltaX = (touch.clientX - dragStart.x) / zoomLevel;
      const deltaY = (touch.clientY - dragStart.y) / zoomLevel;
      
      const minMove = 3;
      if (Math.abs(deltaX) > minMove || Math.abs(deltaY) > minMove) {
        setHasMoved(true);
      }
      
      setDragOffset(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      setDragStart({
        x: touch.clientX,
        y: touch.clientY
      });
      
      e.preventDefault(); // スクロール防止
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setTimeout(() => setHasMoved(false), 100);
  };

  // ホイールズーム機能
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoomLevel(prev => Math.max(0.3, Math.min(3, prev + delta)));
  };

  const handleWordClick = (word: any, e: React.MouseEvent) => {
    // ドラッグ移動があった場合はクリックを無視
    if (hasMoved || isDragging) {
      e.stopPropagation();
      return;
    }
    
    if (onWordClick) {
      onWordClick(word);
    }
  };

  if (processedWords.length === 0) {
    return (
      <div 
        className="flex items-center justify-center border rounded-lg bg-gray-50"
        style={{ width, height }}
      >
        <p className="text-gray-500">表示するキーワードがありません</p>
      </div>
    );
  }

  return (
    <div className="relative border rounded-lg bg-gradient-to-br from-blue-50 to-purple-50">
      {/* ズームコントロール */}
      <div className="absolute top-2 left-2 flex space-x-1 z-10">
        <button
          onClick={handleZoomIn}
          className="p-2 bg-white/90 backdrop-blur-sm rounded-md hover:bg-white shadow-sm transition-colors"
          title="ズームイン"
        >
          <ZoomIn className="w-4 h-4 text-gray-600" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 bg-white/90 backdrop-blur-sm rounded-md hover:bg-white shadow-sm transition-colors"
          title="ズームアウト"
        >
          <ZoomOut className="w-4 h-4 text-gray-600" />
        </button>
        <button
          onClick={handleReset}
          className="p-2 bg-white/90 backdrop-blur-sm rounded-md hover:bg-white shadow-sm transition-colors"
          title="リセット"
        >
          <RotateCcw className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      <svg 
        width={width} 
        height={height} 
        className={`overflow-hidden ${zoomLevel > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'}`}
        viewBox={`${(viewBox.x - dragOffset.x) / zoomLevel} ${(viewBox.y - dragOffset.y) / zoomLevel} ${viewBox.width / zoomLevel} ${viewBox.height / zoomLevel}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        style={{ touchAction: zoomLevel > 1 ? 'none' : 'auto' }}
      >
        {processedWords.map((word, index) => (
          <g key={`${word.text}_${word.type}_${index}`}>
            {/* 背景のぼかし効果 */}
            <text
              x={word.x}
              y={word.y}
              fontSize={word.fontSize}
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
              fill={word.color}
              fillOpacity="0.1"
              stroke={word.color}
              strokeWidth="2"
              strokeOpacity="0.1"
            >
              {word.text}
            </text>
            {/* メインのテキスト */}
            <text
              x={word.x}
              y={word.y}
              fontSize={hoveredWord === word.text ? word.fontSize * 1.1 : word.fontSize}
              fontWeight="600"
              textAnchor="middle"
              dominantBaseline="middle"
              fill={word.color}
              fillOpacity={hoveredWord && hoveredWord !== word.text ? 0.3 : 1}
              className="cursor-pointer transition-all duration-200"
              onMouseEnter={() => setHoveredWord(word.text)}
              onMouseLeave={() => setHoveredWord(null)}
              onClick={(e) => handleWordClick(word, e)}
            >
              <title>{`${word.text} - ${word.frequency}回使用${word.companies ? ` (${word.companies.length}社)` : ''} - クリックで詳細表示`}</title>
              {word.text}
            </text>
          </g>
        ))}
      </svg>
      
      {/* 凡例 */}
      <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-lg p-2 text-xs space-y-1">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-600 rounded"></div>
          <span>ミッション</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-blue-600 rounded"></div>
          <span>ビジョン</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-purple-600 rounded"></div>
          <span>バリュー</span>
        </div>
        {zoomLevel > 1 && (
          <div className="border-t pt-1 mt-1">
            <div className="text-gray-500 text-xs">ドラッグで移動</div>
          </div>
        )}
      </div>

    </div>
  );
};
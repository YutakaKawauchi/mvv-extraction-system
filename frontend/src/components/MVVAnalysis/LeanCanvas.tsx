/**
 * LeanCanvas - Lean Canvas 9-block component
 * 美しい9ブロック構造の可視化コンポーネント
 * BusinessInnovationLabで使用される完全版リーンキャンバス
 */

import React from 'react';

interface LeanCanvasData {
  problem: string[];
  existingAlternatives?: string;
  solution: string;
  keyMetrics: string[];
  valueProposition: string;
  unfairAdvantage: string;
  channels: string[];
  targetCustomers: string[];
  earlyAdopters?: string;
  costStructure: string[];
  revenueStreams: string[];
}

interface LeanCanvasProps {
  data: LeanCanvasData;
  className?: string;
}

export const LeanCanvas: React.FC<LeanCanvasProps> = ({ 
  data, 
  className = '' 
}) => {
  return (
    <div className={`grid grid-cols-10 grid-rows-3 gap-1 border border-gray-300 rounded-lg overflow-hidden text-xs min-h-[400px] ${className}`}>
      {/* ②課題 - 1-2列目・1-2行目 */}
      <div className="col-span-2 row-span-2 bg-slate-50 border-r border-b border-gray-300 p-3">
        <div className="font-semibold text-slate-800 mb-2">②課題</div>
        <div className="text-slate-700 space-y-2">
          {data.problem.map((p, i) => (
            <div key={i} className="border-l-2 border-slate-300 pl-2 text-xs">{p}</div>
          ))}
          <div className="mt-3 pt-2 border-t border-slate-200">
            <div className="font-semibold text-slate-900 mb-1 text-xs">既存の代替品</div>
            <div className="text-slate-700 text-xs">
              {data.existingAlternatives || "現在顧客がこの課題をどう解決しているか"}
            </div>
          </div>
        </div>
      </div>
      
      {/* ④ソリューション - 3-4列目・1行目 */}
      <div className="col-span-2 bg-blue-50 border-r border-b border-gray-300 p-3">
        <div className="font-semibold text-blue-800 mb-2">④ソリューション</div>
        <div className="text-blue-700 text-xs">{data.solution}</div>
      </div>
      
      {/* ③独自の価値提案 - 5-6列目・1-2行目 */}
      <div className="col-span-2 row-span-2 bg-amber-50 border-r border-b border-gray-300 p-3">
        <div className="font-semibold text-amber-800 mb-2">③独自の価値提案</div>
        <div className="text-amber-700 font-medium text-xs">{data.valueProposition}</div>
      </div>
      
      {/* ⑨圧倒的な優位性 - 7-8列目・1行目 */}
      <div className="col-span-2 bg-indigo-50 border-r border-b border-gray-300 p-3">
        <div className="font-semibold text-indigo-800 mb-2">⑨圧倒的な優位性</div>
        <div className="text-indigo-700 text-xs">{data.unfairAdvantage}</div>
      </div>
      
      {/* ①顧客セグメント - 9-10列目・1-2行目 */}
      <div className="col-span-2 row-span-2 bg-emerald-50 border-b border-gray-300 p-3">
        <div className="font-semibold text-emerald-800 mb-2">①顧客セグメント</div>
        <div className="text-emerald-700 space-y-1">
          {data.targetCustomers.map((customer, i) => (
            <div key={i} className="bg-emerald-100 px-2 py-1 rounded text-xs">{customer}</div>
          ))}
          <div className="mt-3 pt-2 border-t border-emerald-200">
            <div className="font-semibold text-emerald-900 mb-1 text-xs">アーリーアダプター</div>
            <div className="text-emerald-700 text-xs">
              {data.earlyAdopters || "誰が一番初めに顧客となってくれるか"}
            </div>
          </div>
        </div>
      </div>
      
      {/* ⑦主要指標 - 3-4列目・2行目 */}
      <div className="col-span-2 bg-teal-50 border-r border-b border-gray-300 p-3">
        <div className="font-semibold text-teal-800 mb-2">⑦主要指標</div>
        <div className="text-teal-700 space-y-1">
          {data.keyMetrics.map((metric, i) => (
            <div key={i} className="bg-teal-100 px-2 py-1 rounded text-xs">{metric}</div>
          ))}
        </div>
      </div>
      
      {/* ⑤チャネル - 7-8列目・2行目 */}
      <div className="col-span-2 bg-violet-50 border-r border-b border-gray-300 p-3">
        <div className="font-semibold text-violet-800 mb-2">⑤チャネル</div>
        <div className="text-violet-700 space-y-1">
          {data.channels.map((channel, i) => (
            <div key={i} className="bg-violet-100 px-1 py-1 rounded text-xs">{channel}</div>
          ))}
        </div>
      </div>
      
      {/* ⑧コスト構造 - 1-5列目・3行目 */}
      <div className="col-span-5 bg-rose-50 border-r border-gray-300 p-3">
        <div className="font-semibold text-rose-800 mb-2">⑧コスト構造</div>
        <div className="text-rose-700 space-y-1">
          {data.costStructure.map((cost, i) => (
            <div key={i} className="border-l-2 border-rose-300 pl-2 text-xs">{cost}</div>
          ))}
        </div>
      </div>
      
      {/* ⑥収益の流れ - 6-10列目・3行目 */}
      <div className="col-span-5 bg-green-50 p-3">
        <div className="font-semibold text-green-800 mb-2 flex items-center">
          <span className="mr-1">💰</span>
          ⑥収益の流れ（支払者明記）
        </div>
        <div className="text-green-700 space-y-1">
          {data.revenueStreams.map((revenue, i) => (
            <div key={i} className="bg-green-100 px-2 py-1 rounded text-xs font-medium border border-green-200">
              {revenue}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
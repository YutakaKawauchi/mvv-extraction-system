import React from 'react';
import type { MVVData } from '../../types';
import { formatDate, formatPercentage } from '../../utils/formatters';
import { ProgressBar } from '../common';
import { Brain, Target, Heart, Calendar, TrendingUp } from 'lucide-react';

interface MVVDisplayProps {
  mvvData: MVVData;
  companyName: string;
  showMetadata?: boolean;
}

export const MVVDisplay: React.FC<MVVDisplayProps> = ({
  mvvData,
  companyName,
  showMetadata = true
}) => {
  const confidenceColor = (score: number) => {
    if (score >= 0.8) return 'green';
    if (score >= 0.6) return 'yellow';
    return 'red';
  };

  const confidenceLabel = (score: number) => {
    if (score >= 0.8) return '高信頼度';
    if (score >= 0.6) return '中信頼度';
    return '低信頼度';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <h3 className="text-xl font-semibold text-gray-900">{companyName}</h3>
        {showMetadata && (
          <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
            <div className="flex items-center">
              <Calendar className="w-4 h-4 mr-1" />
              {formatDate(mvvData.extractedAt)}
            </div>
            <div className="flex items-center">
              <Brain className="w-4 h-4 mr-1" />
              {mvvData.source === 'openai' ? 'AI抽出' : '手動入力'}
            </div>
            {mvvData.extractedFrom && (
              <div className="text-xs bg-gray-100 px-2 py-1 rounded">
                {mvvData.extractedFrom}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mission */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Target className="w-5 h-5 text-blue-600 mr-2" />
            <h4 className="text-lg font-medium text-gray-900">Mission（使命）</h4>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              信頼度: {formatPercentage(mvvData.confidenceScores.mission)}
            </span>
            <span className={`text-xs px-2 py-1 rounded-full ${
              confidenceColor(mvvData.confidenceScores.mission) === 'green' 
                ? 'bg-green-100 text-green-800'
                : confidenceColor(mvvData.confidenceScores.mission) === 'yellow'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {confidenceLabel(mvvData.confidenceScores.mission)}
            </span>
          </div>
        </div>
        
        {mvvData.mission ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-gray-800 leading-relaxed">{mvvData.mission}</p>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-gray-500 italic">Mission情報が見つかりませんでした</p>
          </div>
        )}
        
        <ProgressBar
          value={mvvData.confidenceScores.mission * 100}
          max={100}
          size="sm"
          color={confidenceColor(mvvData.confidenceScores.mission) as any}
          showPercentage={false}
        />
      </div>

      {/* Vision */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <TrendingUp className="w-5 h-5 text-green-600 mr-2" />
            <h4 className="text-lg font-medium text-gray-900">Vision（理念）</h4>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              信頼度: {formatPercentage(mvvData.confidenceScores.vision)}
            </span>
            <span className={`text-xs px-2 py-1 rounded-full ${
              confidenceColor(mvvData.confidenceScores.vision) === 'green' 
                ? 'bg-green-100 text-green-800'
                : confidenceColor(mvvData.confidenceScores.vision) === 'yellow'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {confidenceLabel(mvvData.confidenceScores.vision)}
            </span>
          </div>
        </div>
        
        {mvvData.vision ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-gray-800 leading-relaxed">{mvvData.vision}</p>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-gray-500 italic">Vision情報が見つかりませんでした</p>
          </div>
        )}
        
        <ProgressBar
          value={mvvData.confidenceScores.vision * 100}
          max={100}
          size="sm"
          color={confidenceColor(mvvData.confidenceScores.vision) as any}
          showPercentage={false}
        />
      </div>

      {/* Values */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Heart className="w-5 h-5 text-red-600 mr-2" />
            <h4 className="text-lg font-medium text-gray-900">Values（価値観）</h4>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              信頼度: {formatPercentage(mvvData.confidenceScores.values)}
            </span>
            <span className={`text-xs px-2 py-1 rounded-full ${
              confidenceColor(mvvData.confidenceScores.values) === 'green' 
                ? 'bg-green-100 text-green-800'
                : confidenceColor(mvvData.confidenceScores.values) === 'yellow'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {confidenceLabel(mvvData.confidenceScores.values)}
            </span>
          </div>
        </div>
        
        {mvvData.values.length > 0 ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex flex-wrap gap-2">
              {mvvData.values.map((value, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800"
                >
                  {value}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-gray-500 italic">Values情報が見つかりませんでした</p>
          </div>
        )}
        
        <ProgressBar
          value={mvvData.confidenceScores.values * 100}
          max={100}
          size="sm"
          color={confidenceColor(mvvData.confidenceScores.values) as any}
          showPercentage={false}
        />
      </div>

      {/* Overall Confidence Score */}
      {showMetadata && (
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">総合信頼度</span>
            <span className="font-medium text-gray-900">
              {formatPercentage(
                (mvvData.confidenceScores.mission + 
                 mvvData.confidenceScores.vision + 
                 mvvData.confidenceScores.values) / 3
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
/**
 * 保存済みアイデア一覧パネル
 * アイデアの表示・フィルタリング・復元機能を提供
 */

import React, { useState, useEffect } from 'react';
import {
  Database,
  Star,
  Search,
  Eye,
  Edit3,
  Trash2,
  Calendar,
  Building2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Upload,
  ArrowRight
} from 'lucide-react';
import { ideaStorageService, type StoredBusinessIdea } from '../../services/ideaStorage';

interface SavedIdeasPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreIdea: (idea: StoredBusinessIdea) => void;
  onViewDetails: (idea: StoredBusinessIdea) => void;
  className?: string;
}

export const SavedIdeasPanel: React.FC<SavedIdeasPanelProps> = ({
  isOpen,
  onClose,
  onRestoreIdea,
  onViewDetails,
  className = ''
}) => {
  const [ideas, setIdeas] = useState<StoredBusinessIdea[]>([]);
  const [filteredIdeas, setFilteredIdeas] = useState<StoredBusinessIdea[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [starredOnly, setStarredOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'updatedAt' | 'createdAt' | 'title'>('updatedAt');

  // アイデア読み込み
  const loadIdeas = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const allIdeas = await ideaStorageService.getIdeas();
      setIdeas(allIdeas);
    } catch (err) {
      console.error('Failed to load ideas:', err);
      setError('アイデアの読み込みに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // 初期読み込み
  useEffect(() => {
    if (isOpen) {
      loadIdeas();
    }
  }, [isOpen]);

  // フィルタリング・検索・ソート
  useEffect(() => {
    let filtered = [...ideas];

    // 検索フィルター
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(idea =>
        idea.title.toLowerCase().includes(term) ||
        idea.description.toLowerCase().includes(term) ||
        idea.companyName.toLowerCase().includes(term)
      );
    }

    // ステータスフィルター
    if (statusFilter !== 'all') {
      filtered = filtered.filter(idea => idea.status === statusFilter);
    }

    // 企業フィルター
    if (companyFilter !== 'all') {
      filtered = filtered.filter(idea => idea.companyId === companyFilter);
    }

    // スター付きフィルター
    if (starredOnly) {
      filtered = filtered.filter(idea => idea.starred);
    }

    // ソート
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'createdAt':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'updatedAt':
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

    setFilteredIdeas(filtered);
  }, [ideas, searchTerm, statusFilter, companyFilter, starredOnly, sortBy]);

  // スター切り替え
  const handleToggleStar = async (ideaId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await ideaStorageService.toggleStar(ideaId);
      await loadIdeas(); // 再読み込み
    } catch (err) {
      console.error('Failed to toggle star:', err);
      setError('スター状態の変更に失敗しました');
    }
  };

  // アイデア削除
  const handleDeleteIdea = async (ideaId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (window.confirm('このアイデアを削除しますか？この操作は取り消せません。')) {
      try {
        await ideaStorageService.deleteIdea(ideaId);
        await loadIdeas(); // 再読み込み
      } catch (err) {
        console.error('Failed to delete idea:', err);
        setError('アイデアの削除に失敗しました');
      }
    }
  };

  // 復元ボタンクリック
  const handleRestoreClick = (idea: StoredBusinessIdea, event: React.MouseEvent) => {
    event.stopPropagation();
    onRestoreIdea(idea);
  };

  // ユニークな企業リスト
  const uniqueCompanies = Array.from(new Set(ideas.map(idea => ({ id: idea.companyId, name: idea.companyName }))))
    .sort((a, b) => a.name.localeCompare(b.name));

  // ステータス統計
  const statusCounts = ideas.reduce((acc, idea) => {
    acc[idea.status] = (acc[idea.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'draft': return <Edit3 className="w-4 h-4 text-gray-500" />;
      case 'archived': return <Database className="w-4 h-4 text-blue-500" />;
      default: return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'verified': return '検証済み';
      case 'draft': return '下書き';
      case 'archived': return 'アーカイブ';
      default: return status;
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-y-0 right-0 w-96 bg-white shadow-xl border-l border-gray-200 z-50 transform transition-transform duration-300 ease-in-out ${className}`}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">保存済みアイデア</h2>
          <span className="text-sm text-gray-500">({ideas.length}件)</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded-md transition-colors"
        >
          <ArrowRight className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* 統計サマリー */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center">
            <div className="text-green-600 font-bold">{statusCounts.verified || 0}</div>
            <div className="text-gray-600">検証済み</div>
          </div>
          <div className="text-center">
            <div className="text-gray-600 font-bold">{statusCounts.draft || 0}</div>
            <div className="text-gray-600">下書き</div>
          </div>
          <div className="text-center">
            <div className="text-yellow-600 font-bold">{ideas.filter(i => i.starred).length}</div>
            <div className="text-gray-600">スター付き</div>
          </div>
        </div>
      </div>

      {/* 検索・フィルター */}
      <div className="p-4 space-y-3 border-b border-gray-200">
        {/* 検索 */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="タイトル・説明・企業名で検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* フィルター */}
        <div className="grid grid-cols-2 gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-gray-300 rounded-md px-2 py-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">全ステータス</option>
            <option value="verified">検証済み</option>
            <option value="draft">下書き</option>
            <option value="archived">アーカイブ</option>
          </select>

          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="text-xs border border-gray-300 rounded-md px-2 py-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">全企業</option>
            {uniqueCompanies.map(company => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
        </div>

        {/* オプション */}
        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={starredOnly}
              onChange={(e) => setStarredOnly(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <Star className="w-3 h-3 text-yellow-500" />
            <span>スター付きのみ</span>
          </label>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="border border-gray-300 rounded px-1 py-0.5 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="updatedAt">更新日順</option>
            <option value="createdAt">作成日順</option>
            <option value="title">タイトル順</option>
          </select>
        </div>
      </div>

      {/* アクションボタン */}
      <div className="p-3 border-b border-gray-200">
        <button
          onClick={loadIdeas}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors text-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? '読み込み中...' : '更新'}
        </button>
      </div>

      {/* アイデア一覧 */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="p-4 text-sm text-red-600 bg-red-50 border-b border-red-200">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : filteredIdeas.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Database className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <div className="text-sm">
              {ideas.length === 0 ? 'アイデアが保存されていません' : '条件に一致するアイデアがありません'}
            </div>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {filteredIdeas.map((idea) => (
              <div
                key={idea.id}
                className="group p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
                onClick={() => onViewDetails(idea)}
              >
                {/* アイデアヘッダー */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {idea.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Building2 className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-600 truncate">{idea.companyName}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 ml-2">
                    {getStatusIcon(idea.status)}
                    {idea.starred && <Star className="w-3 h-3 text-yellow-500 fill-current" />}
                  </div>
                </div>

                {/* メタ情報 */}
                <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(idea.updatedAt).toLocaleDateString('ja-JP')}
                  </span>
                  <span>{getStatusText(idea.status)}</span>
                </div>

                {/* スコア表示 */}
                <div className="grid grid-cols-3 gap-1 mb-2">
                  <div className="text-center">
                    <div className="text-xs font-medium text-blue-600">
                      {(idea.feasibility.mvvAlignment * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs text-gray-500">MVV</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-medium text-green-600">
                      {(idea.feasibility.implementationScore * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs text-gray-500">実装</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-medium text-purple-600">
                      {(idea.feasibility.marketPotential * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs text-gray-500">市場</div>
                  </div>
                </div>

                {/* アクションボタン */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleRestoreClick(idea, e)}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs hover:bg-blue-100 transition-colors"
                    title="このアイデアを編集フォームに復元"
                  >
                    <Upload className="w-3 h-3" />
                    復元
                  </button>
                  
                  <button
                    onClick={(e) => handleToggleStar(idea.id, e)}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    title={idea.starred ? 'スターを外す' : 'スターを付ける'}
                  >
                    <Star className={`w-3 h-3 ${idea.starred ? 'text-yellow-500 fill-current' : 'text-gray-400'}`} />
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewDetails(idea);
                    }}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    title="詳細を表示"
                  >
                    <Eye className="w-3 h-3 text-gray-600" />
                  </button>
                  
                  <button
                    onClick={(e) => handleDeleteIdea(idea.id, e)}
                    className="p-1 hover:bg-red-100 rounded transition-colors"
                    title="削除"
                  >
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
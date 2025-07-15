/**
 * ビジネスアイデア・検証結果の永続化管理システム
 * IndexedDBを使用してアイデアと検証結果を保存・管理
 */

import Dexie, { type Table } from 'dexie';

export interface StoredBusinessIdea {
  id: string;
  companyId: string;
  companyName: string;
  companyCategory?: string; // 企業カテゴリ
  title: string;
  description: string;
  worldview: string;
  industryInsight: string;
  leanCanvas: {
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
  };
  feasibility: {
    mvvAlignment: number;
    mvvAlignmentReason: string;
    implementationScore: number;
    implementationReason: string;
    marketPotential: number;
    marketPotentialReason: string;
  };
  verification?: {
    industryAnalysis: any;
    marketValidation: any;
    businessModelValidation: any;
    competitiveAnalysis: any;
    improvementSuggestions: any;
    overallAssessment: any;
    metadata: {
      verificationLevel: string;
      totalTokens: number;
      totalCost: number;
      model: string;
      confidence: number;
      version: string;
    };
  };
  analysisParams: {
    focusAreas: string[];
    businessModel: string;
    targetMarket: string;
    constraints: {
      budget?: string;
      timeframe?: string;
      resources?: string;
    };
    techPreferences: {
      preferred: string[];
      avoided: string[];
    };
    riskTolerance: 'conservative' | 'moderate' | 'aggressive';
    revenueExpectation: 'short-term' | 'medium-term' | 'long-term';
  };
  generationMetadata: {
    model: string;
    tokensUsed: number;
    estimatedCost: number;
    confidence: number;
    version: string;
    cacheLevel?: number;
  };
  // Phase δ.1: 自動保存機能関連フィールド
  autoSaved?: boolean; // 自動保存されたかどうか
  generationContext?: { // 生成時のコンテキスト情報
    timestamp: number;
    apiVersion: string;
    modelUsed: string;
    cacheLevel?: number;
  };
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  status: 'draft' | 'verified' | 'archived';
  starred: boolean;
  // 互換性のためisStarredも維持
  isStarred?: boolean;
}

export interface IdeaSearchFilters {
  companyId?: string;
  status?: string;
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  verified?: boolean;
  starred?: boolean;
}

class IdeaStorageDatabase extends Dexie {
  ideas!: Table<StoredBusinessIdea>;

  constructor() {
    super('BusinessIdeaStorage');
    
    this.version(1).stores({
      ideas: '++id, companyId, companyName, title, createdAt, updatedAt, status, starred, tags'
    });

    // データ変換フック
    this.ideas.hook('creating', (_, obj) => {
      obj.createdAt = new Date();
      obj.updatedAt = new Date();
      obj.id = obj.id || this.generateId();
    });

    this.ideas.hook('updating', (modifications) => {
      (modifications as any).updatedAt = new Date();
    });
  }

  private generateId(): string {
    return `idea_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

export class IdeaStorageService {
  private db: IdeaStorageDatabase;

  constructor() {
    this.db = new IdeaStorageDatabase();
  }

  /**
   * アイデアを保存
   */
  async saveIdea(idea: Omit<StoredBusinessIdea, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const ideaToSave: Partial<StoredBusinessIdea> = {
        ...idea,
        status: idea.status || 'draft',
        starred: idea.starred || false,
        tags: idea.tags || []
      };

      const id = await this.db.ideas.add(ideaToSave as StoredBusinessIdea);
      console.log('Idea saved with ID:', id);
      return id.toString();
    } catch (error) {
      console.error('Failed to save idea:', error);
      throw new Error('アイデアの保存に失敗しました');
    }
  }

  /**
   * 検証結果を追加してアイデアを更新
   */
  async updateIdeaWithVerification(
    ideaId: string, 
    verificationResult: StoredBusinessIdea['verification']
  ): Promise<void> {
    try {
      await this.db.ideas.update(ideaId, {
        verification: verificationResult,
        status: 'verified',
        updatedAt: new Date()
      });
      console.log('Idea updated with verification:', ideaId);
    } catch (error) {
      console.error('Failed to update idea with verification:', error);
      throw new Error('検証結果の保存に失敗しました');
    }
  }

  /**
   * アイデア一覧を取得
   */
  async getIdeas(filters?: IdeaSearchFilters): Promise<StoredBusinessIdea[]> {
    try {
      let query = this.db.ideas.orderBy('updatedAt').reverse();

      if (filters) {
        if (filters.companyId) {
          query = query.filter(idea => idea.companyId === filters.companyId);
        }
        
        if (filters.status) {
          query = query.filter(idea => idea.status === filters.status);
        }
        
        if (filters.verified !== undefined) {
          query = query.filter(idea => !!idea.verification === filters.verified);
        }
        
        if (filters.starred !== undefined) {
          query = query.filter(idea => idea.starred === filters.starred);
        }
        
        if (filters.tags && filters.tags.length > 0) {
          query = query.filter(idea => 
            filters.tags!.some(tag => idea.tags.includes(tag))
          );
        }
        
        if (filters.dateRange) {
          query = query.filter(idea => 
            idea.createdAt >= filters.dateRange!.start && 
            idea.createdAt <= filters.dateRange!.end
          );
        }
      }

      return await query.toArray();
    } catch (error) {
      console.error('Failed to get ideas:', error);
      throw new Error('アイデア一覧の取得に失敗しました');
    }
  }

  /**
   * 特定のアイデアを取得
   */
  async getIdea(ideaId: string): Promise<StoredBusinessIdea | undefined> {
    try {
      return await this.db.ideas.get(ideaId);
    } catch (error) {
      console.error('Failed to get idea:', error);
      throw new Error('アイデアの取得に失敗しました');
    }
  }

  /**
   * アイデアを削除
   */
  async deleteIdea(ideaId: string): Promise<void> {
    try {
      await this.db.ideas.delete(ideaId);
      console.log('Idea deleted:', ideaId);
    } catch (error) {
      console.error('Failed to delete idea:', error);
      throw new Error('アイデアの削除に失敗しました');
    }
  }

  /**
   * アイデアを更新
   */
  async updateIdea(
    ideaId: string, 
    updates: Partial<StoredBusinessIdea>
  ): Promise<void> {
    try {
      await this.db.ideas.update(ideaId, updates);
      console.log('Idea updated:', ideaId);
    } catch (error) {
      console.error('Failed to update idea:', error);
      throw new Error('アイデアの更新に失敗しました');
    }
  }

  /**
   * スター付け/外し
   */
  async toggleStar(ideaId: string): Promise<boolean> {
    try {
      const idea = await this.getIdea(ideaId);
      if (!idea) {
        throw new Error('アイデアが見つかりません');
      }
      
      const newStarred = !idea.starred;
      await this.updateIdea(ideaId, { starred: newStarred });
      return newStarred;
    } catch (error) {
      console.error('Failed to toggle star:', error);
      throw new Error('スター状態の変更に失敗しました');
    }
  }

  /**
   * タグを追加
   */
  async addTag(ideaId: string, tag: string): Promise<void> {
    try {
      const idea = await this.getIdea(ideaId);
      if (!idea) {
        throw new Error('アイデアが見つかりません');
      }
      
      if (!idea.tags.includes(tag)) {
        const newTags = [...idea.tags, tag];
        await this.updateIdea(ideaId, { tags: newTags });
      }
    } catch (error) {
      console.error('Failed to add tag:', error);
      throw new Error('タグの追加に失敗しました');
    }
  }

  /**
   * タグを削除
   */
  async removeTag(ideaId: string, tag: string): Promise<void> {
    try {
      const idea = await this.getIdea(ideaId);
      if (!idea) {
        throw new Error('アイデアが見つかりません');
      }
      
      const newTags = idea.tags.filter(t => t !== tag);
      await this.updateIdea(ideaId, { tags: newTags });
    } catch (error) {
      console.error('Failed to remove tag:', error);
      throw new Error('タグの削除に失敗しました');
    }
  }

  /**
   * 統計情報を取得
   */
  async getStatistics(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    verified: number;
    starred: number;
    totalCost: number;
    averageCost: number;
  }> {
    try {
      const allIdeas = await this.db.ideas.toArray();
      
      const byStatus = allIdeas.reduce((acc, idea) => {
        acc[idea.status] = (acc[idea.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const verified = allIdeas.filter(idea => !!idea.verification).length;
      const starred = allIdeas.filter(idea => idea.starred).length;
      
      const totalCost = allIdeas.reduce((sum, idea) => {
        const generationCost = idea.generationMetadata?.estimatedCost || 0;
        const verificationCost = idea.verification?.metadata?.totalCost || 0;
        return sum + generationCost + verificationCost;
      }, 0);
      
      const averageCost = allIdeas.length > 0 ? totalCost / allIdeas.length : 0;

      return {
        total: allIdeas.length,
        byStatus,
        verified,
        starred,
        totalCost,
        averageCost
      };
    } catch (error) {
      console.error('Failed to get statistics:', error);
      throw new Error('統計情報の取得に失敗しました');
    }
  }

  /**
   * 全データをJSONでエクスポート
   */
  async exportToJSON(): Promise<string> {
    try {
      const allIdeas = await this.db.ideas.toArray();
      return JSON.stringify(allIdeas, null, 2);
    } catch (error) {
      console.error('Failed to export to JSON:', error);
      throw new Error('JSONエクスポートに失敗しました');
    }
  }

  /**
   * データベースをクリア
   */
  async clearAll(): Promise<void> {
    try {
      await this.db.ideas.clear();
      console.log('All ideas cleared');
    } catch (error) {
      console.error('Failed to clear ideas:', error);
      throw new Error('データのクリアに失敗しました');
    }
  }
}

// シングルトンインスタンス
export const ideaStorageService = new IdeaStorageService();
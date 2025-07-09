import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { Company, MVVData, ProcessingLog } from '../types';
import { CONSTANTS } from '../utils/constants';

export interface DBCompany extends Omit<Company, 'createdAt' | 'updatedAt' | 'lastProcessed'> {
  createdAt: number;
  updatedAt: number;
  lastProcessed?: number;
}

export interface DBMVVData extends Omit<MVVData, 'extractedAt'> {
  extractedAt: number;
}

export interface DBProcessingLog extends Omit<ProcessingLog, 'timestamp'> {
  timestamp: number;
}

class MVVDatabase extends Dexie {
  companies!: Table<DBCompany>;
  mvvData!: Table<DBMVVData>;
  processingLogs!: Table<DBProcessingLog>;

  constructor() {
    super(CONSTANTS.DB_NAME);
    
    // Version 1 - Initial schema
    this.version(1).stores({
      companies: 'id, name, status, category, createdAt, updatedAt',
      mvvData: '++id, companyId, version, isActive, extractedAt',
      processingLogs: '++id, companyId, status, timestamp'
    });
    
    // Version 2 - Add embeddings and MVV fields to companies
    this.version(2).stores({
      companies: 'id, name, status, category, createdAt, updatedAt, mission, vision, values, embeddings',
      mvvData: '++id, companyId, version, isActive, extractedAt',
      processingLogs: '++id, companyId, status, timestamp'
    }).upgrade(tx => {
      return tx.table('companies').toCollection().modify(company => {
        // Initialize new fields if they don't exist
        if (!company.hasOwnProperty('embeddings')) {
          company.embeddings = undefined;
        }
        if (!company.hasOwnProperty('mission')) {
          company.mission = undefined;
        }
        if (!company.hasOwnProperty('vision')) {
          company.vision = undefined;
        }
        if (!company.hasOwnProperty('values')) {
          company.values = undefined;
        }
      });
    });
  }
}

export const db = new MVVDatabase();

// 変換ヘルパー関数
const toDBCompany = (company: Company): DBCompany => ({
  ...company,
  createdAt: company.createdAt.getTime(),
  updatedAt: company.updatedAt.getTime(),
  lastProcessed: company.lastProcessed?.getTime()
});

const fromDBCompany = (dbCompany: DBCompany): Company => ({
  ...dbCompany,
  createdAt: new Date(dbCompany.createdAt),
  updatedAt: new Date(dbCompany.updatedAt),
  lastProcessed: dbCompany.lastProcessed ? new Date(dbCompany.lastProcessed) : undefined
});

const toDBMVVData = (mvvData: MVVData): DBMVVData => ({
  ...mvvData,
  extractedAt: mvvData.extractedAt.getTime()
});

const fromDBMVVData = (dbMVVData: DBMVVData): MVVData => ({
  ...dbMVVData,
  extractedAt: new Date(dbMVVData.extractedAt)
});

const toDBProcessingLog = (log: ProcessingLog): DBProcessingLog => ({
  ...log,
  timestamp: log.timestamp.getTime()
});

const fromDBProcessingLog = (dbLog: DBProcessingLog): ProcessingLog => ({
  ...dbLog,
  timestamp: new Date(dbLog.timestamp)
});

// 企業関連の操作
export const companyStorage = {
  async create(company: Company): Promise<string> {
    return await db.companies.add(toDBCompany(company));
  },

  async createMany(companies: Company[]): Promise<string[]> {
    return await db.companies.bulkAdd(companies.map(toDBCompany), { allKeys: true });
  },

  async getById(id: string): Promise<Company | undefined> {
    const dbCompany = await db.companies.get(id);
    return dbCompany ? fromDBCompany(dbCompany) : undefined;
  },

  async getAll(): Promise<Company[]> {
    const dbCompanies = await db.companies.toArray();
    return dbCompanies.map(fromDBCompany);
  },

  async getByStatus(status: Company['status']): Promise<Company[]> {
    const dbCompanies = await db.companies.where('status').equals(status).toArray();
    return dbCompanies.map(fromDBCompany);
  },

  async update(id: string, updates: Partial<Company>): Promise<void> {
    const updateData: Partial<DBCompany> = {
      updatedAt: Date.now()
    };
    
    // Only include defined fields
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.website !== undefined) updateData.website = updates.website;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.status !== undefined) updateData.status = updates.status;
    
    // Handle MVV fields
    if (updates.mission !== undefined) updateData.mission = updates.mission;
    if (updates.vision !== undefined) updateData.vision = updates.vision;
    if (updates.values !== undefined) updateData.values = updates.values;
    
    // Handle embeddings array
    if (updates.embeddings !== undefined) updateData.embeddings = updates.embeddings;
    
    // Convert Date objects to numbers
    if (updates.createdAt) {
      updateData.createdAt = updates.createdAt.getTime();
    }
    if (updates.lastProcessed) {
      updateData.lastProcessed = updates.lastProcessed.getTime();
    }
    
    // Handle errorMessage explicitly - clear if undefined, set if defined
    if ('errorMessage' in updates) {
      if (updates.errorMessage === undefined || updates.errorMessage === null) {
        // First update other fields, then clear errorMessage using modify
        if (Object.keys(updateData).length > 1) { // More than just updatedAt
          await db.companies.update(id, updateData);
        }
        await db.companies.where('id').equals(id).modify((company: DBCompany) => {
          delete company.errorMessage;
          company.updatedAt = Date.now();
        });
      } else {
        updateData.errorMessage = updates.errorMessage;
        await db.companies.update(id, updateData);
      }
    } else {
      await db.companies.update(id, updateData);
    }
  },

  async delete(id: string): Promise<void> {
    await db.transaction('rw', db.companies, db.mvvData, db.processingLogs, async () => {
      await db.companies.delete(id);
      await db.mvvData.where('companyId').equals(id).delete();
      await db.processingLogs.where('companyId').equals(id).delete();
    });
  },

  async deleteAll(): Promise<void> {
    await db.transaction('rw', db.companies, db.mvvData, db.processingLogs, async () => {
      await db.companies.clear();
      await db.mvvData.clear();
      await db.processingLogs.clear();
    });
  }
};

// MVVデータ関連の操作
export const mvvStorage = {
  async create(mvvData: MVVData): Promise<number> {
    // 既存のアクティブなデータを非アクティブ化
    await db.mvvData
      .where('companyId')
      .equals(mvvData.companyId)
      .modify({ isActive: false });
    
    return await db.mvvData.add(toDBMVVData(mvvData));
  },

  async getAll(activeOnly = true): Promise<MVVData[]> {
    if (activeOnly) {
      const allData = await db.mvvData.toArray();
      const activeData = allData.filter(mvv => mvv.isActive);
      return activeData.map(fromDBMVVData);
    }
    
    const dbMVVData = await db.mvvData.toArray();
    return dbMVVData.map(fromDBMVVData);
  },

  async getByCompanyId(companyId: string, activeOnly = true): Promise<MVVData[]> {
    let query = db.mvvData.where('companyId').equals(companyId);
    
    if (activeOnly) {
      const all = await query.toArray();
      const active = all.filter(mvv => mvv.isActive);
      return active.map(fromDBMVVData);
    }
    
    const dbMVVData = await query.toArray();
    return dbMVVData.map(fromDBMVVData);
  },

  async getActiveByCompanyId(companyId: string): Promise<MVVData | undefined> {
    const results = await this.getByCompanyId(companyId, true);
    return results[0];
  },

  async update(id: number, updates: Partial<MVVData>): Promise<void> {
    const updateData: Partial<DBMVVData> = {
      id: updates.id,
      companyId: updates.companyId,
      version: updates.version,
      mission: updates.mission,
      vision: updates.vision,
      values: updates.values,
      confidenceScores: updates.confidenceScores,
      source: updates.source,
      isActive: updates.isActive,
      extractedFrom: updates.extractedFrom
    };
    
    // Convert Date objects to numbers
    if (updates.extractedAt) {
      updateData.extractedAt = updates.extractedAt.getTime();
    }
    
    await db.mvvData.update(id, updateData);
  }
};

// 処理ログ関連の操作
export const processingLogStorage = {
  async create(log: ProcessingLog): Promise<number> {
    return await db.processingLogs.add(toDBProcessingLog(log));
  },

  async getByCompanyId(companyId: string): Promise<ProcessingLog[]> {
    const dbLogs = await db.processingLogs
      .where('companyId')
      .equals(companyId)
      .reverse()
      .toArray();
    return dbLogs.map(fromDBProcessingLog);
  },

  async getRecent(limit: number = 50): Promise<ProcessingLog[]> {
    const dbLogs = await db.processingLogs
      .orderBy('timestamp')
      .reverse()
      .limit(limit)
      .toArray();
    return dbLogs.map(fromDBProcessingLog);
  }
};

// データベース初期化
export const initializeDatabase = async (): Promise<void> => {
  try {
    await db.open();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
};
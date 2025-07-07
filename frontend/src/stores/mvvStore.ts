import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { MVVData } from '../types';
import { mvvStorage } from '../services/storage';

interface MVVState {
  mvvData: MVVData[];
  mvvDataMap: Map<string, MVVData>;
  loading: boolean;
  error: string | null;
}

interface MVVActions {
  loadMVVData: () => Promise<void>;
  getMVVByCompanyId: (companyId: string) => MVVData | undefined;
  addMVVData: (mvvData: MVVData) => Promise<void>;
  updateMVVData: (id: number, updates: Partial<MVVData>) => Promise<void>;
  setError: (error: string | null) => void;
  clearError: () => void;
}

type MVVStore = MVVState & MVVActions;

export const useMVVStore = create<MVVStore>()(
  devtools(
    (set, get) => ({
      // State
      mvvData: [],
      mvvDataMap: new Map(),
      loading: false,
      error: null,

      // Actions
      loadMVVData: async () => {
        set({ loading: true, error: null });
        try {
          // Note: This would need to be implemented to load all MVV data
          // For now, we'll load it on demand per company
          set({ loading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load MVV data';
          set({ error: errorMessage, loading: false });
        }
      },

      getMVVByCompanyId: (companyId: string) => {
        return get().mvvDataMap.get(companyId);
      },

      addMVVData: async (mvvData: MVVData) => {
        set({ loading: true, error: null });
        try {
          const id = await mvvStorage.create(mvvData);
          const newMVVData = { ...mvvData, id };
          
          set(state => {
            const updatedData = [...state.mvvData.filter(m => m.companyId !== mvvData.companyId), newMVVData];
            const updatedMap = new Map(state.mvvDataMap);
            updatedMap.set(mvvData.companyId, newMVVData);
            
            return {
              mvvData: updatedData,
              mvvDataMap: updatedMap,
              loading: false
            };
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to add MVV data';
          set({ error: errorMessage, loading: false });
        }
      },

      updateMVVData: async (id: number, updates: Partial<MVVData>) => {
        set({ loading: true, error: null });
        try {
          await mvvStorage.update(id, updates);
          
          set(state => {
            const updatedData = state.mvvData.map(mvv => 
              mvv.id === id ? { ...mvv, ...updates } : mvv
            );
            
            const updatedMap = new Map(state.mvvDataMap);
            const updatedMVV = updatedData.find(mvv => mvv.id === id);
            if (updatedMVV) {
              updatedMap.set(updatedMVV.companyId, updatedMVV);
            }
            
            return {
              mvvData: updatedData,
              mvvDataMap: updatedMap,
              loading: false
            };
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to update MVV data';
          set({ error: errorMessage, loading: false });
        }
      },

      setError: (error: string | null) => {
        set({ error });
      },

      clearError: () => {
        set({ error: null });
      }
    }),
    {
      name: 'mvv-store'
    }
  )
);
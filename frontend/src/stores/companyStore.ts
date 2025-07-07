import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Company, CompanyFormData, CompanyImportData } from '../types';
import { companyStorage } from '../services/storage';
import { generateId } from '../utils/formatters';

interface CompanyState {
  companies: Company[];
  loading: boolean;
  error: string | null;
  selectedCompany: Company | null;
}

interface CompanyActions {
  loadCompanies: () => Promise<void>;
  addCompany: (formData: CompanyFormData) => Promise<void>;
  addCompanies: (importData: CompanyImportData[]) => Promise<void>;
  updateCompany: (id: string, updates: Partial<Company>) => Promise<void>;
  deleteCompany: (id: string) => Promise<void>;
  deleteAllCompanies: () => Promise<void>;
  selectCompany: (company: Company | null) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

type CompanyStore = CompanyState & CompanyActions;

export const useCompanyStore = create<CompanyStore>()(
  devtools(
    (set) => ({
      // State
      companies: [],
      loading: false,
      error: null,
      selectedCompany: null,

      // Actions
      loadCompanies: async () => {
        set({ loading: true, error: null });
        try {
          const companies = await companyStorage.getAll();
          set({ companies, loading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load companies';
          set({ error: errorMessage, loading: false });
        }
      },

      addCompany: async (formData: CompanyFormData) => {
        set({ loading: true, error: null });
        try {
          const now = new Date();
          const company: Company = {
            id: generateId(),
            ...formData,
            status: 'pending',
            createdAt: now,
            updatedAt: now
          };

          await companyStorage.create(company);
          const companies = await companyStorage.getAll();
          set({ companies, loading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to add company';
          set({ error: errorMessage, loading: false });
        }
      },

      addCompanies: async (importData: CompanyImportData[]) => {
        set({ loading: true, error: null });
        try {
          const now = new Date();
          const companies: Company[] = importData.map(data => ({
            id: generateId(),
            ...data,
            status: 'pending' as const,
            createdAt: now,
            updatedAt: now
          }));

          await companyStorage.createMany(companies);
          const allCompanies = await companyStorage.getAll();
          set({ companies: allCompanies, loading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to import companies';
          set({ error: errorMessage, loading: false });
        }
      },

      updateCompany: async (id: string, updates: Partial<Company>) => {
        set({ loading: true, error: null });
        try {
          const updateData = {
            ...updates,
            updatedAt: new Date()
          };
          
          await companyStorage.update(id, updateData);
          const companies = await companyStorage.getAll();
          
          set(state => ({
            companies,
            loading: false,
            selectedCompany: state.selectedCompany?.id === id 
              ? { ...state.selectedCompany, ...updateData }
              : state.selectedCompany
          }));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to update company';
          set({ error: errorMessage, loading: false });
        }
      },

      deleteCompany: async (id: string) => {
        set({ loading: true, error: null });
        try {
          await companyStorage.delete(id);
          const companies = await companyStorage.getAll();
          
          set(state => ({
            companies,
            loading: false,
            selectedCompany: state.selectedCompany?.id === id ? null : state.selectedCompany
          }));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to delete company';
          set({ error: errorMessage, loading: false });
        }
      },

      deleteAllCompanies: async () => {
        set({ loading: true, error: null });
        try {
          await companyStorage.deleteAll();
          set({ companies: [], selectedCompany: null, loading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to delete all companies';
          set({ error: errorMessage, loading: false });
        }
      },

      selectCompany: (company: Company | null) => {
        set({ selectedCompany: company });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      clearError: () => {
        set({ error: null });
      }
    }),
    {
      name: 'company-store'
    }
  )
);
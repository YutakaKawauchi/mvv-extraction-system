import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { BatchProcessingStatus } from '../types';

interface ProcessingState {
  batchStatus: BatchProcessingStatus;
  processingQueue: string[];
  currentlyProcessing: string[];
  completedIds: string[];
  failedIds: string[];
}

interface ProcessingActions {
  startBatchProcessing: (companyIds: string[]) => void;
  updateProgress: (processed: number, succeeded: number, failed: number) => void;
  addToProcessing: (companyId: string) => void;
  removeFromProcessing: (companyId: string) => void;
  markCompleted: (companyId: string) => void;
  markFailed: (companyId: string) => void;
  completeBatchProcessing: () => void;
  resetProcessing: () => void;
}

type ProcessingStore = ProcessingState & ProcessingActions;

const initialBatchStatus: BatchProcessingStatus = {
  total: 0,
  processed: 0,
  succeeded: 0,
  failed: 0,
  inProgress: false
};

export const useProcessingStore = create<ProcessingStore>()(
  devtools(
    (set, get) => ({
      // State
      batchStatus: initialBatchStatus,
      processingQueue: [],
      currentlyProcessing: [],
      completedIds: [],
      failedIds: [],

      // Actions
      startBatchProcessing: (companyIds: string[]) => {
        set({
          batchStatus: {
            total: companyIds.length,
            processed: 0,
            succeeded: 0,
            failed: 0,
            inProgress: true,
            startTime: new Date()
          },
          processingQueue: [...companyIds],
          currentlyProcessing: [],
          completedIds: [],
          failedIds: []
        });
      },

      updateProgress: (processed: number, succeeded: number, failed: number) => {
        set(state => ({
          batchStatus: {
            ...state.batchStatus,
            processed,
            succeeded,
            failed
          }
        }));
      },

      addToProcessing: (companyId: string) => {
        set(state => ({
          currentlyProcessing: [...state.currentlyProcessing, companyId],
          processingQueue: state.processingQueue.filter(id => id !== companyId)
        }));
      },

      removeFromProcessing: (companyId: string) => {
        set(state => ({
          currentlyProcessing: state.currentlyProcessing.filter(id => id !== companyId)
        }));
      },

      markCompleted: (companyId: string) => {
        set(state => {
          const succeeded = state.completedIds.length + 1;
          const processed = succeeded + state.failedIds.length;
          
          return {
            completedIds: [...state.completedIds, companyId],
            currentlyProcessing: state.currentlyProcessing.filter(id => id !== companyId),
            batchStatus: {
              ...state.batchStatus,
              processed,
              succeeded
            }
          };
        });
      },

      markFailed: (companyId: string) => {
        set(state => {
          const failed = state.failedIds.length + 1;
          const processed = state.completedIds.length + failed;
          
          return {
            failedIds: [...state.failedIds, companyId],
            currentlyProcessing: state.currentlyProcessing.filter(id => id !== companyId),
            batchStatus: {
              ...state.batchStatus,
              processed,
              failed
            }
          };
        });
      },

      completeBatchProcessing: () => {
        set(state => ({
          batchStatus: {
            ...state.batchStatus,
            inProgress: false,
            endTime: new Date()
          }
        }));
      },

      resetProcessing: () => {
        set({
          batchStatus: initialBatchStatus,
          processingQueue: [],
          currentlyProcessing: [],
          completedIds: [],
          failedIds: []
        });
      }
    }),
    {
      name: 'processing-store'
    }
  )
);
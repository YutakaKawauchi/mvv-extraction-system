import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  AuthState, 
  LoginCredentials, 
  User, 
  SessionTimeRemaining 
} from '../types/auth';
import { authApi, AuthApiError } from '../utils/authApi';

const TOKEN_KEY = 'mvv_auth_token';
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const WARNING_THRESHOLD = 10 * 60 * 1000; // 10 minutes
const MIN_REFRESH_INTERVAL = 30 * 1000; // 30 seconds minimum between refreshes

// Track last refresh time
let lastRefreshTime = 0;

interface AuthStore extends AuthState {
  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
  refreshToken: () => Promise<boolean>;
  clearError: () => void;
  
  // Getters
  getRemainingTime: () => SessionTimeRemaining | null;
  isTokenExpiringSoon: () => boolean;
  
  // Internal
  _setLoading: (loading: boolean) => void;
  _setError: (error: string | null) => void;
  _setUser: (user: User | null) => void;
  _setAuthenticated: (authenticated: boolean) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      isAuthenticated: false,
      session: null,
      isLoading: false,
      error: null,
      user: null,

      // Actions
      login: async (credentials: LoginCredentials) => {
        const { _setLoading, _setError, _setUser, _setAuthenticated } = get();
        
        _setLoading(true);
        _setError(null);

        try {
          const response = await authApi.login(credentials);
          
          if (!response.success || !response.data) {
            throw new Error(response.error || 'Login failed');
          }

          // Store token
          localStorage.setItem(TOKEN_KEY, response.data.token);
          
          // Update state
          _setUser(response.data.user);
          _setAuthenticated(true);
          
          console.log('Login successful:', {
            username: response.data.user.username,
            expiresAt: response.data.expiresAt
          });

        } catch (error) {
          console.error('Login error:', error);
          
          if (error instanceof AuthApiError) {
            _setError(error.message);
            if (error.retryAfter) {
              setTimeout(() => _setError(null), error.retryAfter);
            }
          } else {
            _setError(error instanceof Error ? error.message : 'Login failed');
          }
          
          throw error;
        } finally {
          _setLoading(false);
        }
      },

      logout: () => {
        localStorage.removeItem(TOKEN_KEY);
        set({
          isAuthenticated: false,
          session: null,
          user: null,
          error: null
        });
        
        console.log('User logged out');
      },

      checkAuth: async () => {
        const { _setLoading, _setError, _setUser, _setAuthenticated } = get();
        
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) {
          _setAuthenticated(false);
          return false;
        }

        _setLoading(true);
        _setError(null);

        try {
          const response = await authApi.validateToken(token);
          
          if (response.success && response.data?.valid) {
            _setUser(response.data.user);
            _setAuthenticated(true);
            return true;
          } else {
            // Token is invalid
            localStorage.removeItem(TOKEN_KEY);
            _setAuthenticated(false);
            return false;
          }

        } catch (error) {
          console.error('Auth check error:', error);
          
          // Remove invalid token
          localStorage.removeItem(TOKEN_KEY);
          _setAuthenticated(false);
          
          if (error instanceof AuthApiError && error.status === 401) {
            // Token expired or invalid, don't show error to user
            return false;
          }
          
          _setError('Authentication check failed');
          return false;
        } finally {
          _setLoading(false);
        }
      },

      refreshToken: async () => {
        const { _setError, isLoading } = get();
        const now = Date.now();
        
        // Prevent multiple simultaneous refresh attempts
        if (isLoading) {
          console.log('Token refresh already in progress, skipping...');
          return false;
        }
        
        // Prevent too frequent refresh attempts
        if (now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
          console.log(`Token refresh rate limited, last refresh was ${Math.round((now - lastRefreshTime) / 1000)}s ago`);
          return false;
        }
        
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) {
          return false;
        }

        try {
          set({ isLoading: true });
          lastRefreshTime = now;
          
          const response = await authApi.refreshToken(token);
          
          if (response.success && response.data) {
            localStorage.setItem(TOKEN_KEY, response.data.token);
            console.log('Token refreshed, expires at:', response.data.expiresAt);
            return true;
          }
          
          return false;

        } catch (error) {
          console.error('Token refresh error:', error);
          
          if (error instanceof AuthApiError && error.status === 401) {
            // Token cannot be refreshed, logout user
            console.log('Token expired and cannot be refreshed, logging out...');
            get().logout();
          } else {
            _setError('Failed to refresh session');
          }
          
          return false;
        } finally {
          set({ isLoading: false });
        }
      },

      clearError: () => {
        set({ error: null });
      },

      getRemainingTime: () => {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) return null;

        try {
          // Decode JWT payload without verification (just for expiration time)
          const payload = JSON.parse(atob(token.split('.')[1]));
          const expiresAt = payload.exp * 1000; // Convert to milliseconds
          const now = Date.now();
          const remaining = expiresAt - now;

          if (remaining <= 0) {
            return null;
          }

          const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
          const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
          const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

          return {
            days,
            hours,
            minutes,
            total: remaining
          };
        } catch (error) {
          console.error('Error parsing token expiration:', error);
          return null;
        }
      },

      isTokenExpiringSoon: () => {
        const remaining = get().getRemainingTime();
        return remaining ? remaining.total < WARNING_THRESHOLD : false;
      },

      // Internal setters
      _setLoading: (loading: boolean) => set({ isLoading: loading }),
      _setError: (error: string | null) => set({ error }),
      _setUser: (user: User | null) => set({ user }),
      _setAuthenticated: (authenticated: boolean) => set({ isAuthenticated: authenticated }),
    }),
    {
      name: 'mvv-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Auto-refresh token setup
let refreshInterval: NodeJS.Timeout | null = null;

export const startTokenRefresh = () => {
  if (refreshInterval) return;

  refreshInterval = setInterval(async () => {
    const store = useAuthStore.getState();
    
    if (store.isAuthenticated && store.isTokenExpiringSoon()) {
      console.log('Token expiring soon, attempting refresh...');
      await store.refreshToken();
    }
  }, REFRESH_INTERVAL);
};

export const stopTokenRefresh = () => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
};
export interface AuthSession {
  authenticated: boolean;
  expires: string;
  createdAt: string;
  lastActivity: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  session: AuthSession | null;
  isLoading: boolean;
  error: string | null;
  user: User | null;
}

export interface User {
  username: string;
  role: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  data?: {
    token: string;
    user: User;
    expiresAt: string;
  };
  error?: string;
}

export interface ValidateResponse {
  success: boolean;
  data?: {
    valid: boolean;
    user: User;
    expiresAt: string;
    issuedAt: string;
  };
  error?: string;
}

export interface RefreshResponse {
  success: boolean;
  data?: {
    token: string;
    expiresAt: string;
  };
  error?: string;
}

export interface SessionTimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  total: number; // in milliseconds
}

export interface AuthError {
  message: string;
  code?: string;
  retryAfter?: number;
}
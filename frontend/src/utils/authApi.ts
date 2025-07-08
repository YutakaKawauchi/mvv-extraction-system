import type { 
  LoginCredentials, 
  LoginResponse, 
  ValidateResponse, 
  RefreshResponse 
} from '../types/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/.netlify/functions';

class AuthApiError extends Error {
  status?: number;
  retryAfter?: number;
  
  constructor(
    message: string, 
    status?: number, 
    retryAfter?: number
  ) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export const authApi = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth-login-v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (!response.ok) {
        const retryAfter = response.headers.get('Retry-After');
        throw new AuthApiError(
          data.error || 'Login failed',
          response.status,
          retryAfter ? parseInt(retryAfter) * 1000 : undefined
        );
      }

      return data;
    } catch (error) {
      if (error instanceof AuthApiError) {
        throw error;
      }
      
      console.error('Login API error:', error);
      throw new AuthApiError('Network error during login');
    }
  },

  async validateToken(token: string): Promise<ValidateResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth-validate-v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new AuthApiError(
          data.error || 'Token validation failed',
          response.status
        );
      }

      return data;
    } catch (error) {
      if (error instanceof AuthApiError) {
        throw error;
      }
      
      console.error('Token validation API error:', error);
      throw new AuthApiError('Network error during token validation');
    }
  },

  async refreshToken(token: string): Promise<RefreshResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth-refresh-v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new AuthApiError(
          data.error || 'Token refresh failed',
          response.status
        );
      }

      return data;
    } catch (error) {
      if (error instanceof AuthApiError) {
        throw error;
      }
      
      console.error('Token refresh API error:', error);
      throw new AuthApiError('Network error during token refresh');
    }
  },
};

export { AuthApiError };
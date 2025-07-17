# Netlify Functions Authentication Design

## Overview
Server-side authentication using Netlify Functions with environment variables for secure credential management.

## Architecture

### Backend Structure
```
backend/netlify/functions/
├── auth/
│   ├── login.js          # Login endpoint
│   ├── validate.js       # Token validation
│   └── refresh.js        # Token refresh
└── utils/
    ├── auth.js           # Enhanced auth utilities
    └── jwt.js            # JWT handling
```

### Frontend Structure
```
frontend/src/
├── components/auth/
│   ├── Login.tsx         # Login form
│   ├── AuthGuard.tsx     # Route protection
│   └── SessionStatus.tsx # Session display
├── stores/authStore.ts   # Auth state management
└── utils/authApi.ts      # API client
```

## Authentication Flow

### 1. Login Process
```
Frontend → POST /auth/login → Netlify Function
├── Validate credentials against env vars
├── Generate JWT token (24h expiry)
├── Return token + user info
└── Store token in httpOnly cookie + localStorage
```

### 2. Request Authorization
```
Frontend → API Request → Netlify Function
├── Extract token from Authorization header
├── Validate token with JWT
├── Check expiration
└── Proceed with request or return 401
```

### 3. Token Refresh
```
Frontend → POST /auth/refresh → Netlify Function
├── Validate current token
├── Generate new token
└── Update client storage
```

## Environment Variables

### Netlify Environment Setup
```bash
# Authentication credentials
AUTH_USERNAME=admin
AUTH_PASSWORD=secure_password_2025!

# JWT configuration
JWT_SECRET=your-super-secret-jwt-key-256-bits
JWT_EXPIRATION=24h

# Rate limiting
LOGIN_RATE_LIMIT=5  # attempts per 15 minutes
```

## API Endpoints

All authentication endpoints use the v2 implementation for production.

### POST /.netlify/functions/auth-login-v2
```javascript
// Request
{
  "username": "admin",
  "password": "secure_password_2025!"
}

// Response (Success)
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "username": "admin",
      "role": "admin"
    },
    "expiresAt": "2025-01-09T12:00:00Z"
  }
}

// Response (Error)
{
  "success": false,
  "error": "Invalid credentials"
}
```

### POST /.netlify/functions/auth-validate-v2
```javascript
// Request Header
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

// Response (Success)
{
  "success": true,
  "data": {
    "valid": true,
    "user": {
      "username": "admin",
      "role": "admin"
    },
    "expiresAt": "2025-01-09T12:00:00Z"
  }
}
```

### POST /.netlify/functions/auth-refresh-v2
```javascript
// Request Header
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

// Response (Success)
{
  "success": true,
  "data": {
    "token": "new_jwt_token_here",
    "expiresAt": "2025-01-10T12:00:00Z"
  }
}
```

## Security Features

### 1. Rate Limiting
- 5 login attempts per 15 minutes per IP
- Exponential backoff on failed attempts
- IP-based blocking for persistent abuse

### 2. Token Security
- JWT with 24-hour expiration
- Secure, HttpOnly cookies for web storage
- Automatic token refresh mechanism
- Secure random JWT secret

### 3. Environment Protection
- All credentials stored in Netlify environment
- No sensitive data in client code
- Environment-specific configuration

### 4. Request Validation
- All API endpoints protected by auth middleware
- Token validation on every request
- Proper error handling without information leakage

## Implementation Details

### Backend Function Structure
```javascript
// backend/netlify/functions/auth/login.js
exports.handler = async (event, context) => {
  // CORS handling
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }

  // Rate limiting check
  const rateLimitResult = await checkRateLimit(event.headers);
  if (!rateLimitResult.allowed) {
    return errorResponse(429, 'Too many attempts');
  }

  // Validate credentials
  const { username, password } = JSON.parse(event.body);
  if (!validateCredentials(username, password)) {
    return errorResponse(401, 'Invalid credentials');
  }

  // Generate JWT token
  const token = generateJWT({ username, role: 'admin' });
  
  return successResponse({
    token,
    user: { username, role: 'admin' },
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  });
};
```

### Frontend Store Integration
```typescript
// frontend/src/stores/authStore.ts
interface AuthStore {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
}

const useAuthStore = create<AuthStore>((set, get) => ({
  isAuthenticated: false,
  user: null,
  token: null,

  login: async (credentials) => {
    const response = await fetch('/.netlify/functions/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('auth_token', data.token);
      set({ 
        isAuthenticated: true, 
        user: data.user, 
        token: data.token 
      });
    }
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    set({ 
      isAuthenticated: false, 
      user: null, 
      token: null 
    });
  }
}));
```

## Existing API Integration

### Middleware Update
```javascript
// backend/utils/auth.js (Enhanced)
const validateApiAccess = (event) => {
  // Check for API key (existing MVV functions)
  const apiKey = event.headers['x-api-key'];
  if (apiKey && apiKey === process.env.MVP_API_SECRET) {
    return { valid: true, type: 'api_key' };
  }

  // Check for JWT token (new auth system)
  const authHeader = event.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = validateJWT(token);
    if (decoded) {
      return { valid: true, type: 'jwt', user: decoded };
    }
  }

  return { valid: false };
};
```

### Protected Route Example
```javascript
// Any existing function (e.g., extract-mvv.js)
exports.handler = async (event, context) => {
  // Enhanced auth check
  const authResult = validateApiAccess(event);
  if (!authResult.valid) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  // Log authentication type
  logger.info('Request authenticated', { 
    type: authResult.type,
    user: authResult.user?.username || 'api_key'
  });

  // Existing function logic continues...
};
```

## Deployment Configuration

### Netlify Environment Variables
```bash
# Set via Netlify CLI
netlify env:set AUTH_USERNAME "admin"
netlify env:set AUTH_PASSWORD "secure_password_2025!"
netlify env:set JWT_SECRET "your-super-secret-jwt-key-256-bits"
netlify env:set JWT_EXPIRATION "24h"
netlify env:set LOGIN_RATE_LIMIT "5"
```

### Local Development (.env)
```bash
# backend/.env
AUTH_USERNAME=admin
AUTH_PASSWORD=dev_password_2025!
JWT_SECRET=development-jwt-secret-key
JWT_EXPIRATION=24h
LOGIN_RATE_LIMIT=10
```

## Migration Strategy

### Phase 1: Backend Implementation
1. Create auth functions
2. Add JWT utilities
3. Update existing API middleware
4. Test authentication endpoints

### Phase 2: Frontend Integration
1. Create auth components
2. Implement auth store
3. Add route protection
4. Update API client

### Phase 3: Deployment
1. Set production environment variables
2. Deploy backend functions
3. Update frontend build
4. Test full authentication flow

## Benefits Over Client-Side

### Security Improvements
- ✅ Credentials never exposed to client
- ✅ Server-side validation
- ✅ Rate limiting protection
- ✅ Secure token generation
- ✅ Environment-based configuration

### Operational Benefits
- ✅ Easy credential rotation
- ✅ Centralized authentication logic
- ✅ Audit trail capabilities
- ✅ Scalable to multiple users
- ✅ Professional authentication flow

### GitHub Pages Compatibility
- ✅ Still works with static hosting
- ✅ Netlify Functions handle auth
- ✅ No server required
- ✅ Maintains existing architecture
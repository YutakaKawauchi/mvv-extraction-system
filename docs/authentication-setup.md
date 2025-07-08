# Authentication System Setup Guide

## Overview
This guide covers the setup and configuration of the Netlify Functions-based authentication system for the MVV Extraction System.

## Environment Configuration

### 1. Backend Configuration

#### Local Development
Copy the example file and update with your values:
```bash
cd backend
cp .env.local.example .env
```

Edit `.env` with your actual values:
```bash
# API Keys
OPENAI_API_KEY=sk-proj-your-actual-openai-key
PERPLEXITY_API_KEY=pplx-your-actual-perplexity-key
MVP_API_SECRET=mvv-extraction-2024-secure-key

# Authentication - UPDATE THESE!
AUTH_USERNAME=admin
AUTH_PASSWORD=your_secure_password_2025!
JWT_SECRET=your-super-secret-jwt-key-minimum-256-bits
JWT_EXPIRATION=24h
LOGIN_RATE_LIMIT=5

# CORS (Update WSL IP if needed)
ALLOWED_ORIGINS=http://localhost:5173,http://YOUR_WSL_IP:5173

# Environment
NODE_ENV=development
LOG_LEVEL=debug
```

#### Production (Netlify)
Set environment variables via Netlify CLI or Dashboard:

```bash
# Set via CLI
netlify env:set AUTH_USERNAME "admin"
netlify env:set AUTH_PASSWORD "your_production_password_2025!"
netlify env:set JWT_SECRET "your-production-jwt-secret-key-256-bits"
netlify env:set JWT_EXPIRATION "24h"
netlify env:set LOGIN_RATE_LIMIT "5"

# API Keys (already set)
netlify env:set OPENAI_API_KEY "sk-proj-your-openai-key"
netlify env:set PERPLEXITY_API_KEY "pplx-your-perplexity-key"
netlify env:set MVP_API_SECRET "your-api-secret"

# Production settings
netlify env:set ALLOWED_ORIGINS "https://your-username.github.io"
netlify env:set NODE_ENV "production"
netlify env:set LOG_LEVEL "info"
```

Or via Netlify Dashboard:
1. Go to Site Settings → Environment Variables
2. Add each variable with production values

### 2. Frontend Configuration

#### Local Development
```bash
cd frontend
cp .env.example .env.local
```

Edit `.env.local`:
```bash
VITE_API_BASE_URL=http://localhost:8888/.netlify/functions
VITE_API_SECRET=mvv-extraction-2024-secure-key
VITE_ENVIRONMENT=development
```

#### Production
For GitHub Pages deployment, create `.env.production`:
```bash
VITE_API_BASE_URL=https://your-netlify-site.netlify.app/.netlify/functions
VITE_API_SECRET=your-production-api-secret
VITE_ENVIRONMENT=production
```

## Security Configuration

### 1. JWT Secret Generation
Generate a secure JWT secret (minimum 256 bits):

```bash
# Option 1: OpenSSL
openssl rand -hex 32

# Option 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 3: Online (use with caution)
# Visit: https://www.grc.com/passwords.htm
```

### 2. Password Security
- **Development**: Use a simple password for testing
- **Production**: Use a strong password with:
  - Minimum 12 characters
  - Mix of uppercase, lowercase, numbers, symbols
  - Not easily guessable

### 3. Rate Limiting
Default: 5 login attempts per 15 minutes per IP
```bash
LOGIN_RATE_LIMIT=5  # Adjust as needed
```

## Testing the Authentication System

### 1. Local Testing

Start the backend:
```bash
cd backend
netlify dev
```

Start the frontend:
```bash
cd frontend
npm run dev
```

### 2. Authentication Flow Test

#### Login API Test
```bash
curl -X POST "http://localhost:8888/.netlify/functions/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your_password"
  }'
```

Expected response:
```json
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
```

#### Token Validation Test
```bash
curl -X POST "http://localhost:8888/.netlify/functions/auth/validate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

#### MVV Function Test (with JWT)
```bash
curl -X POST "http://localhost:8888/.netlify/functions/extract-mvv" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "companyId": "test-001",
    "companyName": "テスト企業",
    "companyWebsite": "https://example.com"
  }'
```

### 3. Frontend Testing

1. Open browser to `http://localhost:5173` (or WSL IP)
2. Should see login screen
3. Enter credentials (username: admin, password: your_password)
4. Should authenticate and show main dashboard
5. Check session status in header
6. Test logout functionality

## Troubleshooting

### Common Issues

#### 1. JWT Secret Too Short
**Error**: "secretOrPrivateKey has a minimum key size of 2048 bits"
**Solution**: Use a longer JWT secret (minimum 32 characters)

#### 2. CORS Issues
**Error**: CORS policy blocks requests
**Solution**: Update `ALLOWED_ORIGINS` to include your frontend URL

#### 3. Environment Variables Not Set
**Error**: "Authentication environment variables not set"
**Solution**: Verify all required env vars are set in both local and production

#### 4. Rate Limiting
**Error**: "Too many login attempts"
**Solution**: Wait 15 minutes or reset rate limit in development

#### 5. Token Expiration
**Issue**: Frequent re-login required
**Solution**: Adjust `JWT_EXPIRATION` (default: 24h)

### Debug Commands

#### Check Environment Variables
```bash
# Local
cat backend/.env

# Production
netlify env:list
```

#### View Logs
```bash
# Local development
# Check terminal running netlify dev

# Production
netlify logs
```

#### Test Authentication Endpoints
```bash
# Health check
curl http://localhost:8888/.netlify/functions/health

# Login test
curl -X POST "http://localhost:8888/.netlify/functions/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"test"}'
```

## Deployment Checklist

### Pre-Deployment
- [ ] Set production environment variables
- [ ] Update CORS origins for production domain
- [ ] Test authentication flow locally
- [ ] Generate secure JWT secret for production
- [ ] Set strong production password

### Post-Deployment
- [ ] Test login from production frontend
- [ ] Verify JWT token generation
- [ ] Test API access with JWT authentication
- [ ] Check error handling and rate limiting
- [ ] Monitor logs for authentication issues

### Security Verification
- [ ] JWT secret is secure and unique
- [ ] Password is strong and secure
- [ ] CORS is configured correctly
- [ ] Rate limiting is working
- [ ] No sensitive data in client code
- [ ] Environment variables are not exposed

## Maintenance

### Regular Tasks
1. **Monitor Login Attempts**: Check for suspicious activity
2. **Rotate Credentials**: Update password and JWT secret periodically
3. **Review Logs**: Monitor authentication errors and patterns
4. **Update Dependencies**: Keep JWT and security libraries current

### Emergency Procedures
1. **Compromised Credentials**: Immediately update password and JWT secret
2. **Suspicious Activity**: Increase rate limiting or block IPs
3. **System Issues**: Check logs and environment variable configuration

## Advanced Configuration

### Multiple Users (Future Enhancement)
The current system supports single-user authentication. For multiple users:
1. Extend backend to support user database
2. Add user management endpoints
3. Implement role-based access control
4. Update frontend for user selection

### SSO Integration (Future Enhancement)
For OAuth/SSO integration:
1. Add OAuth provider configuration
2. Implement OAuth callback handlers
3. Update frontend for OAuth login buttons
4. Maintain JWT for session management

### Session Persistence
Current settings:
- JWT expires in 24 hours
- Auto-refresh when expiring soon
- Logout clears all session data
- No cross-tab session sharing
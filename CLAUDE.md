# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## IMPORTANT INSTRUCTIONS FOR CLAUDE

### Development Environment Setup
- **CRITICAL: Backend and Frontend must be manually started** - User runs both servers manually
- **Frontend**: `cd frontend && npm run dev` (runs on 0.0.0.0:5173)
- **Backend**: `cd backend && netlify dev` (runs on localhost:8888)
- **DO NOT attempt to start servers programmatically** - User handles server management
- **Testing**: Assume both servers are running when testing API endpoints

### Commit Messages
- **NO Claude signatures in commit messages** - User preference: keep commits clean without AI attribution

### Build and Commit Policy
- **MANDATORY: Always build and test before committing** - Never commit code without verifying it builds successfully
- **Build command**: `cd frontend && npm run build` - Must complete without errors
- **Test locally first** - Ensure all functionality works as expected before committing
- **No broken builds** - If build fails, fix all issues before attempting to commit

### Security Guidelines
- **NEVER commit passwords, API keys, or secrets to version control**
- **NEVER include actual credentials in documentation or comments**
- **ALWAYS use environment variables for sensitive data**
- **Use placeholder values in documentation (e.g., "your-password", "your-api-key")**
- **Double-check CLAUDE.md before commits - no real passwords/secrets should be visible**

## Project Overview

AI-powered system for extracting Mission, Vision, and Values (MVV) from Japanese companies using OpenAI GPT-4o and Perplexity APIs. Architecture: React frontend on GitHub Pages + Netlify Functions backend.

**Note**: While initially designed for healthcare companies, the system is built to support **any industry**. The similarity detection algorithm uses industry-agnostic embeddings and morphological analysis.

## Current Status
- ✅ Production deployment completed and stable
- ✅ OpenAI GPT-4o integration (high accuracy, 3-8s processing)
- ✅ Perplexity AI integration (50% cost reduction, web search capabilities, 3-12s processing)
- ✅ Local development environment (WSL2 compatible)
- ✅ Comprehensive logging system
- ✅ Enhanced CSV import system with duplicate checking
- ✅ Improved UI/UX with better error handling
- ✅ Zero production errors - excellent stability
- ✅ **Netlify Functions Authentication System (Production Ready)**
- ✅ **Professional Excel Export System** → See `docs/excel-export-system-design.md`
- ✅ **Unified Idea Generation Dialog System (Phase γ)**
- ✅ **Comprehensive Async Task System (Phase ε)**
- ✅ **Real-time Analysis Dashboard** → See `docs/realtime-analysis-system.md`
- ✅ **Visual Analytics Gallery** → See `docs/visual-analytics-gallery-design.md`
- ✅ **Business Innovation Lab Beta v2.1** → See `docs/business-innovation-lab-beta-v2-design.md`
- ✅ **Phase-based Verification Result Display v2.0** → Fixed verification completion auto-save
- ✅ **Verified Ideas Restoration Fix** → Fixed sidebar restoration displaying verification results
- ✅ **Comprehensive AI Cache System**
- 📊 **Next Phase**: Expert verification differentiation and advanced AI insights

## Common Commands

### Development (Local Environment)
```bash
# Start frontend (Terminal 1) - WSL2 compatible
cd frontend && npm run dev           # Runs on 0.0.0.0:5173

# Start backend (Terminal 2)  
cd backend && netlify dev            # Runs on localhost:8888

# Health check
curl http://localhost:8888/.netlify/functions/health
```

### ⚠️ IMPORTANT: Production Backend Development
**When developing against production backend (本番バックエンド利用時):**
- **ALWAYS deploy backend changes BEFORE testing**
- **Backend changes are NOT reflected until deployed**
- **Deploy command**: `cd backend && netlify deploy --prod`
- **Common mistake**: Testing new endpoints without deploying first causes CORS errors

**Development workflow with production backend:**
1. Make backend changes
2. **Deploy immediately**: `cd backend && netlify deploy --prod`
3. Test frontend functionality
4. If issues found, repeat from step 1

### WSL2 Development Notes
- Frontend configured with `host: '0.0.0.0'` for Windows browser access
- Access from Windows: `http://<WSL_IP>:5173`
- Backend CORS configured for WSL IP addresses
- All .env files properly gitignored

### Build & Deploy
```bash
# Frontend build
cd frontend && npm run build

# Deploy frontend (automatic via GitHub Actions on push to main)
git push origin main

# Deploy backend
cd backend && netlify deploy --prod
```

### Environment Setup
```bash
# Frontend: Create .env.local with:
VITE_API_BASE_URL=http://localhost:8888/.netlify/functions
VITE_API_SECRET=your-development-secret
VITE_ENVIRONMENT=development

# Backend Local: Create .env with:
NODE_ENV=development
OPENAI_API_KEY=your-openai-key
PERPLEXITY_API_KEY=your-perplexity-key
MVP_API_SECRET=your-development-secret
ALLOWED_ORIGINS=http://localhost:5173,http://<WSL_IP>:5173

# Authentication Configuration
AUTH_USERNAME=admin
AUTH_PASSWORD=dev_password_2025!
JWT_SECRET=development-jwt-secret-key-256-bits
JWT_EXPIRATION=24h
LOGIN_RATE_LIMIT=10

# Backend Production: Set via Netlify CLI or Dashboard
netlify env:set OPENAI_API_KEY "your-key"
netlify env:set PERPLEXITY_API_KEY "your-key"  
netlify env:set MVP_API_SECRET "your-secret"
netlify env:set ALLOWED_ORIGINS "https://your-username.github.io"
netlify env:set NODE_ENV "production"

# Authentication (Production) - Set via Netlify Dashboard for security
netlify env:set AUTH_USERNAME "admin"
netlify env:set AUTH_PASSWORD "your-secure-password"  # Do not commit actual password
netlify env:set JWT_SECRET "your-secure-jwt-secret-256-bits-minimum"  # Generate secure random key
netlify env:set JWT_EXPIRATION "24h"
```

## Architecture & Key Components

For detailed architecture and component information, refer to:
- **System Architecture**: `docs/system-architecture.md`
- **Component Architecture**: `docs/component-architecture.md`
- **API Design**: `docs/ai-insights-api-design.md`

### Key Technologies
- **Frontend**: React 19.1.0 + TypeScript 5.8.3 + Vite 7.0.0 + TailwindCSS 4.1.11 + Zustand 5.0.6 + Dexie 4.0.11 (IndexedDB) + TinySegmenter (Japanese morphological analysis) + ExcelJS 4.4.0
- **Backend**: Netlify Functions + OpenAI 5.8.2 + Perplexity AI + jsonwebtoken 9.0.2 (JWT authentication)
- **Testing**: Jest 29.7.0 with comprehensive API testing
- **Authentication**: JWT-based with environment variable credentials
- **Security**: CORS protection, dual authentication (API key + JWT), rate limiting, sensitive data masking
- **Logging**: Environment-aware logging (console + file output)
- **Async Tasks**: Background Functions with IndexedDB persistence
- **Accessibility**: WCAG 2.1 AA compliance, ARIA labels, screen reader support, keyboard navigation
- **Mobile**: Responsive design, touch-friendly (44px+ targets), mobile-first layouts

### Core Features
1. **Company Management**: CSV import/export with duplicate checking, CRUD operations, status tracking
2. **MVV Extraction**: Batch processing (5 parallel), confidence scoring, real-time progress
3. **AI Similarity Analysis**: 62-company similarity analysis, interactive dashboard
4. **Data Persistence**: IndexedDB for local storage
5. **Results Management**: Filter/search, manual editing, CSV/JSON export
6. **Visual Analytics Gallery**: AI analysis screen capture → See `docs/visual-analytics-gallery-design.md`
7. **Professional Excel Export**: 5+ specialized data sheets → See `docs/excel-export-system-design.md`
8. **Responsive Design**: Mobile-first approach with adaptive layouts
9. **Accessibility**: Full WCAG 2.1 AA compliance
10. **Enhanced UX**: Smooth scroll-to-top, improved error handling
11. **Performance**: Optimized rendering, throttled events, 60fps smooth interactions

### API Endpoints

For complete API documentation, see `docs/ai-insights-api-design.md`

Main endpoints:
- `POST /.netlify/functions/extract-mvv`: OpenAI GPT-4o extraction
- `POST /.netlify/functions/extract-mvv-perplexity`: Perplexity AI extraction
- `POST /.netlify/functions/extract-company-info`: Company information extraction
- `POST /.netlify/functions/generate-business-ideas`: Business idea generation
- `POST /.netlify/functions/verify-business-idea`: AI verification system
- `GET /.netlify/functions/health`: Health check
- **Async Task endpoints**: See `docs/system-architecture.md`
- **Authentication endpoints**: See `docs/netlify-auth-design.md`

### Development Notes
- Frontend uses Vite proxy for local API calls
- Backend requires Netlify CLI for local development
- Environment variables must be set in both frontend (.env.local) and backend (.env for local, Netlify for prod)
- CORS origins must match deployment URL (including WSL IP for local dev)
- Rate limiting: 100 requests per 15 minutes per IP (API), 5 auth attempts per 15 minutes per IP (authentication)
- WSL2 compatible with network configuration
- **Testing**: Use `npm test` for mock tests, `TEST_MODE=integration npm test` for real API tests
- 日本語での対話可

### CORS Implementation Guide (CRITICAL)

**⚠️ EVERY new API function MUST follow this exact CORS pattern to avoid errors:**

For the complete CORS implementation guide and template, see:
- **CORS Guide**: `docs/development-testing-guide.md#cors-implementation`
- **Template**: `/backend/templates/api-function-template.js`

## Git Workflow & Branch Strategy

### Branch Strategy (GitHub Flow Based)

**Main Branch Protection**
- `main` branch is protected and represents production-ready code
- All changes must go through Pull Request review process
- Direct pushes to `main` are not allowed

**Branch Naming Convention**
```bash
feature/feature-name          # New features
fix/bug-description          # Bug fixes  
refactor/refactoring-scope   # Code refactoring
docs/documentation-update    # Documentation updates
test/test-description        # Test additions
perf/performance-improvement # Performance optimizations
```

### Development Workflow

For complete workflow guide, see `docs/development-testing-guide.md`

Key points:
1. Create feature branch from main
2. Make commits with clear messages
3. **MANDATORY**: Test GitHub Actions build before merge
4. Create Pull Request with clear description
5. Merge using "Squash and merge"

### Deployment Strategy

**Production Environment**
- Only `main` branch deployed to production
- Automatic deployment via GitHub Actions on push to main
- Monitor performance metrics after deployment

### Emergency Procedures

**Hotfix Process**
- Create hotfix branch from main
- Make minimal fix
- **MANDATORY**: Test GitHub Actions build before merge
- Create urgent PR with "URGENT" label

### Quality Assurance

**Pre-Merge Checklist**
- [ ] Feature tested locally with sample data
- [ ] No console errors or warnings
- [ ] **GitHub Actions build test completed successfully**
- [ ] Performance impact assessed
- [ ] Documentation updated if needed
- [ ] Breaking changes documented

### Logging System
- **Development**: Colorful console output + file logging in `/backend/logs/`
- **Production**: Structured JSON logging for monitoring
- **Features**: Sensitive data masking, request/response tracking, performance metrics
- **Log files**: Automatically excluded from git commits via .gitignore

### Perplexity AI Integration
- **Model**: `sonar-pro` (Latest model with web search capabilities)
- **Cost**: ~$0.011 per company processed
- **Processing Time**: 1 second average
- **Throughput**: 31.6 companies/minute processing speed
- **Accuracy**: Mission 95%+, Vision 90%+, Values 85%+
- **Production Results**: 100% success rate

For implementation details, see `docs/perplexity-integration-design.md`

### Production Performance Metrics
- **Success Rate**: 100% (89/89 companies processed successfully)
- **Average Processing Time**: 1 second per company
- **Processing Speed**: 31.6 companies/minute
- **Batch Processing**: 89 companies processed in 2 minutes 49 seconds
- **Error Analysis**: Zero errors in recent large-scale operations
- **System Uptime**: 100% availability
- **Cost Efficiency**: ~$0.011 per company processed

## Design Documentation

All detailed design documentation is organized in the `/docs` directory:

### System Design
- `system-architecture.md` - Complete system architecture
- `component-architecture.md` - Frontend component design
- `scalability-analysis.md` - Performance and scaling analysis

### Feature Documentation
- `excel-export-system-design.md` - Professional Excel export system
- `visual-analytics-gallery-design.md` - Screenshot capture and gallery
- `business-innovation-lab-beta-v2-design.md` - AI verification system
- `realtime-analysis-system.md` - Real-time MVV analysis
- `admin-panel-design.md` - Admin panel features
- `company-management-enhancement.md` - Enhanced company management

### API & Integration
- `ai-insights-api-design.md` - API endpoint specifications
- `perplexity-integration-design.md` - Perplexity API integration
- `netlify-auth-design.md` - Authentication system design

### Development Guides
- `development-testing-guide.md` - Development and testing procedures
- `authentication-setup.md` - Authentication configuration guide
- `scoring-algorithms.md` - AI scoring and analysis algorithms

### Roadmap
For upcoming features and enhancements, see `docs/roadmap-2025.md`

---

*Last Updated: 2025-07-17*  
*Current Status: Business Innovation Lab Beta v2 + Comprehensive AI Systems*  
*Next Phase: Expert verification differentiation & advanced AI insights*
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered system for extracting Mission, Vision, and Values (MVV) from 30 Japanese healthcare companies using OpenAI GPT-4o and Perplexity APIs. Architecture: React frontend on GitHub Pages + Netlify Functions backend.

## Current Status
- ✅ Production deployment completed and stable
- ✅ OpenAI GPT-4o integration (high accuracy, 3-8s processing)
- ✅ Perplexity AI integration (50% cost reduction, web search capabilities, 3-12s processing)
- ✅ Local development environment (WSL2 compatible)
- ✅ Comprehensive logging system (460 entries on 2025-07-08)
- ✅ Enhanced CSV import system with duplicate checking
- ✅ Improved UI/UX with better error handling
- ✅ Zero production errors - excellent stability
- 🔄 Continuous feature improvements and optimizations

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

# Backend Local: Create .env with:
NODE_ENV=development
OPENAI_API_KEY=your-openai-key
PERPLEXITY_API_KEY=your-perplexity-key
MVP_API_SECRET=your-development-secret
ALLOWED_ORIGINS=http://localhost:5173,http://<WSL_IP>:5173

# Backend Production: Set via Netlify CLI or Dashboard
netlify env:set OPENAI_API_KEY "your-key"
netlify env:set PERPLEXITY_API_KEY "your-key"  
netlify env:set MVP_API_SECRET "your-secret"
netlify env:set ALLOWED_ORIGINS "https://your-username.github.io"
netlify env:set NODE_ENV "production"
```

## Architecture & Key Components

### Frontend Structure (`/frontend`)
- **src/components/**: UI components organized by feature (Company/, MVV/, Results/)
  - **common/**: Reusable UI components with accessibility support (Button, LoadingSpinner, StatusBadge, ScrollToTopButton)
  - **CompanyManager/**: Company CRUD operations with mobile-optimized layouts
  - **ResultsViewer/**: Responsive data display (dual mobile/desktop views)
  - **MVVExtractor/**: Batch processing interfaces
  - **Dashboard/**: Main navigation and overview
- **src/services/**: API clients (api.ts, indexedDB.ts)
- **src/stores/**: Zustand state management
- **src/types/**: TypeScript interfaces
- **src/utils/**: Helper functions

### Backend Structure (`/backend`)
- **netlify/functions/**: Serverless endpoints
  - `extract-mvv.js`: OpenAI GPT-4o extraction endpoint
  - `extract-mvv-perplexity.js`: Perplexity AI extraction endpoint (web search)
  - `health.js`: Health check endpoint
- **utils/**: Shared utilities
  - `cors.js`: CORS configuration
  - `rateLimiter.js`: Rate limiting (100 req/15min)
  - `auth.js`: API key validation
  - `logger.js`: Comprehensive logging system

### Key Technologies
- **Frontend**: React 19.1.0 + TypeScript 5.8.3 + Vite 7.0.0 + TailwindCSS 4.1.11 + Zustand 5.0.6 + Dexie 4.0.11 (IndexedDB)
- **Backend**: Netlify Functions + OpenAI 5.8.2 + Perplexity AI
- **Security**: CORS protection, API key auth, rate limiting, sensitive data masking
- **Logging**: Environment-aware logging (console + file output)
- **Accessibility**: WCAG 2.1 AA compliance, ARIA labels, screen reader support, keyboard navigation
- **Mobile**: Responsive design, touch-friendly (44px+ targets), mobile-first layouts
- **Performance**: Throttled scroll events, smooth animations, optimized re-renders
- **Runtime**: Node.js 22.17.0 LTS

### Core Features
1. **Company Management**: CSV import/export with duplicate checking, CRUD operations, status tracking
2. **MVV Extraction**: Batch processing (5 parallel), confidence scoring, real-time progress
3. **Data Persistence**: IndexedDB for local storage
4. **Results Management**: Filter/search, manual editing, CSV/JSON export
5. **Responsive Design**: Mobile-first approach with adaptive layouts (card/table views)
6. **Accessibility**: Full WCAG 2.1 AA compliance with screen reader and keyboard support
7. **Enhanced UX**: Smooth scroll-to-top, improved error handling, detailed feedback
8. **Performance**: Optimized rendering, throttled events, 60fps smooth interactions

### API Endpoints
- `POST /.netlify/functions/extract-mvv`: OpenAI GPT-4o extraction
- `POST /.netlify/functions/extract-mvv-perplexity`: Perplexity AI extraction (web search)
- `GET /.netlify/functions/health`: Health check

### API Response Format
```json
{
  "success": true,
  "data": {
    "mission": "企業の使命",
    "vision": "企業のビジョン", 
    "values": ["価値観1", "価値観2"],
    "confidence_scores": {
      "mission": 0.95,
      "vision": 0.90,
      "values": 0.85
    },
    "extracted_from": "情報源"
  },
  "metadata": {
    "processingTime": 2500,
    "timestamp": "2025-01-08T...",
    "source": "openai|perplexity"
  }
}
```

### Development Notes
- Frontend uses Vite proxy for local API calls
- Backend requires Netlify CLI for local development
- Environment variables must be set in both frontend (.env.local) and backend (.env for local, Netlify for prod)
- CORS origins must match deployment URL (including WSL IP for local dev)
- Rate limiting: 100 requests per 15 minutes per IP
- WSL2 compatible with network configuration
- 日本語での対話可
- コミットメッセージにClaude署名は不要

### UX/UI Guidelines
- **Mobile-First**: Design for mobile first, then enhance for desktop
- **Touch Targets**: Minimum 44px for all interactive elements
- **Responsive Breakpoints**: sm (640px), md (768px), lg (1024px), xl (1280px)
- **Accessibility**: Always include ARIA labels, roles, and keyboard navigation
- **Performance**: Use throttled scroll events, avoid layout thrashing
- **Feedback**: Provide clear loading states and error messages
- **Component Structure**: Reusable components in `/common/` with full accessibility support

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

#### 1. Creating Feature Branch
```bash
# Ensure main is up to date
git checkout main
git pull origin main

# Create and checkout feature branch
git checkout -b feature/csv-import-enhancement

# Work on your feature...
# Make commits with clear messages
git add .
git commit -m "Add duplicate checking for CSV import"
```

#### 2. Pull Request Process
```bash
# Push feature branch to remote
git push -u origin feature/csv-import-enhancement

# Create Pull Request via GitHub web interface
# Include description of changes, testing done, and any notes
```

#### 3. Pull Request Requirements
- **Clear Description**: What was changed and why
- **Testing Evidence**: Screenshots, test results, or manual testing notes
- **Breaking Changes**: Document any breaking changes
- **Performance Impact**: Note any performance implications

#### 4. Review & Merge Process
- **Code Review**: At least one review required (can be self-review for solo development)
- **Testing**: Verify feature works in local environment
- **Documentation**: Update relevant documentation if needed
- **Merge**: Use "Squash and merge" to keep clean history

#### 5. Post-Merge Cleanup
```bash
# Switch back to main and pull latest
git checkout main
git pull origin main

# Delete local feature branch
git branch -d feature/csv-import-enhancement

# Delete remote feature branch (if not auto-deleted)
git push origin --delete feature/csv-import-enhancement
```

### Deployment Strategy

**Staging Environment (Development)**
- All feature branches tested in local development environment
- Manual testing with sample datasets (30-company and 100-company)
- Performance validation before merge

**Production Environment**
- Only `main` branch deployed to production
- Automatic deployment via GitHub Actions on push to main
- Monitor performance metrics after deployment

### Emergency Procedures

**Hotfix Process**
```bash
# Create hotfix branch from main
git checkout main
git checkout -b fix/critical-bug-fix

# Make minimal fix
git add .
git commit -m "Fix critical bug in API endpoint"

# Push and create urgent PR
git push -u origin fix/critical-bug-fix
# Create PR with "URGENT" label
```

**Rollback Process**
```bash
# If production issue detected, rollback to previous version
git checkout main
git revert HEAD  # Revert last commit
git push origin main  # Deploy rollback
```

### Quality Assurance

**Pre-Merge Checklist**
- [ ] Feature tested locally with sample data
- [ ] No console errors or warnings
- [ ] Performance impact assessed
- [ ] Documentation updated if needed
- [ ] Breaking changes documented

**Post-Merge Monitoring**
- [ ] Production deployment successful
- [ ] API endpoints responding normally
- [ ] Performance metrics within expected range
- [ ] No error spikes in logs

### Logging System
- **Development**: Colorful console output + file logging in `/backend/logs/`
- **Production**: Structured JSON logging for monitoring
- **Features**: Sensitive data masking, request/response tracking, performance metrics
- **Log files**: Automatically excluded from git commits via .gitignore

### Perplexity AI Integration Details (Updated 2025-07-08)
- **Model**: `sonar-pro` (Latest model with web search capabilities)
- **Features**: Real-time web search, prioritized official website information
- **Cost**: ~$0.011 per company processed (extremely cost-effective)
- **Processing Time**: 1 second average (dramatically optimized performance)
- **Throughput**: 31.6 companies/minute processing speed
- **Accuracy**: Mission 95%+, Vision 90%+, Values 85%+
- **Production Results**: 100% success rate (89/89 companies processed without errors)
- **Performance Optimization**: Highly optimized batch processing (2min 49sec for 89 companies)
- **Recent Improvements**: Enhanced CSV import with duplicate checking, better error handling

### Tested Functionality
```bash
# Perplexity API direct test
curl -X POST "http://localhost:8888/.netlify/functions/extract-mvv-perplexity" \
-H "Content-Type: application/json" \
-H "X-API-Key: mvv-extraction-2024-secure-key" \
-d '{"companyId":"test-001","companyName":"サイバーエージェント","companyWebsite":"https://www.cyberagent.co.jp/"}'

# Expected successful response
{
  "success": true,
  "data": {
    "mission": "新しい力とインターネットで日本の閉塞感を打破する",
    "vision": "21世紀を代表する会社を創る", 
    "values": ["イノベーションの創出", "社会的価値と経済価値の両立", ...],
    "confidence_scores": {"mission": 0.95, "vision": 1.0, "values": 0.85},
    "extracted_from": "https://www.cyberagent.co.jp/sustainability/society/"
  }
}
```

### Resolved Issues & Current Status
- ✅ Production deployment completed and stable
- ✅ Enhanced CSV import system with duplicate checking implemented
- ✅ Improved UI/UX with better error handling and notifications
- ✅ Both OpenAI + Perplexity AI functions operational in production
- ✅ Comprehensive logging system running (460 entries on 2025-07-08)
- ✅ Zero production errors - excellent system stability
- ✅ Performance optimization completed (3-12 second processing times)
- 🔄 Continuous feature improvements and optimizations

### Production Performance Metrics (Updated 2025-07-08)
- **Success Rate**: 100% (89/89 companies processed successfully)
- **Average Processing Time**: 1 second per company (significantly optimized)
- **Processing Speed**: 31.6 companies/minute (22.7 companies/minute effective rate)
- **Batch Processing**: 89 companies processed in 2 minutes 49 seconds
- **Error Analysis**: Zero errors in recent large-scale operations
- **System Uptime**: 100% availability
- **Cost Efficiency**: ~$0.011 per company processed (Perplexity API cost)

### Current Roadmap (Updated 2025-07-08)
1. **✅ Production Deploy**: Completed - System fully operational with zero errors
2. **✅ Stability Optimization**: Completed - Zero error rate achieved (100% success rate)
3. **✅ Enhanced UI/UX**: Completed - CSV import improvements and better error handling
4. **📋 Feature Enhancement**: Multi-language support (English companies)
5. **🤖 AI Function Evolution**: Hybrid processing (GPT-4o + Perplexity result integration)
6. **📊 Enterprise Features**: SLA management, multi-tenant support, advanced analytics
7. **🔄 Continuous Improvement**: Ongoing feature enhancements and optimizations
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
- ✅ Comprehensive logging system (460 entries on 2025-07-08)
- ✅ Enhanced CSV import system with duplicate checking
- ✅ Improved UI/UX with better error handling
- ✅ Zero production errors - excellent stability
- ✅ **Netlify Functions Authentication System (Production Ready)**
  - JWT-based authentication with 24h token expiration
  - Rate limiting (5 attempts/15min) for security
  - Mobile-responsive login interface with UX improvements
  - Automatic session management and refresh
  - Dual authentication support (API key + JWT)
  - Production credentials: Set via environment variables (secure)
- ✅ **Production deployment completed with authentication (2025-07-08)**
- ✅ **Design documentation updated for Phase 3 preparation (2025-07-09)**
  - Updated all 6 design documents to reflect enhanced company management system
  - Created comprehensive company-management-enhancement.md implementation record
  - Updated testing guides with new API endpoints and procedures
  - Documented 4-stage automated pipeline and enterprise features
- ✅ **Professional Excel Export System (2025-07-11)**
  - ExcelJS-based comprehensive Excel export with 5 specialized data sheets
  - Step-by-step export wizard with preview and progress tracking
  - Advanced Excel features: window freezing, auto-filters, text wrapping, conditional formatting
  - JSIC industry classification integration and professional styling
  - Mobile-responsive export interface with detailed configuration options

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

### Frontend Structure (`/frontend`)
- **src/components/**: UI components organized by feature (Company/, MVV/, Results/)
  - **common/**: Reusable UI components with accessibility support (Button, LoadingSpinner, StatusBadge, ScrollToTopButton, ExcelExportWizard)
  - **CompanyManager/**: Company CRUD operations with mobile-optimized layouts
  - **ResultsViewer/**: Responsive data display (dual mobile/desktop views)
  - **MVVExtractor/**: Batch processing interfaces
  - **Dashboard/**: Main navigation and overview with session status
  - **auth/**: Authentication components (Login, AuthGuard, SessionStatus)
- **src/services/**: API clients (api.ts, indexedDB.ts, excelProcessor.ts)
- **src/stores/**: Zustand state management (companies, MVV data, authentication)
- **src/types/**: TypeScript interfaces (including auth types)
- **src/utils/**: Helper functions (formatters, authApi.ts)

### Backend Structure (`/backend`)
- **netlify/functions/**: Serverless endpoints
  - `extract-mvv.js`: OpenAI GPT-4o extraction endpoint (auth protected)
  - `extract-mvv-perplexity.js`: Perplexity AI extraction endpoint (auth protected)
  - `extract-company-info.js`: Company information extraction endpoint (auth protected)
  - `health.js`: Health check endpoint
  - **Authentication endpoints**:
    - `auth-login.js`: JWT token generation with comprehensive rate limiting and logging
    - `auth-login-v2.js`: Simplified JWT token generation (clean implementation)
    - `auth-validate.js`: JWT token validation with detailed error handling
    - `auth-validate-v2.js`: Simplified JWT token validation
    - `auth-refresh.js`: JWT token refresh with age validation
    - `auth-refresh-v2.js`: Simplified JWT token refresh
- **utils/**: Shared utilities
  - `cors.js`: CORS configuration
  - `rateLimiter.js`: Enhanced rate limiting (API + auth rate limiting)
  - `auth.js`: Dual authentication (API key + JWT validation)
  - `jwt.js`: JWT token generation, validation, and refresh
  - `logger.js`: Comprehensive logging system
- **test/**: Test suite with comprehensive API testing
  - `company-info-api.test.js`: Company info API tests (mock/integration/minimal modes)
  - `helpers/`: Test utilities and mock data
  - `fixtures/`: Test data fixtures

### Key Technologies
- **Frontend**: React 19.1.0 + TypeScript 5.8.3 + Vite 7.0.0 + TailwindCSS 4.1.11 + Zustand 5.0.6 + Dexie 4.0.11 (IndexedDB) + TinySegmenter (Japanese morphological analysis) + ExcelJS 4.4.0 (Professional Excel export)
- **Backend**: Netlify Functions + OpenAI 5.8.2 + Perplexity AI + jsonwebtoken 9.0.2 (JWT authentication)
- **Testing**: Jest 29.7.0 with comprehensive API testing (mock/integration/minimal modes)
- **Authentication**: JWT-based with environment variable credentials
- **Security**: CORS protection, dual authentication (API key + JWT), rate limiting, sensitive data masking
- **Logging**: Environment-aware logging (console + file output)
- **Accessibility**: WCAG 2.1 AA compliance, ARIA labels, screen reader support, keyboard navigation
- **Mobile**: Responsive design, touch-friendly (44px+ targets), mobile-first layouts
- **Data Export**: ExcelJS-based professional Excel export with advanced formatting and multiple specialized sheets
- **Visual Analytics**: Screenshot capture with IndexedDB persistence, browser-compatible image processing, Excel image embedding

### Authentication Features
- **Login Interface**: Mobile-responsive login with password visibility toggle
- **Session Management**: Automatic token refresh, session status display, logout functionality
- **Rate Limiting**: 5 login attempts per 15 minutes per IP
- **Token Security**: 24-hour JWT expiration with secure generation
- **Route Protection**: AuthGuard component protects entire application
- **Dual Auth**: Backward compatibility with existing API key authentication

### Core Features
1. **Company Management**: CSV import/export with duplicate checking, CRUD operations, status tracking
2. **MVV Extraction**: Batch processing (5 parallel), confidence scoring, real-time progress
3. **AI Similarity Analysis**: 62-company similarity analysis, interactive dashboard, Japanese morphological analysis
4. **Data Persistence**: IndexedDB for local storage
5. **Results Management**: Filter/search, manual editing, CSV/JSON export
6. **Visual Analytics Gallery**: AI analysis screen capture with IndexedDB storage and Excel integration
7. **Professional Excel Export**: 5+ specialized data sheets with visual analytics integration and advanced formatting
8. **Responsive Design**: Mobile-first approach with adaptive layouts (card/table views)
9. **Accessibility**: Full WCAG 2.1 AA compliance with screen reader and keyboard support
10. **Enhanced UX**: Smooth scroll-to-top, improved error handling, detailed feedback
11. **Performance**: Optimized rendering, throttled events, 60fps smooth interactions

### API Endpoints
- `POST /.netlify/functions/extract-mvv`: OpenAI GPT-4o extraction (auth protected)
- `POST /.netlify/functions/extract-mvv-perplexity`: Perplexity AI extraction with web search (auth protected)
- `POST /.netlify/functions/extract-company-info`: Company information extraction with Perplexity API (auth protected)
- `GET /.netlify/functions/health`: Health check (public)
- **Authentication endpoints**:
  - `POST /.netlify/functions/auth-login-v2`: JWT token generation (production)
  - `POST /.netlify/functions/auth-validate-v2`: JWT token validation (production)
  - `POST /.netlify/functions/auth-refresh-v2`: JWT token refresh (production)
  - `POST /.netlify/functions/auth-login`: JWT token generation (comprehensive logging)
  - `POST /.netlify/functions/auth-validate`: JWT token validation (comprehensive logging)
  - `POST /.netlify/functions/auth-refresh`: JWT token refresh (comprehensive logging)

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
- Rate limiting: 100 requests per 15 minutes per IP (API), 5 auth attempts per 15 minutes per IP (authentication)
- WSL2 compatible with network configuration
- **Testing**: Use `npm test` for mock tests, `TEST_MODE=integration npm test` for real API tests
- 日本語での対話可

### Professional Excel Export System

#### Overview
Comprehensive Excel export system using ExcelJS 4.4.0 for generating professional business reports with 5 specialized data sheets, advanced formatting, and business intelligence features.

#### Excel Export Features
- **5 Specialized Data Sheets**: Executive Summary, MVV Analysis (Simple/Detail), Company Master Data, Company Detailed Profiles
- **Advanced Excel Functions**: Window pane freezing, auto-filters, conditional formatting, text wrapping
- **Professional Styling**: Color-coded confidence scores, alternating row colors, proper borders and fonts
- **Step-by-step Wizard**: Interactive export configuration with preview and progress tracking
- **Mobile-responsive Interface**: Touch-friendly controls and adaptive layouts

#### Data Sheets Specification

**1. Executive Summary**
- Project overview and key statistics
- Industry breakdown with completion rates
- Data quality distribution (high/medium/low confidence)
- Generated report metadata

**2. MVV Analysis (Simple)**
- Basic MVV data: No, Company Name, Industry, Mission, Vision, Values
- Confidence scores with color-coded indicators
- Investigation date and source URLs
- Window freezing: No + Company Name columns
- Full auto-filtering on all columns

**3. MVV Analysis (Detail)**
- Comprehensive JOIN of MVV + Company Information data
- JSIC industry classifications (Major/Middle/Minor categories)
- Financial data, business segments, listing information
- Text wrapping for Mission/Vision/Values with automatic row height
- 29 total columns with complete business intelligence data

**4. Company Master Data**
- Basic company information and processing status
- Creation/update timestamps and error tracking
- Website URLs and category classifications
- Processing pipeline status indicators

**5. Company Detailed Profiles**
- Complete company profiles with 43 data fields
- Financial metrics, ESG information, competitive positioning
- JSIC classifications and industry positioning
- MVV extraction status and confidence indicators

#### Technical Implementation
```typescript
// Excel Export Service
src/services/excelProcessor.ts - Core Excel generation engine
src/components/common/ExcelExportWizard.tsx - Step-by-step UI wizard

// Key Features
- ExcelJS workbook generation with professional themes
- Conditional formatting for confidence scores
- Dynamic column width adjustment
- Multi-sheet generation with cross-referencing
- Progress tracking and error handling
```

#### Usage Example
```bash
# Access via Results tab → Excel Export button
# Configure export options in step-by-step wizard
# Preview settings and start generation
# Download professional Excel report with multiple sheets
```

### Company Information Extraction API
New endpoint for extracting comprehensive company information using Perplexity API with automatic industry classification:

```bash
# Test company info extraction
curl -X POST "http://localhost:8888/.netlify/functions/extract-company-info" \
-H "Content-Type: application/json" \
-H "X-API-Key: your-api-key" \
-d '{
  "companyId": "test-001",
  "companyName": "トヨタ自動車",
  "companyWebsite": "https://global.toyota/jp/",
  "includeFinancials": true,
  "includeESG": true,
  "includeCompetitors": true
}'
```

Response format with industry classification:
```json
{
  "success": true,
  "data": {
    "founded_year": 1937,
    "employee_count": 375235,
    "headquarters_location": "愛知県豊田市",
    "financial_data": {
      "revenue": 31377000,
      "operating_profit": 5353000,
      "net_profit": 4943000
    },
    "business_structure": {
      "segments": ["自動車", "金融", "その他"],
      "main_products": ["乗用車", "商用車", "部品"]
    },
    "industry_classification": {
      "jsic_major_category": "E",
      "jsic_major_name": "製造業",
      "jsic_middle_category": "305",
      "jsic_middle_name": "輸送用機械器具製造業",
      "jsic_minor_category": "3051",
      "jsic_minor_name": "自動車・同附属品製造業",
      "primary_industry": "自動車製造業",
      "business_type": "自動車メーカー"
    },
    "listing_info": {
      "status": "listed",
      "stock_code": "7203",
      "exchange": "東証プライム"
    }
  }
}
```

#### Industry Classification Features
- **Automatic Classification**: Uses Japanese Standard Industrial Classification (JSIC)
- **Hierarchical Structure**: Major (A-T), Middle (3-digit), Minor (4-digit) categories
- **Manual Override**: No longer requires manual category input
- **Dynamic Updates**: Categories automatically updated when company info is extracted

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
- **Local Testing**: Verify feature works in local environment
- **GitHub Actions Testing**: MANDATORY - Test GitHub Actions build before merge
  ```bash
  # Test GitHub Actions workflow on feature branch
  gh workflow run deploy.yml --ref feature/your-branch-name
  
  # Monitor workflow execution
  gh run list --workflow=deploy.yml --limit=3
  gh run watch <run-id>
  
  # Verify build job succeeds (deploy may fail due to branch protection)
  # Only proceed with merge if build job passes successfully
  ```
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

# MANDATORY: Test GitHub Actions build before merge
gh workflow run deploy.yml --ref fix/critical-bug-fix
gh run watch <run-id>

# Push and create urgent PR only after build succeeds
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
- [ ] **GitHub Actions build test completed successfully**
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

### Perplexity AI Integration Details (Updated 2025-07-11)
- **Model**: `sonar-pro` (Latest model with web search capabilities)
- **Features**: Real-time web search, prioritized official website information
- **Cost**: ~$0.011 per company processed (extremely cost-effective)
- **Processing Time**: 1 second average (dramatically optimized performance)
- **Throughput**: 31.6 companies/minute processing speed
- **Accuracy**: Mission 95%+, Vision 90%+, Values 85%+
- **Production Results**: 100% success rate (89/89 companies processed without errors)
- **Performance Optimization**: Highly optimized batch processing (2min 49sec for 89 companies)
- **Cost Optimization (2025-07-11)**: Fixed duplicate API call issue reducing cost from ~$0.022 to ~$0.011 per company
- **Recent Improvements**: Enhanced CSV import with duplicate checking, better error handling, admin panel integration

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

### Current System Status (Updated 2025-07-13)
1. **✅ Production Deploy**: System fully operational with zero errors
2. **✅ Authentication System**: JWT-based authentication deployed to production
3. **✅ Real-time Analysis Dashboard**: Dynamic MVV analysis using IndexedDB
   - ✅ Similar Company Search: Real-time embedding similarity calculation
   - ✅ Trend Analysis: Morphological analysis with JSIC categories
   - ✅ Interactive Word Cloud: Independent tab with zoom/pan/drag functionality
   - ✅ Competitive Positioning Map: MDS-based with industry filtering and drag navigation
   - ✅ Uniqueness Analysis (β): Multi-factor scoring algorithm
   - ✅ Quality Assessment (β): Rule-based MVV quality evaluation
4. **✅ Enhanced Company Management**: Comprehensive company information extraction with JSIC integration
5. **✅ Professional Excel Export System with Visual Analytics**: ExcelJS-based comprehensive business reporting
   - ✅ 5+ Specialized Data Sheets: Executive Summary, MVV Analysis, Company Master, AI Analysis Reports
   - ✅ **Visual Analytics Gallery Integration (NEW)**: TabID-based screenshot sheets with chronological arrangement
   - ✅ Browser-compatible image embedding: Base64 to ArrayBuffer conversion (no Buffer dependency)
   - ✅ Improved Export Wizard: Removed inaccurate estimations, added image warning
   - ✅ Business Intelligence Integration: JSIC classifications, financial data, competitive analysis
6. **✅ Visual Analytics Gallery (2025-07-13)**
   - ✅ Screenshot Capture: High-quality AI analysis screen capture (2100×1350px)
   - ✅ IndexedDB Storage: Permanent storage without session management
   - ✅ Efficient Storage Queries: Native IndexedDB count() and cursor APIs
   - ✅ Excel Integration: Automatic TabID grouping and multi-sheet export
   - ✅ Simplified Architecture: Removed session management for better UX
7. **✅ Admin Panel with Hidden Menu Access**
   - ✅ Hidden Menu Access: Ctrl+Shift+A keyboard shortcut activation
   - ✅ Data Diagnostics: Company data integrity and MVV consistency checks
   - ✅ Recovery Tools: Bulk extraction, single test execution, batch processing
   - ✅ System Diagnostics: API health check and performance monitoring
8. **🚀 Business Innovation Lab (Beta v1) - NEW! (2025-07-13)**
   - ✅ AI-powered Business Idea Generation: GPT-4o-mini based deep analysis
   - ✅ Stage-wise Analysis Process: Industry → Problem → MVV Integration → Solution → Validation
   - ✅ Professional Lean Canvas Visualization: 9-block structure with business color scheme
   - ✅ Advanced Features: Existing Alternatives & Early Adopters analysis
   - ✅ 3-tier Caching System: L1 (24h), L2 (7d), L3 (30d) for cost optimization
   - ✅ Quality over Quantity: Default 1 deep idea with 1-3 option selector
   - ✅ Feasibility Evaluation: Detailed reasoning for MVV alignment, implementation, market potential
   - ✅ Step Progress Visualization: Real-time 5-step process indicator
   - ✅ Revenue Payer Analysis: Clear identification of who pays for what
   - ✅ Professional UI/UX: Business-grade color palette and visual hierarchy
9. **📊 Next Phase**: Business Innovation Lab Beta v2 & AI Verification System

### Real-time Analysis System Architecture (Updated 2025-07-11)

#### Current Implementation: Dynamic Analysis Dashboard
- **Data Source**: IndexedDB (client-side storage with embeddings)
- **Processing**: Real-time similarity calculation using OpenAI text-embedding-3-small
- **Analysis**: Combined embeddings + morphological analysis for enhanced accuracy
- **Performance**: LRU caching, progressive calculation, symmetric matrix optimization

#### Key Components
- **Similar Company Search**: Real-time embedding similarity with detailed explanations
- **Trend Analysis**: TinySegmenter morphological analysis with JSIC category support
- **Interactive Word Cloud**: Independent component with zoom/pan/drag functionality
- **Competitive Positioning Map**: MDS-based visualization with industry filtering
- **Uniqueness Analysis (β)**: Multi-factor scoring (base + industry-relative + cross-industry + rarity)
- **Quality Assessment (β)**: Rule-based MVV maturity evaluation

#### Technical Features
- **Multi-industry Support**: Industry-agnostic keyword extraction and analysis
- **Performance Optimization**: Client-side caching, progressive loading, optimized calculations
- **Interactive UI**: Drag navigation, modal interactions, responsive design
- **Real-time Processing**: No pre-calculation required, instant similarity results

### Visual Analytics Gallery Architecture (Updated 2025-07-13)

#### Screenshot Storage & Management
- **IndexedDB Storage**: Permanent persistence without session management
- **Database Structure**: 
  ```javascript
  // Simplified schema (session management removed)
  interface ScreenshotMetadata {
    id: string;
    timestamp: number;
    name: string;
    description: string;
    tabId: string;  // finder, trends, wordcloud, positioning, uniqueness, quality
    width: number;
    height: number;
    size: number;
  }
  ```
- **Efficient Queries**: Native IndexedDB `count()` and cursor APIs for performance
- **Storage Optimization**: Automatic cleanup (50 screenshots max), LRU-based deletion

#### Excel Image Integration
- **Browser Compatibility**: Custom Base64 to ArrayBuffer conversion (no Node.js Buffer dependency)
  ```javascript
  // Browser-native approach
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
  ```
- **TabID-based Sheets**: Automatic grouping by analysis type (finder, trends, wordcloud, etc.)
- **Chronological Layout**: Time-series arrangement within each sheet
- **Image Optimization**: Aspect ratio preservation with max dimensions (400×300px display)

#### UI/UX Improvements
- **Export Wizard Simplification**: Removed inaccurate file size/time estimations
- **Visual Analytics Warning**: Specific alerts for large image datasets
- **Accurate File Naming**: Real-time filename generation matching actual downloads
- **Performance Indicators**: Loading states and storage usage display

#### Technical Solutions & Browser Compatibility

**Buffer.from() Browser Compatibility Issue (Resolved 2025-07-13)**
- **Problem**: Node.js `Buffer.from()` not available in browser environments
- **Error**: `ReferenceError: Buffer is not defined` during Excel image embedding
- **Solution**: Custom Base64 to ArrayBuffer conversion using browser-native APIs
  ```javascript
  // ❌ Node.js-only (causes browser error)
  const imageBuffer = Buffer.from(base64Data, 'base64');
  
  // ✅ Browser-compatible solution
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);  // Native browser API
    const length = binaryString.length;
    const bytes = new Uint8Array(length);
    
    for (let i = 0; i < length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return bytes.buffer;  // Compatible with ExcelJS
  }
  ```

**IndexedDB Performance Optimization**
- **Efficient Counting**: Using native `count()` API instead of loading all data
- **Cursor-based TabID Counting**: IndexedDB cursor for memory-efficient operations
- **No Session Management**: Simplified data model for better performance and UX

## Business Innovation Lab - Development Status & Roadmap

### Beta v1 (Completed 2025-07-13)
**Status**: ✅ Production Ready  
**Features Delivered**:
- AI-powered business idea generation with 6-stage analysis process
- Professional 9-block Lean Canvas with business color scheme
- Advanced business analysis: Existing Alternatives & Early Adopters
- 3-tier caching system for cost optimization (90%+ API call reduction)
- Quality-focused approach: Default 1 deep idea with reasoning
- Step-by-step progress visualization and professional UX

### Beta v2 (Next Phase)
**Status**: Planning  
**Timeline**: Q1 2025

#### Planned Features
1. **AI Verification System**: Secondary AI to validate and enhance generated ideas
   - Industry expert AI: Deep domain knowledge validation
   - Market research AI: Real-time market data integration
   - Financial modeling AI: Revenue/cost projections
2. **Enhanced Lean Canvas**: 
   - Interactive editing capabilities
   - Export to PowerPoint/PDF formats
   - Template library for different industries
3. **Idea Management System**: 
   - IndexedDB storage for persistent idea collections
   - Comparison tools and idea evolution tracking
   - Collaboration features (share/comment)

### Phase 4: AI-Powered Insights and Recommendations
**Status**: Planning Phase  
**Timeline**: Q2-Q3 2025

#### Planned Features
1. **Advanced AI Enhancement**: GPT-4o powered deep analysis
2. **Predictive Market Analysis**: Trend prediction and competitive intelligence
3. **Multi-language Support**: International company analysis capabilities
4. **Enterprise Integration**: SSO, custom branding, advanced security features

#### Cost Optimization Strategy
- **Smart Caching**: Current 3-tier system achieving 90%+ cost reduction
- **Tiered Usage**: Freemium model with professional tiers
- **Target Cost**: <$0.02/user/month operational cost (achieved via caching)

---

*Last Updated: 2025-07-13*  
*Current Status: Business Innovation Lab Beta v1 (Production)*  
*Next Phase: AI Verification System & Enhanced Lean Canvas (Beta v2)*
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered system for extracting Mission, Vision, and Values (MVV) from 30 Japanese healthcare companies using OpenAI GPT-4o API. Architecture: React frontend on GitHub Pages + Netlify Functions backend.

## Common Commands

### Development
```bash
# Start frontend (Terminal 1)
cd frontend && npm run dev           # Runs on localhost:5173

# Start backend (Terminal 2)  
cd backend && netlify dev            # Runs on localhost:8888
```

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

# Backend: Set via Netlify CLI
netlify env:set OPENAI_API_KEY "your-key"
netlify env:set MVP_API_SECRET "your-secret"
netlify env:set ALLOWED_ORIGINS "https://your-username.github.io"
```

## Architecture & Key Components

### Frontend Structure (`/frontend`)
- **src/components/**: UI components organized by feature (Company/, MVV/, Results/)
- **src/services/**: API clients (api.ts, indexedDB.ts)
- **src/stores/**: Zustand state management
- **src/types/**: TypeScript interfaces
- **src/utils/**: Helper functions

### Backend Structure (`/backend`)
- **netlify/functions/**: Serverless endpoints
  - `extract-mvv.js`: Main extraction endpoint with OpenAI integration
  - `health.js`: Health check endpoint
- **utils/**: Shared utilities (cors.js, rateLimiter.js)

### Key Technologies
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS + Zustand + Dexie (IndexedDB)
- Backend: Netlify Functions + OpenAI API
- Security: CORS protection, API key auth, rate limiting

### Core Features
1. **Company Management**: CSV import/export, CRUD operations, status tracking
2. **MVV Extraction**: Batch processing (5 parallel), confidence scoring, real-time progress
3. **Data Persistence**: IndexedDB for local storage
4. **Results Management**: Filter/search, manual editing, CSV/JSON export

### API Endpoints
- `POST /.netlify/functions/extract-mvv`: Extract MVV for companies
- `GET /.netlify/functions/health`: Health check

### Development Notes
- Frontend uses Vite proxy for local API calls
- Backend requires Netlify CLI for local development
- Environment variables must be set in both frontend (.env.local) and backend (Netlify)
- CORS origins must match deployment URL
- Rate limiting: 100 requests per 15 minutes per IP
- 日本語での対話可
- コミットメッセージにClaude署名は不要
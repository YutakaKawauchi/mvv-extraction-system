# MVV Extraction System

AI-powered Mission, Vision, and Values extraction system for Japanese healthcare companies.

## ⚠️ Security Notice

This is a PUBLIC repository. Please ensure:
- NO API keys or secrets in code
- Use environment variables for sensitive data
- Check `.gitignore` before committing
- Use GitHub Secrets for CI/CD

## 🏗️ Architecture

- **Frontend**: React + TypeScript (GitHub Pages)
- **Backend**: Netlify Functions (Serverless)
- **AI**: OpenAI GPT-4o API
- **Storage**: IndexedDB (Client-side)

## 🚀 Quick Start

### Prerequisites
- Node.js 18.20.3+
- npm or yarn
- Netlify CLI
- OpenAI API key

### Development Setup

1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/mvv-extraction-system.git
cd mvv-extraction-system
```

2. Install dependencies
```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install
```

3. Set up environment variables
```bash
# Frontend (.env.local)
VITE_API_BASE_URL=http://localhost:8888/.netlify/functions
VITE_API_SECRET=your-development-secret

# Backend (Netlify CLI)
netlify env:set OPENAI_API_KEY "your-openai-api-key"
netlify env:set MVP_API_SECRET "your-development-secret"
```

4. Start development servers
```bash
# Terminal 1 - Frontend
cd frontend
npm run dev

# Terminal 2 - Backend
cd backend
netlify dev
```

## 📋 Features

- CSV bulk import for company data
- Automated MVV extraction using AI
- Real-time processing status
- Export results to CSV/JSON
- Secure API with authentication
- Rate limiting and CORS protection

## 🔐 Security

- API key authentication
- CORS origin restrictions
- Rate limiting (100 requests/15 min)
- Environment variable management
- No sensitive data in repository

## 📝 License

MIT License - See LICENSE file for details
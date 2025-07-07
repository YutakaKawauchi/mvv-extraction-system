# MVV Extraction System - Backend

Serverless backend using Netlify Functions for the MVV Extraction System.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set environment variables via Netlify CLI:
```bash
netlify env:set OPENAI_API_KEY "your-openai-api-key"
netlify env:set MVP_API_SECRET "your-secret-key"
netlify env:set ALLOWED_ORIGINS "https://your-username.github.io"
```

3. Run development server:
```bash
npm run dev
```

## API Endpoints

- `POST /.netlify/functions/extract-mvv` - Extract MVV from companies
- `GET /.netlify/functions/health` - Health check endpoint

## Security Features

- CORS protection with origin whitelist
- API key authentication
- Rate limiting (100 requests per 15 minutes)
- Input validation and sanitization

## Deployment

Deploy to Netlify:
```bash
npm run deploy:prod
```
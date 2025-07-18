# MVV Extraction System API Design Document

## Document Status
**Last Updated**: 2025-07-17
**Current Status**: Production Operational with Business Innovation Lab Beta v2 + Enhanced Async Task System

## Overview
Comprehensive API documentation for the MVV Extraction System, including all production endpoints and their specifications.

## Authentication

### JWT-based Authentication
All API endpoints (except health check) require authentication using JWT tokens or API keys.

#### Authentication Flow
1. **Login**: `POST /auth-login-v2` → Receive JWT token
2. **Include Token**: Add to Authorization header: `Bearer <token>`
3. **Token Refresh**: `POST /auth-refresh-v2` before expiration
4. **Token Validation**: Automatic validation on each request

#### Authentication Headers
```http
Authorization: Bearer <jwt-token>
# OR
X-API-Key: <api-key>
```

## Core API Endpoints

### 1. MVV Extraction Endpoints

#### Extract MVV (OpenAI)
```
POST /.netlify/functions/extract-mvv
```
**Description**: Extract Mission, Vision, and Values using OpenAI GPT-4o
- **Model**: GPT-4o
- **Processing Time**: 3-8 seconds
- **Accuracy**: High (95%+ for Mission)
- **Cost**: Premium pricing

**Request Body**:
```json
{
  "companyId": "company_001",
  "companyName": "株式会社サンプル",
  "companyWebsite": "https://example.com"
}
```

#### Extract MVV (Perplexity)
```
POST /.netlify/functions/extract-mvv-perplexity
```
**Description**: Extract MVV using Perplexity AI with web search capabilities
- **Model**: sonar-pro
- **Processing Time**: 3-12 seconds
- **Cost**: ~$0.011 per company
- **Features**: Real-time web search

### 2. Company Information Endpoints

#### Extract Company Information
```
POST /.netlify/functions/extract-company-info
```
**Description**: Extract comprehensive company information with JSIC classification
- **Model**: Perplexity sonar-pro
- **Features**: Automatic industry classification, financial data, ESG information

**Request Body**:
```json
{
  "companyId": "company_001",
  "companyName": "トヨタ自動車",
  "companyWebsite": "https://global.toyota/jp/",
  "includeFinancials": true,
  "includeESG": true,
  "includeCompetitors": true
}
```

### 3. Business Innovation Lab Endpoints

#### Generate Business Ideas
```
POST /.netlify/functions/generate-business-ideas
```
**Description**: Generate innovative business ideas based on company MVV
- **Model**: OpenAI GPT-4o-mini
- **Temperature**: 0.7 (creative)
- **Features**: 6-stage analysis, Lean Canvas generation

#### Verify Business Idea
```
POST /.netlify/functions/verify-business-idea
```
**Description**: AI verification system with 3-tier analysis
- **Levels**: Basic, Comprehensive, Expert
- **Models**: Perplexity sonar-pro + OpenAI GPT-4o-mini
- **Analysis**: Industry expert validation, competitive analysis, market validation

**Recent Improvements (2025-07-17)**:
- **JSON Parsing Enhancement**: Added regex-based extraction for Perplexity API responses wrapped in markdown code blocks (````json`)
- **Market Validation Fix**: Removed unsupported `response_format` parameter for Perplexity API calls
- **Error Handling**: Improved variable scope handling in market validation API
- **Response Reliability**: Enhanced parsing of Perplexity API responses for consistent JSON extraction

### 4. Async Task Endpoints (Phase-based Architecture v2.0)

#### Start Async Task
```
POST /.netlify/functions/start-async-task
```
**Description**: Initiate long-running background tasks
- **Timeout**: Up to 15 minutes
- **Storage**: Netlify Blobs (progress + result separation)
- **Status**: Phase-based polling system

#### Task Progress Monitoring
```
GET /.netlify/functions/task-progress?taskId=<task-id>
```
**Description**: Monitor real-time task progress (Phase 1)
- **Purpose**: Progress monitoring only
- **Response**: Progress percentage, current step, detailed steps
- **Polling**: 5-second intervals during execution
- **404 Meaning**: Progress not yet available (task not started)

**Response Format**:
```json
{
  "success": true,
  "taskId": "async_1234567890",
  "progress": {
    "percentage": 65,
    "currentStep": "Analyzing competitive landscape...",
    "detailedSteps": [
      {
        "stepName": "Industry Analysis",
        "status": "completed",
        "duration": 25000,
        "startTime": 1705234567890
      },
      {
        "stepName": "Business Model Validation", 
        "status": "processing",
        "startTime": 1705234592890
      }
    ],
    "estimatedTimeRemaining": 45000,
    "updatedAt": 1705234598890
  }
}
```

#### Task Completion Detection
```
GET /.netlify/functions/task-result?taskId=<task-id>
```
**Description**: Detect task completion and retrieve results (Phase 2)
- **Purpose**: Result retrieval only
- **Response**: Complete verification results when available
- **404 Meaning**: Task not completed yet (still running or failed)
- **200 Response**: Task completed successfully with full results

**Response Format**:
```json
{
  "success": true,
  "taskId": "async_1234567890",
  "status": "completed",
  "result": {
    "industryAnalysis": { /* detailed analysis */ },
    "businessModelValidation": { /* validation results */ },
    "competitiveAnalysis": { /* competitor data */ },
    "improvementSuggestions": { /* suggestions */ },
    "overallAssessment": { /* final assessment */ }
  },
  "metadata": {
    "verificationLevel": "comprehensive",
    "totalTokens": 8542,
    "totalCost": 0.0234,
    "model": "gpt-4o-mini",
    "confidence": 0.92,
    "version": "2.1"
  },
  "timestamps": {
    "createdAt": 1705234567890,
    "completedAt": 1705234723890,
    "processingDuration": 156000
  }
}
```

#### Legacy Task Status (Deprecated)
```
GET /.netlify/functions/task-status?taskId=<task-id>
```
**Status**: Deprecated in favor of phase-based approach
**Migration**: Use task-progress + task-result APIs for new implementations

### Phase-Based Polling Strategy

The new verification result display system uses a three-phase approach:

**Phase 1: Progress Monitoring**
- API: `task-progress`
- Purpose: Real-time progress updates
- Frequency: 5-second intervals
- Continues until completion detected

**Phase 2: Completion Detection**  
- API: `task-result`
- Purpose: Detect when task completes
- Frequency: 5-second intervals
- 404 = still running, 200 = completed

**Phase 3: Result Display**
- Trigger: 200 response from task-result
- Action: Display complete verification results
- UI: Progressive disclosure of result sections

### 5. Authentication Endpoints

#### Login
```
POST /.netlify/functions/auth-login-v2
```
**Description**: Generate JWT token
- **Rate Limit**: 5 attempts per 15 minutes
- **Token Expiry**: 24 hours

#### Validate Token
```
POST /.netlify/functions/auth-validate-v2
```
**Description**: Validate JWT token

#### Refresh Token
```
POST /.netlify/functions/auth-refresh-v2
```
**Description**: Refresh expired JWT token

### 6. Health Check

#### System Health
```
GET /.netlify/functions/health
```
**Description**: Check system status (no auth required)
- **Response**: System status and uptime information

## API Response Formats

### Standard Response Structure
All API endpoints return responses in the following format:

```json
{
  "success": true|false,
  "data": { /* response data */ },
  "metadata": {
    "processingTime": 2500,
    "timestamp": "2025-07-17T...",
    "source": "openai|perplexity"
  },
  "error": "error message (if success=false)"
}
```

### MVV Extraction Response
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
    "extracted_from": "情報源URL"
  },
  "metadata": {
    "processingTime": 2500,
    "timestamp": "2025-07-17T...",
    "source": "openai|perplexity"
  }
}
```

### Company Information Response
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

## Rate Limiting

- **API Endpoints**: 100 requests per 15 minutes per IP
- **Authentication**: 5 login attempts per 15 minutes per IP
- **Business Ideas**: 10 generations per hour per user
- **Verification**: 5 verifications per 15 minutes per user

## Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| 400 | Bad Request | Check request format |
| 401 | Unauthorized | Provide valid authentication |
| 403 | Forbidden | Check API permissions |
| 429 | Rate Limited | Wait before retry |
| 500 | Server Error | Contact support |

## CORS Configuration

All endpoints support CORS for the following origins:
- `https://your-username.github.io` (production)
- `http://localhost:5173` (development)
- WSL IP addresses (local development)

## Usage Examples

### cURL Examples

#### Extract MVV using Perplexity
```bash
curl -X POST "http://localhost:8888/.netlify/functions/extract-mvv-perplexity" \
-H "Content-Type: application/json" \
-H "X-API-Key: your-api-key" \
-d '{
  "companyId": "test-001",
  "companyName": "サイバーエージェント",
  "companyWebsite": "https://www.cyberagent.co.jp/"
}'
```

#### Generate Business Ideas
```bash
curl -X POST "http://localhost:8888/.netlify/functions/generate-business-ideas" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer your-jwt-token" \
-d '{
  "companyIds": ["company_001"],
  "ideaCount": 1,
  "focusArea": "DX",
  "constraints": {
    "timeframe": "short-term",
    "budget": "medium",
    "riskTolerance": "conservative"
  }
}'
```

#### Check Task Progress (Phase 1)
```bash
curl -X GET "http://localhost:8888/.netlify/functions/task-progress?taskId=async_123456" \
-H "X-API-Key: your-api-key"
```

#### Check Task Completion (Phase 2)
```bash
curl -X GET "http://localhost:8888/.netlify/functions/task-result?taskId=async_123456" \
-H "X-API-Key: your-api-key"
```

---

*Last Updated: 2025-07-17*  
*API Version: v2.0*  
*Status: Production Ready*
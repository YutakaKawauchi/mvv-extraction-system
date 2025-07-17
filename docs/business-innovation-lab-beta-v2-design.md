# Business Innovation Lab Beta v2 - AI Verification System Design

## Overview
Business Innovation Lab Beta v2 introduces a comprehensive AI verification system that validates and enhances generated business ideas through multi-step expert analysis.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (React + TypeScript)                │
├─────────────────────────────────────────────────────────────────┤
│  BusinessInnovationLab Component                                │
│  ├── Idea Generation (Phase α+)                                 │
│  ├── AI Verification UI (Phase β)                               │
│  │   ├── Verification Level Selector                           │
│  │   ├── Verification Trigger                                  │
│  │   └── Results Display                                       │
│  └── Idea Management (Future)                                  │
├─────────────────────────────────────────────────────────────────┤
│                    Backend (Netlify Functions)                   │
├─────────────────────────────────────────────────────────────────┤
│  generate-business-ideas.js     │  verify-business-idea.js      │
│  ├── OpenAI GPT-4o-mini        │  ├── Industry Analysis        │
│  ├── 3-tier Caching           │  │   └── Perplexity API      │
│  └── Deep Analysis            │  ├── Business Model Valid.    │
│                               │  │   └── OpenAI GPT-4o-mini  │
│                               │  ├── Competitive Analysis     │
│                               │  │   └── Perplexity API      │
│                               │  ├── Improvement Suggestions  │
│                               │  └── Overall Assessment       │
└───────────────────────────────┴──────────────────────────────────┘
```

## API Design

### Verification Endpoint
**POST** `/.netlify/functions/verify-business-idea`

#### Request
```json
{
  "originalIdea": {
    "title": "ビジネスアイデアタイトル",
    "description": "詳細説明",
    "worldview": "MVV統合ビジョン",
    "industryInsight": "業界洞察",
    "leanCanvas": { /* ... */ },
    "feasibility": { /* ... */ }
  },
  "companyData": {
    "id": "company-001",
    "name": "企業名",
    "industry": "業界",
    "category": "カテゴリー",
    "jsicMajorCategory": "E",
    "website": "https://example.com"
  },
  "verificationLevel": "comprehensive" // basic | comprehensive | expert
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "industryAnalysis": {
      "industryTrends": { /* ... */ },
      "problemValidation": { /* ... */ },
      "solutionAssessment": { /* ... */ },
      "industrySpecificInsights": { /* ... */ }
    },
    "businessModelValidation": {
      "revenueModelValidation": { /* ... */ },
      "costStructureAnalysis": { /* ... */ },
      "valuePropositionTest": { /* ... */ },
      "marketFitAssessment": { /* ... */ }
    },
    "competitiveAnalysis": {
      "directCompetitors": [ /* ... */ ],
      "indirectCompetitors": [ /* ... */ ],
      "competitiveAdvantageAnalysis": { /* ... */ },
      "marketPositioning": { /* ... */ }
    },
    "improvementSuggestions": {
      "criticalIssues": [ /* ... */ ],
      "improvementRecommendations": [ /* ... */ ],
      "alternativeApproaches": [ /* ... */ ],
      "actionPlan": { /* ... */ }
    },
    "overallAssessment": {
      "overallScore": {
        "viabilityScore": 85,
        "innovationScore": 78,
        "marketPotentialScore": 82,
        "riskScore": 35,
        "totalScore": 81
      },
      "recommendation": {
        "decision": "CONDITIONAL-GO",
        "reasoning": "詳細な理由",
        "conditions": ["条件1", "条件2"]
      }
    },
    "metadata": {
      "verificationLevel": "comprehensive",
      "totalTokens": 8500,
      "totalCost": 0.0152,
      "model": "gpt-4o-mini + sonar-pro",
      "confidence": 0.9,
      "version": "beta"
    }
  }
}
```

## Dynamic Industry Analysis

### Industry-Specific Prompts
The system dynamically adjusts analysis based on:

1. **Direct Industry Matching**
   - Healthcare → Medical regulations, patient privacy, clinical workflow
   - Manufacturing → Supply chain, IoT/Industry 4.0, quality control
   - IT/Software → Scalability, security, open source ecosystem
   - Finance → Regulatory compliance, risk management, fintech
   - Retail → Omnichannel, inventory optimization, CX
   - Energy → Carbon neutrality, energy efficiency, ESG

2. **JSIC Classification Fallback**
   - E (Manufacturing) → Manufacturing industry prompts
   - G (Information/Communication) → IT/Software prompts
   - J (Finance/Insurance) → Finance prompts
   - I (Wholesale/Retail) → Retail prompts

3. **Generic Analysis**
   - Industry-specific regulations
   - Stakeholder value proposition
   - Business model integration
   - Technical feasibility

### Implementation Example
```javascript
function getIndustrySpecificPrompts(industry, jsicCategory) {
  const industryPrompts = {
    'ヘルスケア': {
      additionalPoints: [
        '医療規制・薬事法への適合性',
        '患者プライバシー・データセキュリティ要件',
        '医療従事者の負担軽減効果と業務フローへの影響',
        '診療報酬制度との整合性と収益モデル'
      ],
      keyQuestions: [
        '医療機関での導入障壁は何か？',
        '患者アウトカムの改善にどう貢献するか？',
        '既存の医療システムとの統合は可能か？'
      ]
    },
    // ... other industries
  };
  
  // Dynamic selection logic
  // 1. Try JSIC mapping
  // 2. Try industry name matching
  // 3. Fall back to generic
}
```

## UI/UX Design

### Verification Interface
1. **Verification Button**
   - Purple gradient design with β badge
   - Loading state during verification
   - Disabled state management

2. **Verification Level Selector**
   - Located in header for easy access
   - Three levels: Basic, Comprehensive, Expert
   - Default: Comprehensive

3. **Results Display**
   - Collapsible sections for each analysis type
   - Score visualization with color coding
   - GO/NO-GO/CONDITIONAL-GO indicators
   - Improvement recommendations with priority

### Visual Design Elements
- **Color Scheme**
  - Purple: AI verification features
  - Blue: Industry analysis
  - Green: Competitive analysis
  - Orange: Improvement suggestions
  - Mixed gradients for overall assessment

### Competitive Analysis UI Enhancements (2025-07-17)
- **Clickable Company Names**: Company names are now hyperlinked to their websites
- **Clickable URLs**: URL fields are also clickable for easy navigation
- **Extended Descriptions**: Competitor descriptions expanded from 2 lines to 3 lines display
- **Enhanced User Experience**: 
  - Hover effects on clickable elements
  - External link security attributes (`target="_blank"`, `rel="noopener noreferrer"`)
  - Improved visual feedback for interactive elements

## Cost Optimization Strategy

### Multi-API Approach
1. **Perplexity API (sonar-pro)**
   - Industry analysis with real-time web data
   - Competitive analysis with market intelligence
   - Cost: ~$1.0/1M tokens

2. **OpenAI API (gpt-4o-mini)**
   - Business model validation
   - Improvement suggestions
   - Overall assessment
   - Cost: $0.15/1M input, $0.60/1M output

### Future Caching Implementation
- Level 1: Company + Idea specific (24 hours)
- Level 2: Similar ideas (7 days)
- Level 3: Industry templates (30 days)

## Security & Performance

### Authentication
- JWT-based authentication required
- API key validation
- Rate limiting inherited from auth system

### Performance Metrics
- Average verification time: 15-30 seconds
- Total API cost per verification: ~$0.015-0.025
- Confidence level: 90%

## Future Enhancements

### Phase β+ (Planned)
1. **Idea Management System**
   - IndexedDB persistence
   - Version control for ideas
   - Comparison tools

2. **Enhanced Caching**
   - 3-tier cache implementation
   - 90%+ cost reduction target

3. **Excel Integration**
   - Export verification results
   - Combined idea + verification reports

### Phase γ (Future)
1. **Real-time Collaboration**
   - Multi-user idea editing
   - Comment system
   - Approval workflow

2. **Advanced Analytics**
   - Success prediction models
   - Historical analysis
   - Industry benchmarking

## Technical Specifications

### Dependencies
- OpenAI SDK: ^5.8.2
- Perplexity API (via OpenAI SDK)
- React: ^19.1.0
- TypeScript: ^5.8.3
- Lucide Icons
- TailwindCSS

### Browser Support
- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Mobile: Responsive design

## Deployment Notes

### Environment Variables
```bash
# Backend (Netlify)
OPENAI_API_KEY=sk-...
PERPLEXITY_API_KEY=pplx-...
NODE_ENV=production

# Frontend
VITE_API_BASE_URL=https://api.example.com/.netlify/functions
VITE_API_SECRET=...
```

### Build Commands
```bash
# Frontend
npm run build

# Backend
netlify deploy --prod
```

## Testing Checklist

- [ ] Idea generation works correctly
- [ ] Verification button triggers API call
- [ ] Loading states display properly
- [ ] Error handling for API failures
- [ ] Verification results render correctly
- [ ] Industry-specific analysis applies
- [ ] JSIC fallback works
- [ ] Cost tracking accurate
- [ ] Mobile responsive design

---

*Last Updated: 2025-07-13*  
*Version: Beta v2.0*
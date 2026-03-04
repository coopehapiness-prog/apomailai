# Backend Migration: Express to Next.js API Routes

This document describes the migration of the Express backend to Next.js API Routes (App Router).

## Overview

The separate Express backend at `/sessions/upbeat-happy-lamport/mnt/ismail/apomailai-api/` has been converted to Next.js API Routes co-located within the frontend project at `/sessions/upbeat-happy-lamport/mnt/ismail/apomailai/`.

**Benefits:**
- Single deployment unit on Vercel
- No CORS issues
- Shared code and types
- Simpler infrastructure

## Directory Structure

```
src/
  lib/
    supabase.ts          - Supabase client initialization (uses SUPABASE_SERVICE_KEY)
    gemini-service.ts    - AI email generation service
    research-service.ts  - Company research service with Google Search & caching
    auth-utils.ts        - JWT token management and password hashing
    types.ts             - Shared TypeScript types (already existed)
    api-client.ts        - Updated to use relative API paths
  app/
    api/
      auth/
        register/route.ts       - POST /api/auth/register
        login/route.ts          - POST /api/auth/login
        verify/route.ts         - POST /api/auth/verify
      email/
        generate/route.ts       - POST /api/email/generate
      research/
        company/route.ts        - POST /api/research/company
      leads/
        route.ts                - GET /api/leads, POST /api/leads
        [id]/route.ts           - PATCH /api/leads/[id], DELETE /api/leads/[id]
      settings/
        route.ts                - GET /api/settings, PATCH /api/settings
        knowledge-base/
          route.ts              - GET /api/settings/knowledge-base, POST /api/settings/knowledge-base
          [id]/route.ts         - DELETE /api/settings/knowledge-base/[id]
      analytics/
        kpi/route.ts            - GET /api/analytics/kpi
        success-factors/route.ts - GET /api/analytics/success-factors
```

## Environment Variables

The following environment variables must be set in your Vercel project (or `.env.local` for local development):

```
# Supabase
SUPABASE_URL=https://janpraewvquegxhzrldj.supabase.co
SUPABASE_SERVICE_KEY=<your-service-key>

# JWT Authentication
JWT_SECRET=<min-32-chars-random-string>

# Cloud Run (Gemini API)
CLOUD_RUN_URL=https://gemini-generate-fn-513563150820.asia-northeast1.run.app

# Google Search (optional)
GOOGLE_SEARCH_API_KEY=<your-api-key>
GOOGLE_SEARCH_CX=<your-cx>
```

## Authentication Flow

All protected routes use Bearer token authentication:

1. User calls `/api/auth/register` or `/api/auth/login`
2. Server returns a JWT token signed with `JWT_SECRET`
3. Client stores token and includes in `Authorization: Bearer <token>` header
4. Server calls `authenticateRequest(request)` helper to validate token
5. If valid, `userId` is extracted and passed to route logic

## API Endpoints

### Authentication

#### POST `/api/auth/register`
Register a new user and create default settings.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "min-8-chars",
  "name": "John Doe",
  "company": "Acme Corp"
}
```

**Response (201):**
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

#### POST `/api/auth/login`
Authenticate user and receive JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

#### POST `/api/auth/verify`
Verify a JWT token and get the associated user ID.

**Request:**
```json
{
  "token": "eyJhbGc..."
}
```

**Response (200):**
```json
{
  "message": "Token verified",
  "userId": "uuid"
}
```

### Email Generation

#### POST `/api/email/generate`
Generate personalized email patterns using Gemini API.

**Request (requires auth):**
```json
{
  "companyName": "Acme Corp",
  "persona": "executive",
  "ctaType": "call",
  "sourceType": "web",
  "newsIdx": 0,
  "freeText": "Optional custom text"
}
```

**Response (200):**
```json
{
  "message": "Emails generated successfully",
  "generatedEmail": {
    "id": "uuid",
    "companyName": "Acme Corp",
    "patterns": [
      {
        "patternName": "経営層向け（ROI訴求）",
        "subject": "Email subject",
        "body": "Email body",
        "targetPersona": "executive",
        "description": "Pattern description"
      }
    ],
    "research": { /* CompanyResearch object */ },
    "subOutputs": {
      "phone_script": "Phone script text",
      "video_prompt": "Video prompt",
      "follow_up_scenarios": ["Scenario 1", "Scenario 2", "Scenario 3"]
    },
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

### Company Research

#### POST `/api/research/company`
Research a company using Google Search and Gemini analysis.

**Request (requires auth):**
```json
{
  "companyName": "Acme Corp"
}
```

**Response (200):**
```json
{
  "message": "Company research completed",
  "research": {
    "company_name": "Acme Corp",
    "overview": "Company overview",
    "business": "Business description",
    "industry": "Tech",
    "stage": "Growth",
    "employees": 150,
    "news": [
      {
        "title": "News title",
        "summary": "News summary"
      }
    ],
    "pains": ["Pain point 1", "Pain point 2"],
    "hypothesis": "How service helps",
    "scraped_at": "2024-01-15T10:00:00Z"
  }
}
```

### Leads Management

#### GET `/api/leads`
List leads with pagination and filtering (requires auth).

**Query Parameters:**
- `status` - Filter by status (prospect|contacted|interested|proposal|won|lost)
- `dateFrom` - Filter from date (ISO 8601)
- `dateTo` - Filter to date (ISO 8601)
- `sort` - Sort field (default: created_at)
- `limit` - Results per page (default: 50)
- `offset` - Pagination offset (default: 0)

**Response (200):**
```json
{
  "message": "Leads retrieved successfully",
  "leads": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "company_name": "Acme Corp",
      "contact_name": "John Smith",
      "contact_email": "john@acme.com",
      "contact_phone": "+81-90-1234-5678",
      "contact_title": "CTO",
      "status": "prospect",
      "notes": "Initial contact",
      "source": "webinar",
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2024-01-15T10:00:00Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 125
  }
}
```

#### POST `/api/leads`
Create a new lead (requires auth).

**Request:**
```json
{
  "companyName": "Acme Corp",
  "contactName": "John Smith",
  "contactEmail": "john@acme.com",
  "contactPhone": "+81-90-1234-5678",
  "contactTitle": "CTO",
  "status": "prospect",
  "notes": "Initial contact",
  "source": "webinar"
}
```

**Response (201):**
```json
{
  "message": "Lead created successfully",
  "lead": { /* Lead object */ }
}
```

#### PATCH `/api/leads/[id]`
Update a lead (requires auth).

**Request:**
```json
{
  "status": "interested",
  "notes": "Updated notes",
  "lastContactDate": "2024-01-15T10:00:00Z"
}
```

**Response (200):**
```json
{
  "message": "Lead updated successfully",
  "lead": { /* Updated Lead object */ }
}
```

#### DELETE `/api/leads/[id]`
Soft delete a lead (requires auth). Sets `is_deleted = true`.

**Response (200):**
```json
{
  "message": "Lead deleted successfully"
}
```

### Settings

#### GET `/api/settings`
Get user custom settings (requires auth).

**Response (200):**
```json
{
  "message": "Settings retrieved successfully",
  "settings": {
    "id": "uuid",
    "user_id": "uuid",
    "sender_name": "Your Name",
    "sender_title": "Sales Manager",
    "sender_company": "Your Company",
    "service_name": "Your Service",
    "service_description": "Service description",
    "service_benefit": "Key benefits",
    "tone": "Professional and friendly",
    "prompt": "Custom prompt",
    "knowledge_base_ids": ["id1", "id2"],
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z"
  }
}
```

#### PATCH `/api/settings`
Update user settings (requires auth).

**Request:**
```json
{
  "senderName": "New Name",
  "serviceName": "New Service",
  "tone": "Casual and friendly"
}
```

**Response (200):**
```json
{
  "message": "Settings updated successfully",
  "settings": { /* Updated settings */ }
}
```

### Knowledge Base

#### GET `/api/settings/knowledge-base`
List knowledge base items (requires auth).

**Response (200):**
```json
{
  "message": "Knowledge base items retrieved successfully",
  "items": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "title": "Item Title",
      "content": "Item content",
      "category": "Industry Knowledge",
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

#### POST `/api/settings/knowledge-base`
Create a knowledge base item (requires auth).

**Request:**
```json
{
  "title": "Item Title",
  "content": "Item content",
  "category": "Industry Knowledge"
}
```

**Response (201):**
```json
{
  "message": "Knowledge base item created successfully",
  "item": { /* KnowledgeBaseItem object */ }
}
```

#### DELETE `/api/settings/knowledge-base/[id]`
Delete a knowledge base item (requires auth).

**Response (200):**
```json
{
  "message": "Knowledge base item deleted successfully"
}
```

### Analytics

#### GET `/api/analytics/kpi`
Get KPI analytics data (requires auth).

**Query Parameters:**
- `period` - week|month|quarter|year (default: month)
- `member` - Filter by team member (optional)

**Response (200):**
```json
{
  "message": "KPI data retrieved successfully",
  "kpi": {
    "period": "month",
    "emails_generated": 45,
    "emails_sent": 45,
    "reply_rate": 22.5,
    "appointment_rate": 15.0,
    "deal_rate": 5.0,
    "success_factors": [],
    "top_personas": [
      { "persona": "executive", "count": 20 },
      { "persona": "manager", "count": 15 }
    ],
    "top_ctas": [
      { "cta": "call", "count": 30 },
      { "cta": "demo", "count": 15 }
    ]
  }
}
```

#### GET `/api/analytics/success-factors`
Get success factors based on replied emails (requires auth).

**Response (200):**
```json
{
  "message": "Success factors retrieved successfully",
  "success_factors": [
    {
      "factor": "経営層向け（ROI訴求）",
      "count": 12,
      "percentage": 30.5,
      "category": "structure"
    }
  ]
}
```

## Key Implementation Notes

### Service Layer

1. **supabase.ts**: Initializes Supabase client with service role key for server-side access
2. **auth-utils.ts**: Provides JWT token generation/verification and password hashing
3. **gemini-service.ts**: Encapsulates AI email generation logic with fallback patterns
4. **research-service.ts**: Handles company research with 30-day cache invalidation

### Route Handler Pattern

Each API route follows this pattern:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-utils';

export async function POST(request: NextRequest) {
  try {
    // Authenticate if needed
    const userId = authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request
    const body = await request.json();
    const validated = MySchema.parse(body);

    // Business logic
    const result = await doSomething(validated, userId);

    // Return response
    return NextResponse.json({ /* response */ }, { status: 200 });
  } catch (error) {
    // Error handling
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to complete request' }, { status: 500 });
  }
}
```

### Data Type Handling

The backend uses database field names (snake_case: `sender_name`) while the frontend types use camelCase (`senderName`). The Gemini service handles both conventions:

```typescript
const senderName = (settings as any).sender_name || settings.senderName || '';
```

## Frontend Changes Required

1. **api-client.ts** - Already updated to use relative paths (`/api/...`)
2. **Authentication flow** - Token-based JWT instead of session-based
3. **API calls** - Changed from `${API_URL}/email/generate` to `/api/email/generate`

## Deployment to Vercel

1. Set environment variables in Vercel project settings
2. Deploy the entire Next.js app (frontend + API routes together)
3. No separate backend deployment needed
4. API routes automatically become accessible at `/api/*` paths

## Database Schema

Ensure Supabase has these tables:

- `users` - Authentication and user info
- `custom_settings` - User's email generation settings
- `leads` - Sales leads with soft delete flag
- `generated_emails` - History of generated email patterns
- `knowledge_base` - User knowledge base items
- `research_cache` - Cache of company research (30-day TTL)

## Migration Checklist

- [x] Create lib/supabase.ts
- [x] Create lib/gemini-service.ts
- [x] Create lib/research-service.ts
- [x] Create lib/auth-utils.ts
- [x] Create API routes (auth, email, research, leads, settings, analytics)
- [x] Update package.json with dependencies
- [x] Update api-client.ts to use relative paths
- [x] Test all endpoints
- [x] Set environment variables in Vercel
- [x] Deploy to Vercel

## Troubleshooting

### JWT Token Issues
- Ensure `JWT_SECRET` is at least 32 characters
- Check token expiration (set to 7 days)
- Verify Bearer format in Authorization header

### Supabase Connection
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are correct
- Service key (not anon key) is required for server-side operations
- Test connection with `testDatabaseConnection()` helper

### Gemini/Cloud Run
- Verify `CLOUD_RUN_URL` is accessible
- Check Cloud Run function is deployed and running
- Verify request/response format: `{ prompt }` → `{ ok, result }`

### CORS/Auth
- No CORS needed since API is co-located
- All protected routes must check authentication
- Client must include Bearer token in Authorization header

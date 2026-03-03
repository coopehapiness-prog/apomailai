# Next.js Backend API Setup Guide

This guide explains how to set up and run the migrated API routes.

## Quick Start

### 1. Install Dependencies

```bash
cd /sessions/upbeat-happy-lamport/mnt/ismail/apomailai
npm install
```

This installs the new dependencies:
- `@supabase/supabase-js` - Supabase client
- `bcryptjs` - Password hashing
- `jsonwebtoken` - JWT token generation/verification
- `zod` - Request validation
- Type definitions for the above

### 2. Set Environment Variables

Create a `.env.local` file in the project root:

```env
# Supabase
SUPABASE_URL=https://janpraewvquegxhzrldj.supabase.co
SUPABASE_SERVICE_KEY=your-service-key-here

# JWT Authentication (min 32 characters)
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long

# Cloud Run (Gemini API)
CLOUD_RUN_URL=https://gemini-generate-fn-513563150820.asia-northeast1.run.app

# Optional: Google Search
GOOGLE_SEARCH_API_KEY=your-google-api-key
GOOGLE_SEARCH_CX=your-google-cx
```

**For Vercel deployment**, set these variables in:
- Vercel Project Settings → Environment Variables

### 3. Run Development Server

```bash
npm run dev
```

The application will start at `http://localhost:3000` with API routes at `http://localhost:3000/api/`.

### 4. Test API Routes

#### Test Authentication

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123456",
    "name": "Test User",
    "company": "Test Company"
  }'

# Expected response:
# {
#   "message": "User registered successfully",
#   "token": "eyJhbGc...",
#   "user": { "id": "...", "email": "test@example.com", "name": "Test User" }
# }
```

#### Test Protected Routes (using Bearer token)

```bash
# Replace TOKEN with the token from register/login response
TOKEN="your-token-here"

# Get settings
curl -X GET http://localhost:3000/api/settings \
  -H "Authorization: Bearer $TOKEN"

# Expected response:
# {
#   "message": "Settings retrieved successfully",
#   "settings": { ... }
# }
```

## File Structure

```
src/
├── lib/
│   ├── supabase.ts           # Supabase client
│   ├── gemini-service.ts     # AI email generation
│   ├── research-service.ts   # Company research
│   ├── auth-utils.ts         # JWT & password hashing
│   ├── types.ts              # TypeScript types
│   └── api-client.ts         # Frontend API client
├── app/
│   └── api/
│       ├── auth/
│       │   ├── register/route.ts
│       │   ├── login/route.ts
│       │   └── verify/route.ts
│       ├── email/
│       │   └── generate/route.ts
│       ├── research/
│       │   └── company/route.ts
│       ├── leads/
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       ├── settings/
│       │   ├── route.ts
│       │   └── knowledge-base/
│       │       ├── route.ts
│       │       └── [id]/route.ts
│       └── analytics/
│           ├── kpi/route.ts
│           └── success-factors/route.ts
```

## API Endpoints

All endpoints are relative to the app root. See `BACKEND_MIGRATION.md` for complete API documentation.

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/verify` - Verify token

### Email Generation
- `POST /api/email/generate` - Generate email patterns

### Research
- `POST /api/research/company` - Research a company

### Leads (all require auth)
- `GET /api/leads` - List leads
- `POST /api/leads` - Create lead
- `PATCH /api/leads/[id]` - Update lead
- `DELETE /api/leads/[id]` - Delete lead

### Settings (all require auth)
- `GET /api/settings` - Get settings
- `PATCH /api/settings` - Update settings

### Knowledge Base (all require auth)
- `GET /api/settings/knowledge-base` - List items
- `POST /api/settings/knowledge-base` - Create item
- `DELETE /api/settings/knowledge-base/[id]` - Delete item

### Analytics (all require auth)
- `GET /api/analytics/kpi` - Get KPI metrics
- `GET /api/analytics/success-factors` - Get success factors

## Authentication Flow

All protected API routes require a Bearer token:

```typescript
Authorization: Bearer <jwt-token>
```

The token is obtained from:
1. `/api/auth/register` - Returns token on successful registration
2. `/api/auth/login` - Returns token on successful login

The token contains the user's ID and is valid for 7 days.

## Database Requirements

Ensure your Supabase project has these tables:

### users
- id (UUID, primary key)
- email (text, unique)
- password_hash (text)
- name (text, optional)
- company (text, optional)
- created_at (timestamp)
- updated_at (timestamp)

### custom_settings
- id (UUID, primary key)
- user_id (UUID, foreign key)
- sender_name (text)
- sender_title (text)
- sender_company (text)
- service_name (text)
- service_description (text)
- service_benefit (text)
- tone (text, optional)
- prompt (text, optional)
- knowledge_base_ids (array, optional)
- created_at (timestamp)
- updated_at (timestamp)

### leads
- id (UUID, primary key)
- user_id (UUID, foreign key)
- company_name (text)
- contact_name (text, optional)
- contact_email (text, optional)
- contact_phone (text, optional)
- contact_title (text, optional)
- status (enum: prospect|contacted|interested|proposal|won|lost)
- notes (text, optional)
- source (text, optional)
- assignee (text, optional)
- last_contact_date (timestamp, optional)
- is_deleted (boolean, default false)
- created_at (timestamp)
- updated_at (timestamp)

### generated_emails
- id (UUID, primary key)
- user_id (UUID, foreign key)
- company_name (text)
- patterns (jsonb array)
- company_research (jsonb)
- settings_id (UUID, optional)
- persona (text, optional)
- source_type (text, optional)
- cta_type (text, optional)
- news_idx (integer, optional)
- sub_outputs (jsonb, optional)
- reply_received (boolean, optional)
- reply_date (timestamp, optional)
- appointment_booked (boolean, optional)
- deal_won (boolean, optional)
- created_at (timestamp)
- updated_at (timestamp)

### knowledge_base
- id (UUID, primary key)
- user_id (UUID, foreign key)
- title (text)
- content (text)
- category (text, optional)
- created_at (timestamp)
- updated_at (timestamp)

### research_cache
- id (UUID, primary key)
- company_name (text)
- user_id (UUID, foreign key)
- research_data (jsonb)
- created_at (timestamp)

## Building for Production

```bash
npm run build
npm start
```

The API routes will be bundled and served with the Next.js app.

## Deploying to Vercel

1. Push code to GitHub
2. Connect repository to Vercel
3. Set environment variables in Vercel project settings
4. Deploy - Vercel will automatically build and deploy the Next.js app with API routes

No additional backend deployment is needed!

## Troubleshooting

### "SUPABASE_URL is not configured"
- Check `.env.local` has `SUPABASE_URL` set
- Verify environment variables in Vercel project settings

### "JWT_SECRET should be at least 32 characters long"
- Generate a longer secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### "Cloud Run returned 404"
- Verify Cloud Run function is deployed
- Check Cloud Run function URL is correct
- Verify network connectivity to Cloud Run

### "Invalid token"
- Token may have expired (7 days)
- Token may have been tampered with
- JWT_SECRET may not match between registration and verification

### API route returns 404
- Check route path matches (case-sensitive)
- Verify file is named `route.ts` (not `routes.ts`)
- Check directory structure matches expected pattern

## Performance Tips

- API routes are serverless functions on Vercel
- Cold starts are minimal (Next.js optimization)
- Database connections are pooled by Supabase
- Research cache (30-day TTL) reduces API calls

## Security Notes

- JWT_SECRET must be kept secret and at least 32 characters
- SUPABASE_SERVICE_KEY must be kept secret (server-side only)
- Passwords are hashed with bcrypt (10 rounds)
- All protected routes verify authentication
- Input validation with Zod on all endpoints
- SQL injection prevented by Supabase client

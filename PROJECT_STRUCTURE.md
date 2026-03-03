# Project Structure - アポメールAI

## Complete File Inventory

All frontend files for the Next.js 14 App Router project have been created. Below is a comprehensive breakdown of the project structure.

### Root Configuration Files

1. **package.json** - Dependencies and scripts configuration
   - Next.js 14, React 18, NextAuth.js, React Hot Toast
   - Dev dependencies for TypeScript, Tailwind CSS, ESLint

2. **tsconfig.json** - TypeScript configuration with strict mode
   - Path aliases: `@/*` → `./src/*`

3. **tsconfig.node.json** - TypeScript config for Node.js files

4. **next.config.js** - Next.js app configuration

5. **tailwind.config.ts** - Tailwind CSS theming
   - Dark theme colors matching mockup
   - Custom color variables (bg, card, border, primary, accent)

6. **postcss.config.js** - PostCSS plugins for Tailwind

7. **.eslintrc.json** - ESLint configuration extending Next.js

8. **.gitignore** - Git ignore patterns

9. **.env.local.example** - Environment variables template
   - `NEXT_PUBLIC_API_URL` - Cloud Run API endpoint
   - `NEXTAUTH_URL` - Application URL
   - `NEXTAUTH_SECRET` - Session secret

### Application Layer

#### src/app/globals.css
- Tailwind directives (@tailwind)
- CSS variables for theme colors
- Custom component styles (inputs, buttons, loading spinner)

#### src/app/layout.tsx (Root Layout)
- SessionProvider setup
- Toaster component for notifications
- Metadata configuration
- Dark theme HTML setup

#### src/app/page.tsx
- Home page - redirects to /dashboard/email
- Client-side redirect using useRouter

#### src/middleware.ts
- Route protection for /dashboard/* routes
- Redirect unauthenticated users to /auth/login
- Redirect authenticated users away from /auth/login

### Authentication

#### src/app/auth/login/page.tsx
- Login and registration page
- Toggle between login/register modes
- Form validation
- NextAuth credentials provider integration
- Toast notifications for feedback
- Responsive dark theme card design
- Gradient logo

### API Route Handlers

#### src/app/api/auth/[...nextauth]/route.ts
- NextAuth.js configuration
- CredentialsProvider for email/password auth
- Backend API integration (POST /auth/login, POST /auth/register)
- JWT callback to store accessToken
- Session callback to expose accessToken and userId
- API client initialization with token

### Dashboard

#### src/app/dashboard/layout.tsx
- Navigation bar with gradient logo
- Tabs for three main sections:
  1. メール生成 (/dashboard/email)
  2. リード管理・分析 (/dashboard/leads)
  3. カスタム設定 (/dashboard/settings)
- Active tab highlighting
- User email display
- Logout button
- Responsive design (mobile/desktop)

#### src/app/dashboard/email/page.tsx
- **Initial State**: Form for email generation
  - Company name input
  - Lead source dropdown (5 options)
  - Optional history textarea
  - Generate button

- **Result State**: Generated email display
  - Research report component
  - Email output with pattern tabs (A-E)
  - Customization section (accordion):
    - Personas selection (4 options)
    - News checkboxes (from research)
    - CTA radio buttons (5 options)
    - Free text with chips
  - Regenerate button
  - New creation button

- **Loading State**: LoadingOverlay with sequential steps

##### Components:

**src/app/dashboard/email/components/ResearchReport.tsx**
- Displays company research data in grid layout
- 企業概要, 事業概要, 業界・ステージ, 従業員規模 sections
- Latest news (5 items with links)
- Pain points/課題仮説 display

**src/app/dashboard/email/components/EmailOutput.tsx**
- Pattern tabs (A-E)
- Subject line and body display
- Copy buttons for each section
- Accordion sections:
  - Phone script
  - Video prompt
  - Follow-up scenarios
- Copy functionality per section

#### src/app/dashboard/leads/page.tsx
- Lead management and analytics dashboard
- **KPI Cards** (4 metrics):
  - メール生成 (emails generated)
  - 返信数 (replies with rate)
  - アポ設定 (appointments with rate)
  - 成約数 (deals with rate)

- **Filter Section**:
  - Status dropdown
  - Date range filters
  - Member selector
  - Period tabs (today, week, month, quarter, year)

- **Leads Table**:
  - Company name, contact, email, status, date, email/reply count
  - Responsive design
  - Status badges with color coding
  - Hover effects

- **Success Factors Analysis**:
  - Expandable accordion sections
  - Email subject, category, factor, evidence
  - Grouped by category

#### src/app/dashboard/settings/page.tsx
- **Sender Profile Section**:
  - 5 input fields (name, title, company, phone)
  - Signature textarea
  - Signature preview toggle
  - Save button with loading state

- **Service Info Section**:
  - Service name
  - Description
  - Strengths (dynamic list)
  - Price
  - Results
  - Save button

- **Prompt Settings Section**:
  - Base prompt textarea
  - Tone input
  - Save button

- **Knowledge Base Section**:
  - Drag & drop file upload area
  - List of uploaded items
  - Delete functionality

### Shared Components

#### src/components/LoadingOverlay.tsx
- Full-screen overlay with spinner
- Sequential step messages (4 steps):
  1. 企業情報を分析中...
  2. ニュースを収集中...
  3. 課題を特定中...
  4. メールを生成中...
- Progress bar animation
- Auto-rotating steps every 1.5 seconds

#### src/components/CopyButton.tsx
- Reusable copy-to-clipboard button
- Toast feedback on copy
- State-based styling (copied state)
- Customizable label

#### src/components/Navigation.tsx
- Shared navigation component
- Logo and tabs
- User info display
- Logout button

### Type Definitions

#### src/lib/types.ts
Complete TypeScript interfaces:

- **User** - User information
- **CustomSettings** - User settings (sender, service, prompt, KB)
- **KnowledgeBaseItem** - KB entry
- **CompanyResearch** - Research data
- **NewsItem** - News article
- **EmailGenRequest** - API request payload
- **EmailPattern** - Generated email pattern
- **GeneratedEmail** - Full response with patterns + research
- **Lead** - CRM lead entry
- **SuccessFactor** - Success analysis item
- **AnalyticsKPI** - Performance metrics

### API Client

#### src/lib/api-client.ts
- **APIClient** class for all backend communication
- Base URL from `NEXT_PUBLIC_API_URL`
- Authorization header with Bearer token
- Methods:
  - `generateEmail()` - POST /api/email/generate
  - `researchCompany()` - POST /api/research/company
  - `getSettings()` - GET /api/settings
  - `updateSettings()` - PATCH /api/settings
  - `getLeads()` - GET /api/leads (with filters)
  - `createLead()` - POST /api/leads
  - `updateLead()` - PATCH /api/leads/:id
  - `getAnalytics()` - GET /api/analytics (with period, member)
- Token management via `setAccessToken()`

### Custom Hooks

#### src/lib/hooks/useEmailGeneration.ts
- **State Management**:
  - company, source, history
  - patterns, research
  - loading, error flags

- **Methods**:
  - `generate()` - Call API and update state
  - `regenerate()` - Generate with customization
  - `reset()` - Clear all state

#### src/lib/hooks/useSettings.ts
- **State Management**:
  - settings (CustomSettings | null)
  - loading, error flags

- **Methods**:
  - `fetchSettings()` - Load settings from API
  - `updateSettings()` - Patch settings
  - Auto-fetch on mount via useEffect

### Additional Documentation

#### README.md
- Feature overview
- Tech stack details
- Installation instructions
- Project structure explanation
- Scripts documentation
- Configuration file reference
- API integration guide
- Styling information
- Development guidelines
- Deployment instructions

#### PROJECT_STRUCTURE.md (This File)
- Complete file inventory
- Detailed descriptions of all files
- Architecture overview

## Directory Tree

```
apomailai/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── auth/
│   │   │       └── [...nextauth]/
│   │   │           └── route.ts
│   │   ├── auth/
│   │   │   └── login/
│   │   │       └── page.tsx
│   │   ├── dashboard/
│   │   │   ├── email/
│   │   │   │   ├── components/
│   │   │   │   │   ├── EmailOutput.tsx
│   │   │   │   │   └── ResearchReport.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── leads/
│   │   │   │   └── page.tsx
│   │   │   ├── settings/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── CopyButton.tsx
│   │   ├── LoadingOverlay.tsx
│   │   └── Navigation.tsx
│   ├── lib/
│   │   ├── api-client.ts
│   │   ├── types.ts
│   │   └── hooks/
│   │       ├── useEmailGeneration.ts
│   │       └── useSettings.ts
│   └── middleware.ts
├── .env.local.example
├── .eslintrc.json
├── .gitignore
├── next.config.js
├── package.json
├── postcss.config.js
├── README.md
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.node.json
└── PROJECT_STRUCTURE.md
```

## Key Features Implemented

### Frontend Features
✅ Dark theme matching mockup design
✅ Responsive layout (mobile, tablet, desktop)
✅ Loading animations with sequential steps
✅ Toast notifications for user feedback
✅ Form validation and error handling
✅ Copy-to-clipboard functionality
✅ Accordion/expandable sections
✅ Tabs for email patterns
✅ Status badges with color coding
✅ Grid and table layouts
✅ Gradient UI elements

### State Management
✅ Custom hooks for complex logic
✅ React hooks (useState, useEffect, useCallback)
✅ NextAuth session management
✅ API client with token handling
✅ Loading and error states

### Authentication
✅ Login/Register pages
✅ Credentials provider with NextAuth
✅ Route protection via middleware
✅ Session persistence
✅ Token-based API calls

### API Integration
✅ Complete API client
✅ Error handling
✅ Query parameters support
✅ Bearer token authentication
✅ All endpoints mapped

### UI/UX
✅ Consistent color scheme
✅ Button states (hover, disabled, loading)
✅ Input focus states
✅ Smooth transitions
✅ Clear visual hierarchy
✅ Japanese language throughout

## Getting Started

1. Copy `.env.local.example` to `.env.local`
2. Configure environment variables
3. Run `npm install`
4. Run `npm run dev`
5. Open http://localhost:3000

## Next Steps

1. Ensure backend API is running at `NEXT_PUBLIC_API_URL`
2. Test authentication flow
3. Test email generation workflow
4. Verify API integration
5. Deploy to production

## Notes

- All files use TypeScript with strict mode
- All client components marked with `'use client'`
- Tailwind CSS used throughout for styling
- Dark theme as primary design
- Japanese UI text throughout
- Responsive design implemented
- Error handling with toast notifications

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
- **Result State**: Generated email display
- **Loading State**: LoadingOverlay with sequential steps

#### src/app/dashboard/leads/page.tsx
- Lead management and analytics dashboard

#### src/app/dashboard/settings/page.tsx
- Sender profile, service info, prompt settings, knowledge base

### Shared Components

- LoadingOverlay.tsx
- CopyButton.tsx
- Navigation.tsx

## Directory Tree

```
apomailai/
├── src/
│   ├── app/
│   │   ├── api/...
│   │   ├── auth/...
│   │   ├── dashboard/...
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/...
│   ├── lib/...
│   └── middleware.ts
├── .env.local.example
├── package.json
├── README.md
└── tsconfig.json
```

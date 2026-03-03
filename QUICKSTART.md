# Quick Start Guide - アポメールAI Frontend

## Prerequisites
- Node.js 18 or higher
- npm or yarn package manager
- Backend API running (Cloud Run)

## Installation (2 minutes)

```bash
# 1. Navigate to project directory
cd /sessions/upbeat-happy-lamport/mnt/ismail/apomailai

# 2. Install dependencies
npm install

# 3. Setup environment variables
cp .env.local.example .env.local

# 4. Edit .env.local with your configuration
nano .env.local
# Or use your preferred editor
```

## Environment Configuration

Edit `.env.local` and set:

```env
# Required: Your Cloud Run backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8080

# Required: Application URL
NEXTAUTH_URL=http://localhost:3000

# Required: Generate a secure random string
# On macOS/Linux: openssl rand -hex 32
NEXTAUTH_SECRET=your-generated-secret-here
```

## Running the Application

```bash
# Development mode (with hot reload)
npm run dev

# Production build
npm run build

# Production start
npm start
```

Visit **http://localhost:3000** in your browser.

## Project Structure Quick Overview

```
src/
├── app/
│   ├── auth/login/         # Login/Register page
│   ├── dashboard/          # Main application
│   │   ├── email/          # Email generation
│   │   ├── leads/          # Lead management & analytics
│   │   └── settings/       # Configuration
│   └── api/auth/           # NextAuth API routes
├── components/             # Reusable UI components
├── lib/
│   ├── api-client.ts       # Backend API calls
│   ├── types.ts            # TypeScript interfaces
│   └── hooks/              # Custom React hooks
└── middleware.ts           # Route protection
```

## Key Features

### 1. Email Generation (メール生成)
- Input company name and lead source
- AI generates 5 email patterns (A-E)
- Research company data automatically
- Customize with personas, news, CTA
- Copy patterns to clipboard

### 2. Lead Management (リード管理・分析)
- View and filter leads by status
- Analytics dashboard with 4 KPIs
- Success factor analysis
- Date range filtering
- Member-based reports

### 3. Settings (カスタム設定)
- Manage sender profile
- Configure service information
- Setup AI prompt settings
- Knowledge base management

## Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm start        # Start production server
```

## Testing the Authentication

### Initial Setup
1. The app redirects unauthenticated users to `/auth/login`
2. You can test with login or register

### Test Flow
1. Go to http://localhost:3000
2. Should redirect to http://localhost:3000/auth/login
3. Use login or register form
4. Backend validates credentials at `POST /auth/login` or `POST /auth/register`
5. On success, redirect to `/dashboard/email`

## API Endpoints Expected

The backend should have these endpoints:

```
Authentication:
POST   /auth/login           # Login user
POST   /auth/register        # Register new user

Email Generation:
POST   /api/email/generate   # Generate emails
POST   /api/research/company # Research company

Settings:
GET    /api/settings         # Get user settings
PATCH  /api/settings         # Update settings

Leads:
GET    /api/leads            # List leads
POST   /api/leads            # Create lead
PATCH  /api/leads/:id        # Update lead

Analytics:
GET    /api/analytics        # Get analytics data
```

## Dark Theme Colors

The application uses a dark theme with these colors:

| Color | Value | Usage |
|-------|-------|-------|
| Background | #0a0f1e | Page background |
| Card | #1e293b | Card backgrounds |
| Border | #334155 | Borders and dividers |
| Primary | #3b82f6 | Buttons, highlights |
| Accent | #8b5cf6 | Secondary highlights |

## TypeScript

All code is written in TypeScript with strict mode enabled. For type checking:

```bash
npx tsc --noEmit
```

## Troubleshooting

### Port 3000 already in use
```bash
# Use a different port
npm run dev -- -p 3001
```

### Module not found errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install
```

### TypeScript errors
```bash
# Check for type errors
npx tsc --noEmit

# Verify paths in tsconfig.json
cat tsconfig.json
```

### API connection errors
- Verify `NEXT_PUBLIC_API_URL` in `.env.local`
- Check if backend API is running
- Check CORS configuration on backend
- Use browser DevTools Network tab to debug

## Browser DevTools

### Console
- Check for errors and warnings
- NextAuth debug info available

### Network Tab
- Monitor API calls to backend
- Check response status and data
- Verify Authorization headers

### Application Tab
- Check SessionStorage for NextAuth data
- Verify environment variables are loaded

## Performance Tips

1. Keep API responses fast (< 2 seconds for email generation)
2. Implement pagination for large lead lists
3. Cache analytics data where appropriate
4. Use React.memo for list items if needed

## Security Notes

- Credentials are handled by NextAuth.js securely
- Tokens are stored in SessionStorage (not localStorage)
- HTTPS should be used in production
- Never commit `.env.local` to version control
- Rotate `NEXTAUTH_SECRET` in production regularly

## Next Steps

1. Start the development server: `npm run dev`
2. Test the authentication flow
3. Connect to your backend API
4. Customize styling/colors if needed
5. Deploy to production (Vercel recommended)

## Deployment Options

### Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Traditional Server
```bash
npm run build
npm start
```

## Support & Documentation

- **Next.js Docs**: https://nextjs.org/docs
- **NextAuth.js Docs**: https://next-auth.js.org
- **Tailwind CSS**: https://tailwindcss.com/docs
- **React Docs**: https://react.dev
- **TypeScript Docs**: https://www.typescriptlang.org/docs

## File Locations Reference

| Purpose | Path |
|---------|------|
| Login page | `/src/app/auth/login/page.tsx` |
| Email generation | `/src/app/dashboard/email/page.tsx` |
| Lead management | `/src/app/dashboard/leads/page.tsx` |
| Settings | `/src/app/dashboard/settings/page.tsx` |
| API client | `/src/lib/api-client.ts` |
| Type definitions | `/src/lib/types.ts` |
| Email hook | `/src/lib/hooks/useEmailGeneration.ts` |
| Settings hook | `/src/lib/hooks/useSettings.ts` |

---

Ready to start? Run `npm run dev` and visit http://localhost:3000!

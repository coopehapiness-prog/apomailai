# アポメールAI (Apomailai) - IS Sales Email Generation Tool

AI-powered sales email generation tool for IS Sales. Built with Next.js 14, TypeScript, and Tailwind CSS.

## Features

- **Email Generation**: AI-powered email generation based on company research
- **Lead Management**: Manage and track sales leads with analytics
- **Company Research**: Automatic research including company overview, news, and pain points
- **Email Customization**: Customize generated emails with personas, CTA, and more
- **Analytics Dashboard**: Track email performance and conversion rates
- **Settings Management**: Manage sender profile, service info, and AI prompts

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: NextAuth.js (Credentials Provider)
- **Notifications**: React Hot Toast
- **Backend**: Cloud Run API

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Backend API running (Cloud Run)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd apomailai
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` and configure:
- `NEXT_PUBLIC_API_URL`: Your Cloud Run API endpoint
- `NEXTAUTH_URL`: Application URL
- `NEXTAUTH_SECRET`: Generate a secure random string

4. Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/
│   ├── auth/
│   │   └── login/          # Login/Register page
│   ├── api/
│   │   └── auth/           # NextAuth configuration
│   ├── dashboard/
│   │   ├── email/          # Email generation page
│   │   ├── leads/          # Lead management page
│   │   ├── settings/       # Settings page
│   │   └── layout.tsx      # Dashboard layout
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Home page (redirects to dashboard)
├── components/
│   ├── LoadingOverlay.tsx  # Loading animation
│   ├── CopyButton.tsx      # Copy to clipboard button
│   └── Navigation.tsx      # Navigation component
├── lib/
│   ├── api-client.ts       # API client
│   ├── types.ts            # TypeScript interfaces
│   └── hooks/
│       ├── useEmailGeneration.ts
│       └── useSettings.ts
└── middleware.ts           # Route protection
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server

## Configuration Files

- `tsconfig.json` - TypeScript configuration
- `next.config.js` - Next.js configuration
- `tailwind.config.ts` - Tailwind CSS configuration
- `postcss.config.js` - PostCSS configuration

## API Integration

The application communicates with a Cloud Run backend API with the following endpoints:

### Authentication
- `POST /auth/login` - Login
- `POST /auth/register` - Register

### Email Generation
- `POST /api/email/generate` - Generate emails
- `POST /api/research/company` - Research company

### Settings
- `GET /api/settings` - Get settings
- `PATCH /api/settings` - Update settings

### Leads & Analytics
- `GET /api/leads` - List leads
- `POST /api/leads` - Create lead
- `PATCH /api/leads/:id` - Update lead
- `GET /api/analytics` - Get analytics

## Styling

The application uses Tailwind CSS with a dark theme:
- Background: `#0a0f1e`
- Card: `#1e293b`
- Border: `#334155`
- Primary: `#3b82f6`
- Accent: `#8b5cf6`

## Development

### Adding New Pages

Create new pages in the appropriate directory under `src/app/dashboard/`.

### Adding New Components

Create reusable components in `src/components/`.

### Using Custom Hooks

Custom hooks are located in `src/lib/hooks/`. Use them with the `use` prefix and mark client components with `'use client'`.

## Production Deployment

1. Build the application:
```bash
npm run build
```

2. Deploy to your hosting platform (Vercel recommended):
```bash
vercel deploy
```

3. Set environment variables in your production environment.

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

Proprietary - IS Sales Inc.

## Support

For support, contact the development team.

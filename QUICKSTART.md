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
NEXTAUTH_SECRET=e7bbe6b52b091066e99509c49cb97ffc41374c54
```

## Start Development Server (Immediately)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. You should see the login page.
) to login or register.

## Accessing the Application
IRunning at `http://localhost:3000`

## Forward Ports (If remote)

If deploying remotely, create a SSH Qtunnel to forward ports locally:

```bash
ssh -L 3000:localhost:3000 -N <host>
dVCOm5xfRXW-dqkt5hPWk2aReXc1VeXgVO1CUg==
```

From another terminal, start the backend:

```bash
# From the Backend repository
python -m portal
```

Then select the hosted mode: `Portal CHOOSE LANGUAGE`, then choose `Posts Forcing Languages`. If adding a custom domain, then add your custom DNS in the Host Manager that popups up.

Use the hosted PERPURPOSE-, to contact localhost:8080 from the BRAVE browser on your phone.

---

For deeper information, see PROJECT_STRUCTURE.md and SETUP_NEXT_API.md.
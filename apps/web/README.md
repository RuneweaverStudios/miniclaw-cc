# @miniclaw/web

Web dashboard for Miniclaw - Server Pool Management Platform.

## Tech Stack

- **React 19** - UI framework
- **Vite 6** - Build tool and dev server
- **React Router 7** - Client-side routing
- **TanStack Query** - Data fetching and caching
- **Zustand** - State management
- **Tailwind CSS 4** - Utility-first CSS framework
- **Lucide React** - Icon library
- **TypeScript** - Type safety

## Project Structure

```
apps/web/
├── src/
│   ├── pages/           # Page components
│   │   ├── auth/        # Authentication pages
│   │   ├── servers/     # Server management pages
│   │   ├── settings/    # Settings pages
│   │   └── admin/       # Admin pages
│   ├── components/      # Reusable components
│   │   └── ui/          # UI components (shadcn/ui)
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utility functions and API client
│   ├── App.tsx          # Main app with router
│   ├── main.tsx         # Entry point
│   └── styles.css       # Global styles
├── public/              # Static assets
├── index.html           # HTML template
├── vite.config.ts       # Vite configuration
├── tailwind.config.js   # Tailwind CSS configuration
└── tsconfig.json        # TypeScript configuration
```

## Getting Started

### Prerequisites

- Node.js 18+ installed
- pnpm package manager

### Installation

Dependencies are managed by the root workspace. From the project root:

```bash
pnpm install
```

### Development

Start the development server:

```bash
pnpm --filter @miniclaw/web dev
```

The app will be available at `http://localhost:3000`

### Build

Build for production:

```bash
pnpm --filter @miniclaw/web build
```

### Preview

Preview the production build:

```bash
pnpm --filter @miniclaw/web preview
```

## Features

### Authentication
- User signup with stack selection
- Login/logout functionality
- Protected routes

### Dashboard
- Overview of server status
- Quick stats and metrics
- Recent activity

### Server Management
- List all servers
- View server details
- Start/stop/restart servers
- Terminate servers
- View server metrics

### Settings
- Profile management
- Password change
- Billing overview
- Invoice history

### Admin (Admin-only)
- Pool management
- Adjust pool sizes
- View pool history
- User management
- System metrics

## API Integration

The web app communicates with the API backend through:

- **REST API** - Standard HTTP requests via `src/lib/api.ts`
- **WebSocket** - Real-time updates via `src/hooks/use-websocket.ts`

## Environment Variables

Create a `.env` file (see `.env.example`):

```env
VITE_API_URL=http://localhost:4000/api
VITE_WS_URL=ws://localhost:4000
VITE_APP_NAME=Miniclaw
```

## UI Components

This project uses shadcn/ui for base UI components. Add new components:

```bash
npx shadcn@latest add [component-name]
```

Components are managed in `src/components/ui/`.

## State Management

- **TanStack Query** - Server state, caching, and synchronization
- **Zustand** - Client state (can be added as needed)
- **URL** - Routing state via React Router

## Styling

- **Tailwind CSS** - Utility-first styling
- **CSS Modules** - Component-specific styles (if needed)
- **Tailwind v4 Plugin** - Integrated via Vite

## Type Safety

Full TypeScript support with strict mode enabled. Types are shared with the backend via `@miniclaw/shared` package.

## Testing

Testing setup can be added as needed:
- Vitest for unit tests
- Playwright for E2E tests
- React Testing Library for component tests

## Deployment

Build the app and deploy the `dist` folder to any static hosting service:

- Vercel
- Netlify
- Cloudflare Pages
- AWS S3 + CloudFront

Ensure environment variables are configured in the hosting platform.

import { createBrowserRouter, redirect } from 'react-router-dom';
import { Landing } from './pages/landing';
import { Signup } from './pages/auth/signup';
import { Login } from './pages/auth/login';
import { AuthCallback } from './pages/auth/callback';
import { Checkout } from './pages/checkout';
import { CheckoutSuccess } from './pages/checkout/success';
import { DeployWizard } from './pages/deploy-wizard';
import { Dashboard } from './pages/dashboard';
import { ServerList } from './pages/servers/list';
import { ServerDetail } from './pages/servers/detail';
import { ProfileSettings } from './pages/settings/profile';
import { BillingSettings } from './pages/settings/billing';
import { PoolManagement } from './pages/admin/pool';
import { UserManagement } from './pages/admin/users';
import { Metrics } from './pages/admin/metrics';

// Utility function to check authentication
const isAuthenticated = () => {
  const token = localStorage.getItem('auth_token');
  return !!token;
};

// Protected route wrapper
const protectedLoader = () => {
  if (!isAuthenticated()) {
    return redirect('/login');
  }
  return null;
};

// Public route wrapper - redirect to dashboard if already authenticated
const publicLoader = () => {
  if (isAuthenticated()) {
    return redirect('/dashboard');
  }
  return null;
};

// Admin route wrapper
const adminLoader = () => {
  if (!isAuthenticated()) {
    return redirect('/login');
  }
  const userRole = localStorage.getItem('user_role');
  if (userRole !== 'admin') {
    return redirect('/dashboard');
  }
  return null;
};

// Create router
export const appRouter = createBrowserRouter([
  {
    path: '/',
    element: <Landing />,
  },
  {
    path: '/signup',
    element: <Signup />,
    loader: publicLoader,
  },
  {
    path: '/login',
    element: <Login />,
    loader: publicLoader,
  },
  {
    path: '/auth/callback',
    element: <AuthCallback />,
  },
  {
    path: '/checkout',
    element: <Checkout />,
    loader: protectedLoader,
  },
  {
    path: '/checkout/success',
    element: <CheckoutSuccess />,
    loader: protectedLoader,
  },
  {
    path: '/deploy',
    element: <DeployWizard />,
    loader: protectedLoader,
  },
  {
    path: '/dashboard',
    element: <Dashboard />,
    loader: protectedLoader,
  },
  {
    path: '/servers',
    element: <ServerList />,
    loader: protectedLoader,
  },
  {
    path: '/servers/:id',
    element: <ServerDetail />,
    loader: protectedLoader,
  },
  {
    path: '/settings/profile',
    element: <ProfileSettings />,
    loader: protectedLoader,
  },
  {
    path: '/settings/billing',
    element: <BillingSettings />,
    loader: protectedLoader,
  },
  {
    path: '/admin/pool',
    element: <PoolManagement />,
    loader: adminLoader,
  },
  {
    path: '/admin/users',
    element: <UserManagement />,
    loader: adminLoader,
  },
  {
    path: '/admin/metrics',
    element: <Metrics />,
    loader: adminLoader,
  },
  {
    path: '/faq',
    element: (
      <div className="min-h-screen bg-zinc-950 p-8 text-center text-zinc-400">
        <h1 className="text-2xl text-white">FAQ</h1>
        <p className="mt-4">Coming soon...</p>
      </div>
    ),
  },
]);

export default function App() {
  return null;
}

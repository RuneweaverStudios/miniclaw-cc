import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi, stacksApi, type Stack } from '@/lib/api';

export function Signup() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'details' | 'stack'>('details');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [selectedStack, setSelectedStack] = useState<string | null>(null);
  const [stacks, setStacks] = useState<Stack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadStacks = async () => {
    try {
      const data = await stacksApi.list();
      setStacks(data);
      setStep('stack');
    } catch (err) {
      setError('Failed to load available stacks');
    }
  };

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    await loadStacks();
  };

  const handleStackSelect = async (stackId: string) => {
    setSelectedStack(stackId);
    setLoading(true);
    setError('');

    try {
      await authApi.signup({
        ...formData,
        defaultStack: stackId,
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <Link
              to="/login"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              sign in to existing account
            </Link>
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {step === 'details' ? (
          <form className="mt-8 space-y-6" onSubmit={handleDetailsSubmit}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="name" className="sr-only">
                  Full name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Full name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div>
                <label htmlFor="email-address" className="sr-only">
                  Email address
                </label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Email address"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Continue
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Choose your default stack
            </h3>
            <div className="space-y-4">
              {stacks.map((stack) => (
                <button
                  key={stack.id}
                  onClick={() => handleStackSelect(stack.id)}
                  disabled={loading || !stack.available}
                  className={`w-full text-left p-4 border rounded-lg hover:border-indigo-500 transition-colors ${
                    !stack.available
                      ? 'opacity-50 cursor-not-allowed'
                      : 'cursor-pointer'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {stack.name}
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        {stack.description}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        {stack.cpu} vCPU, {stack.memory}GB RAM
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-indigo-600">
                        ${stack.price}/hr
                      </p>
                      <p className="text-xs text-gray-500">per instance</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

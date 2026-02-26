import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { poolApi } from '@/lib/api';
import { ArrowLeft, Activity, TrendingUp, Plus, Minus } from 'lucide-react';

export function PoolManagement() {
  const queryClient = useQueryClient();
  const { data: stats, isLoading } = useQuery({
    queryKey: ['pool-stats'],
    queryFn: poolApi.getStats,
  });

  const { data: history } = useQuery({
    queryKey: ['pool-history'],
    queryFn: poolApi.getHistory,
  });

  const [adjustment, setAdjustment] = useState({
    region: 'us-east-1',
    instanceType: 't3.medium',
    size: 5,
  });

  const adjustMutation = useMutation({
    mutationFn: (data: typeof adjustment) => poolApi.adjustSize(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pool-stats'] });
      alert('Pool size adjusted successfully');
    },
  });

  const handleAdjust = () => {
    adjustMutation.mutate(adjustment);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            <Link
              to="/dashboard"
              className="text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">
              Pool Management
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Pool Stats */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Activity className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Servers
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats?.totalServers || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-6 w-6 rounded-full bg-green-500"></div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Running
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats?.runningServers || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-6 w-6 rounded-full bg-blue-500"></div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Available
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats?.availableServers || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-6 w-6 rounded-full bg-yellow-500"></div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Pending
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats?.pendingServers || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-6 w-6 rounded-full bg-red-500"></div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Errors
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats?.errorServers || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Adjust Pool Size */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Adjust Pool Size
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Configure the size of the server pool for a specific region and
                instance type.
              </p>
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="region"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Region
                  </label>
                  <select
                    id="region"
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md border"
                    value={adjustment.region}
                    onChange={(e) =>
                      setAdjustment({ ...adjustment, region: e.target.value })
                    }
                  >
                    <option value="us-east-1">US East (N. Virginia)</option>
                    <option value="us-west-2">US West (Oregon)</option>
                    <option value="eu-west-1">EU (Ireland)</option>
                    <option value="ap-southeast-1">
                      Asia Pacific (Singapore)
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="instance-type"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Instance Type
                  </label>
                  <select
                    id="instance-type"
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md border"
                    value={adjustment.instanceType}
                    onChange={(e) =>
                      setAdjustment({
                        ...adjustment,
                        instanceType: e.target.value,
                      })
                    }
                  >
                    <option value="t3.medium">t3.medium (2 vCPU, 4 GB)</option>
                    <option value="t3.large">t3.large (2 vCPU, 8 GB)</option>
                    <option value="m5.large">m5.large (2 vCPU, 8 GB)</option>
                    <option value="m5.xlarge">m5.xlarge (4 vCPU, 16 GB)</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="pool-size"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Pool Size
                  </label>
                  <div className="mt-1 flex rounded-md shadow-sm">
                    <button
                      type="button"
                      onClick={() =>
                        setAdjustment({
                          ...adjustment,
                          size: Math.max(0, adjustment.size - 1),
                        })
                      }
                      className="relative inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-l-md"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      type="number"
                      id="pool-size"
                      className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none border border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-center"
                      value={adjustment.size}
                      onChange={(e) =>
                        setAdjustment({
                          ...adjustment,
                          size: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setAdjustment({ ...adjustment, size: adjustment.size + 1 })
                      }
                      className="relative inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-r-md"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={handleAdjust}
                    disabled={adjustMutation.isPending}
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {adjustMutation.isPending
                      ? 'Adjusting...'
                      : 'Adjust Pool Size'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Pool History */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Pool History
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Recent pool management events.
              </p>
            </div>
            <div className="border-t border-gray-200">
              {history && history.length > 0 ? (
                <ul className="divide-y divide-gray-200">
                  {history.slice(0, 10).map((event, index) => (
                    <li
                      key={index}
                      className="px-4 py-4 sm:px-6 hover:bg-gray-50"
                    >
                      <div className="flex items-center">
                        <TrendingUp className="h-5 w-5 text-gray-400 mr-3" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {event.event}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(event.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-4 py-5 sm:p-6 text-center text-gray-500">
                  No recent pool events.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

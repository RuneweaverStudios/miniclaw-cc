import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { serversApi, poolApi, billingApi } from '@/lib/api';
import {
  Server,
  Activity,
  DollarSign,
  TrendingUp,
  Plus,
  Settings,
} from 'lucide-react';

export function Dashboard() {
  const { data: serversData } = useQuery({
    queryKey: ['servers'],
    queryFn: serversApi.list,
  });

  const { data: poolStats } = useQuery({
    queryKey: ['pool-stats'],
    queryFn: poolApi.getStats,
  });

  const { data: usage } = useQuery({
    queryKey: ['billing-usage'],
    queryFn: () => billingApi.getUsage('current'),
  });

  // Handle different response formats
  const servers = Array.isArray(serversData) ? serversData : (serversData as any)?.data || [];

  const stats = [
    {
      name: 'Active Servers',
      value: servers.filter((s: { status?: string }) => s.status === 'running').length,
      icon: Server,
      color: 'bg-blue-500',
      link: '/servers',
    },
    {
      name: 'Pool Availability',
      value: `${poolStats?.availableServers || 0} ready`,
      icon: Activity,
      color: 'bg-green-500',
      link: '/admin/pool',
    },
    {
      name: 'This Month',
      value: `$${(usage?.totalCost || 0).toFixed(2)}`,
      icon: DollarSign,
      color: 'bg-yellow-500',
      link: '/settings/billing',
    },
    {
      name: 'Total Compute Hours',
      value: (usage?.computeHours || 0).toFixed(1),
      icon: TrendingUp,
      color: 'bg-purple-500',
      link: '/settings/billing',
    },
  ];

  const recentServers = servers.slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Miniclaw</h1>
          <div className="flex items-center space-x-4">
            <Link
              to="/servers/new"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Server
            </Link>
            <Link
              to="/settings/profile"
              className="text-gray-500 hover:text-gray-700"
            >
              <Settings className="h-6 w-6" />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {stats.map((stat) => (
            <Link
              key={stat.name}
              to={stat.link}
              className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <stat.icon
                      className={`h-6 w-6 ${stat.color} text-white rounded-full p-1`}
                    />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        {stat.name}
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stat.value}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Recent Servers */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Recent Servers
            </h3>
            <Link
              to="/servers"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              View all
            </Link>
          </div>
          <div className="border-t border-gray-200">
            {recentServers.length === 0 ? (
              <div className="px-4 py-5 sm:p-6 text-center text-gray-500">
                <Server className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p>No servers yet. Create your first server to get started.</p>
                <Link
                  to="/servers/new"
                  className="inline-flex items-center mt-4 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Server
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {recentServers.map((server: { id: string; name?: string; status?: string; instanceType?: string; region?: string; createdAt?: string }) => (
                  <li key={server.id}>
                    <Link
                      to={`/servers/${server.id}`}
                      className="block hover:bg-gray-50"
                    >
                      <div className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <Server className="h-5 w-5 text-gray-400 mr-3" />
                            <p className="text-sm font-medium text-indigo-600 truncate">
                              {server.name}
                            </p>
                          </div>
                          <div className="ml-2 flex-shrink-0 flex">
                            <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              {server.status}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 sm:flex sm:justify-between">
                          <div className="sm:flex">
                            <p className="flex items-center text-sm text-gray-500 mr-6">
                              {server.instanceType}
                            </p>
                            <p className="flex items-center text-sm text-gray-500">
                              {server.region}
                            </p>
                          </div>
                          <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                            <p>
                              Created{' '}
                              {server.createdAt ? new Date(server.createdAt).toLocaleDateString() : '—'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

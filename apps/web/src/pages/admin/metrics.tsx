import { Link } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Server, DollarSign, Clock } from 'lucide-react';

export function Metrics() {
  // Mock metrics data - in production this would come from the API
  const metrics = {
    overview: {
      totalRevenue: 45230.50,
      monthlyRevenue: 12450.00,
      totalUsers: 156,
      activeUsers: 89,
      totalServers: 234,
      runningServers: 156,
      averageUptime: 99.8,
    },
    serverUsage: [
      { type: 't3.medium', count: 120, utilization: 78 },
      { type: 't3.large', count: 65, utilization: 82 },
      { type: 'm5.large', count: 38, utilization: 91 },
      { type: 'm5.xlarge', count: 11, utilization: 88 },
    ],
    regionalDistribution: [
      { region: 'us-east-1', servers: 98, percentage: 42 },
      { region: 'us-west-2', servers: 67, percentage: 29 },
      { region: 'eu-west-1', servers: 45, percentage: 19 },
      { region: 'ap-southeast-1', servers: 24, percentage: 10 },
    ],
  };

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
            <h1 className="text-2xl font-bold text-gray-900">System Metrics</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Stats */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <DollarSign className="h-6 w-6 text-green-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Monthly Revenue
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      ${metrics.overview.monthlyRevenue.toFixed(2)}
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
                  <Server className="h-6 w-6 text-blue-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Active Users
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {metrics.overview.activeUsers}
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
                  <TrendingUp className="h-6 w-6 text-purple-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Running Servers
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {metrics.overview.runningServers}
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
                  <Clock className="h-6 w-6 text-yellow-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Avg Uptime
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {metrics.overview.averageUptime}%
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Server Usage by Type */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Server Usage by Type
              </h3>
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
              <div className="space-y-4">
                {metrics.serverUsage.map((stat) => (
                  <div key={stat.type}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">
                        {stat.type}
                      </span>
                      <span className="text-sm text-gray-500">
                        {stat.count} servers
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full"
                        style={{ width: `${stat.utilization}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-gray-500">
                        Utilization: {stat.utilization}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Regional Distribution */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Regional Distribution
              </h3>
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
              <div className="space-y-4">
                {metrics.regionalDistribution.map((region) => (
                  <div key={region.region}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">
                        {region.region}
                      </span>
                      <span className="text-sm text-gray-500">
                        {region.servers} servers ({region.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{ width: `${region.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Additional Metrics */}
        <div className="mt-6 bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Performance Metrics
            </h3>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Avg Response Time
                </dt>
                <dd className="mt-1 text-2xl font-semibold text-gray-900">
                  124ms
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Error Rate
                </dt>
                <dd className="mt-1 text-2xl font-semibold text-gray-900">
                  0.02%
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Requests/sec
                </dt>
                <dd className="mt-1 text-2xl font-semibold text-gray-900">
                  1,245
                </dd>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

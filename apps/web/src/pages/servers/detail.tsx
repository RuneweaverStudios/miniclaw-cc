import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { serversApi } from '@/lib/api';
import {
  ArrowLeft,
  Play,
  Stop,
  RotateCcw,
  Trash2,
  Activity,
  HardDrive,
  Cpu,
  Clock,
} from 'lucide-react';

export function ServerDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: server, isLoading } = useQuery({
    queryKey: ['server', id],
    queryFn: () => serversApi.get(id!),
    enabled: !!id,
  });

  const { data: metrics } = useQuery({
    queryKey: ['server-metrics', id],
    queryFn: () => serversApi.getMetrics(id!),
    enabled: !!id && server?.status === 'running',
  });

  const handleAction = async (action: 'start' | 'stop' | 'restart' | 'terminate') => {
    if (!id) return;
    try {
      switch (action) {
        case 'start':
          await serversApi.start(id);
          break;
        case 'stop':
          await serversApi.stop(id);
          break;
        case 'restart':
          await serversApi.restart(id);
          break;
        case 'terminate':
          if (confirm('Are you sure you want to terminate this server?')) {
            await serversApi.terminate(id);
          }
          break;
      }
      window.location.reload();
    } catch (error) {
      console.error('Action failed:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-100 text-green-800';
      case 'stopped':
        return 'bg-gray-100 text-gray-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!server) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Server not found</h2>
          <Link
            to="/servers"
            className="text-indigo-600 hover:text-indigo-700"
          >
            Back to servers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                to="/servers"
                className="text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {server.name}
                </h1>
                <p className="text-sm text-gray-500">{server.id}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span
                className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${getStatusColor(
                  server.status
                )}`}
              >
                {server.status}
              </span>
              {server.status === 'stopped' && (
                <button
                  onClick={() => handleAction('start')}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start
                </button>
              )}
              {server.status === 'running' && (
                <>
                  <button
                    onClick={() => handleAction('stop')}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700"
                  >
                    <Stop className="h-4 w-4 mr-2" />
                    Stop
                  </button>
                  <button
                    onClick={() => handleAction('restart')}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Restart
                  </button>
                </>
              )}
              <button
                onClick={() => handleAction('terminate')}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Terminate
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Server Details */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Server Information
                </h3>
              </div>
              <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
                <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Instance Type
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {server.instanceType}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Region
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {server.region}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Stack ID
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {server.stackId}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Created
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {new Date(server.createdAt).toLocaleString()}
                    </dd>
                  </div>
                  {server.publicIp && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">
                        Public IP
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {server.publicIp}
                      </dd>
                    </div>
                  )}
                  {server.privateIp && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">
                        Private IP
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {server.privateIp}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>

            {/* Metrics */}
            {server.status === 'running' && metrics && (
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Metrics
                  </h3>
                </div>
                <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                    <div>
                      <div className="flex items-center">
                        <Cpu className="h-5 w-5 text-gray-400 mr-2" />
                        <dt className="text-sm font-medium text-gray-500">
                          CPU Usage
                        </dt>
                      </div>
                      <dd className="mt-2 text-2xl font-semibold text-gray-900">
                        {metrics.cpu[metrics.cpu.length - 1]?.value.toFixed(1) ||
                          '0'}
                        %
                      </dd>
                    </div>
                    <div>
                      <div className="flex items-center">
                        <HardDrive className="h-5 w-5 text-gray-400 mr-2" />
                        <dt className="text-sm font-medium text-gray-500">
                          Memory Usage
                        </dt>
                      </div>
                      <dd className="mt-2 text-2xl font-semibold text-gray-900">
                        {metrics.memory[metrics.memory.length - 1]?.value.toFixed(
                          1
                        ) || '0'}
                        %
                      </dd>
                    </div>
                    <div>
                      <div className="flex items-center">
                        <Activity className="h-5 w-5 text-gray-400 mr-2" />
                        <dt className="text-sm font-medium text-gray-500">
                          Network I/O
                        </dt>
                      </div>
                      <dd className="mt-2 text-2xl font-semibold text-gray-900">
                        {metrics.network[metrics.network.length - 1]?.value.toFixed(
                          1
                        ) || '0'}
                        MB/s
                      </dd>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Activity */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Recent Activity
                </h3>
              </div>
              <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
                <ul className="divide-y divide-gray-200">
                  <li className="py-4">
                    <div className="flex items-center">
                      <Clock className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Server {server.status}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(server.updatedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </li>
                  <li className="py-4">
                    <div className="flex items-center">
                      <Clock className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Server created
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(server.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

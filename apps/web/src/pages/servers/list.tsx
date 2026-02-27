import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { serversApi } from '@/lib/api';
import { Plus, Server, Play, Square, RotateCcw, Trash2 } from 'lucide-react';

export function ServerList() {
  const { data: servers, isLoading } = useQuery({
    queryKey: ['servers'],
    queryFn: serversApi.list,
  });

  const handleAction = async (
    id: string,
    action: 'start' | 'stop' | 'restart' | 'terminate'
  ) => {
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
      // Refetch servers
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Link to="/dashboard" className="text-gray-500 hover:text-gray-700">
              ← Back
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Servers</h1>
          </div>
          <Link
            to="/servers/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Server
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {servers && servers.length > 0 ? (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Server
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Region
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {servers.map((server) => (
                  <tr key={server.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/servers/${server.id}`}
                        className="flex items-center"
                      >
                        <Server className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-indigo-600">
                            {server.name}
                          </div>
                          {server.publicIp && (
                            <div className="text-sm text-gray-500">
                              {server.publicIp}
                            </div>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                          server.status
                        )}`}
                      >
                        {server.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {server.instanceType}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {server.region}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(server.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        {server.status === 'stopped' && (
                          <button
                            onClick={() => handleAction(server.id, 'start')}
                            className="text-green-600 hover:text-green-900"
                            title="Start"
                          >
                            <Play className="h-4 w-4" />
                          </button>
                        )}
                        {server.status === 'running' && (
                          <>
                            <button
                              onClick={() => handleAction(server.id, 'stop')}
                              className="text-yellow-600 hover:text-yellow-900"
                              title="Stop"
                            >
                              <Square className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleAction(server.id, 'restart')}
                              className="text-blue-600 hover:text-blue-900"
                              title="Restart"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleAction(server.id, 'terminate')}
                          className="text-red-600 hover:text-red-900"
                          title="Terminate"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Server className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No servers yet
            </h3>
            <p className="text-gray-500 mb-4">
              Get started by creating your first server.
            </p>
            <Link
              to="/servers/new"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Server
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

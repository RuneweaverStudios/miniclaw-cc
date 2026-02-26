import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { poolApi } from '@/lib/api';

export function usePoolStats() {
  return useQuery({
    queryKey: ['pool-stats'],
    queryFn: poolApi.getStats,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function usePoolHistory() {
  return useQuery({
    queryKey: ['pool-history'],
    queryFn: poolApi.getHistory,
    refetchInterval: 60000, // Refetch every minute
  });
}

export function useAdjustPoolSize() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { region: string; instanceType: string; size: number }) =>
      poolApi.adjustSize(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pool-stats'] });
      queryClient.invalidateQueries({ queryKey: ['pool-history'] });
    },
  });
}

export function usePoolAvailability() {
  const { data: stats } = usePoolStats();

  return {
    totalServers: stats?.totalServers || 0,
    availableServers: stats?.availableServers || 0,
    runningServers: stats?.runningServers || 0,
    pendingServers: stats?.pendingServers || 0,
    errorServers: stats?.errorServers || 0,
    hasAvailableCapacity:
      (stats?.availableServers || 0) > 0,
    utilizationRate:
      stats && stats.totalServers > 0
        ? ((stats.runningServers / stats.totalServers) * 100).toFixed(1)
        : '0',
  };
}

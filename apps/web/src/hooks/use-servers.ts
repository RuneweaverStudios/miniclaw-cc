import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { serversApi, type Server } from '@/lib/api';

export function useServers() {
  return useQuery({
    queryKey: ['servers'],
    queryFn: serversApi.list,
  });
}

export function useServer(id: string) {
  return useQuery({
    queryKey: ['server', id],
    queryFn: () => serversApi.get(id),
    enabled: !!id,
  });
}

export function useServerActions(id: string) {
  const queryClient = useQueryClient();

  const startMutation = useMutation({
    mutationFn: () => serversApi.start(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['server', id] });
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });

  const stopMutation = useMutation({
    mutationFn: () => serversApi.stop(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['server', id] });
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });

  const restartMutation = useMutation({
    mutationFn: () => serversApi.restart(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['server', id] });
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });

  const terminateMutation = useMutation({
    mutationFn: () => serversApi.terminate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });

  return {
    start: startMutation.mutate,
    stop: stopMutation.mutate,
    restart: restartMutation.mutate,
    terminate: terminateMutation.mutate,
    isLoading:
      startMutation.isPending ||
      stopMutation.isPending ||
      restartMutation.isPending ||
      terminateMutation.isPending,
  };
}

export function useServerMetrics(id: string, enabled = true) {
  return useQuery({
    queryKey: ['server-metrics', id],
    queryFn: () => serversApi.getMetrics(id),
    enabled: !!id && enabled,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useCreateServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: serversApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });
}

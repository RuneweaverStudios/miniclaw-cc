import { useEffect, useRef, useCallback } from 'react';

type WebSocketMessageHandler = (data: unknown) => void;
type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseWebSocketOptions {
  onMessage?: WebSocketMessageHandler;
  onStatusChange?: (status: WebSocketStatus) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface UseWebSocketReturn {
  sendMessage: (data: unknown) => void;
  connect: () => void;
  disconnect: () => void;
  status: WebSocketStatus;
  isConnected: boolean;
}

export function useWebSocket(
  url: string,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const {
    onMessage,
    onStatusChange,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const statusRef = useRef<WebSocketStatus>('disconnected');
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setStatus = useCallback(
    (newStatus: WebSocketStatus) => {
      if (statusRef.current !== newStatus) {
        statusRef.current = newStatus;
        onStatusChange?.(newStatus);
      }
    },
    [onStatusChange]
  );

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setStatus('connecting');

    try {
      const token = localStorage.getItem('auth_token');
      const wsUrl = token ? `${url}?token=${token}` : url;

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setStatus('connected');
        reconnectAttemptsRef.current = 0;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage?.(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
          onMessage?.(event.data);
        }
      };

      wsRef.current.onclose = (event) => {
        setStatus('disconnected');

        // Attempt to reconnect if not closed intentionally
        if (!event.wasClean && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setStatus('error');
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setStatus('error');
    }
  }, [url, onMessage, reconnectInterval, maxReconnectAttempts, setStatus]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus('disconnected');
    reconnectAttemptsRef.current = 0;
  }, [setStatus]);

  const sendMessage = useCallback(
    (data: unknown) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify(data));
        } catch (error) {
          console.error('Failed to send WebSocket message:', error);
        }
      } else {
        console.warn('WebSocket is not connected. Cannot send message.');
      }
    },
    []
  );

  // Auto-connect on mount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    sendMessage,
    connect,
    disconnect,
    status: statusRef.current,
    isConnected: statusRef.current === 'connected',
  };
}

// Hook for server status updates via WebSocket
export function useServerUpdates(serverId: string, onUpdate?: (data: unknown) => void) {
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:4000';
  const url = `${wsUrl}/servers/${serverId}`;

  const handleStatusUpdate = useCallback(
    (data: unknown) => {
      onUpdate?.(data);
    },
    [onUpdate]
  );

  return useWebSocket(url, {
    onMessage: handleStatusUpdate,
  });
}

// Hook for pool status updates via WebSocket
export function usePoolUpdates(onUpdate?: (data: unknown) => void) {
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:4000';
  const url = `${wsUrl}/pool`;

  const handlePoolUpdate = useCallback(
    (data: unknown) => {
      onUpdate?.(data);
    },
    [onUpdate]
  );

  return useWebSocket(url, {
    onMessage: handlePoolUpdate,
  });
}

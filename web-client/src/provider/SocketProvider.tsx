import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
});

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within SocketProvider');
    }
    return context;
};

interface SocketProviderProps {
    children: ReactNode;
}

export const SocketProvider = ({ children }: SocketProviderProps) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // Get token from localStorage
        const token = localStorage.getItem('accessToken');

        if (!token) {
            console.log('[Socket] No token found, skipping connection');
            return;
        }

        // Create socket connection
        const newSocket = io('http://localhost:8080', {
            auth: {
                token,
            },
            autoConnect: true,
        });

        // Connection handlers
        newSocket.on('connect', () => {
            console.log('[Socket] Connected:', newSocket.id);
            setIsConnected(true);
        });

        newSocket.on('disconnect', (reason) => {
            console.log('[Socket] Disconnected:', reason);
            setIsConnected(false);
        });

        newSocket.on('connect_error', (error) => {
            console.error('[Socket] Connection error:', error.message);
            setIsConnected(false);
        });

        setSocket(newSocket);

        // Cleanup on unmount
        return () => {
            console.log('[Socket] Cleaning up connection');
            newSocket.close();
        };
    }, []); // Re-run if token changes

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
};

export default SocketProvider;
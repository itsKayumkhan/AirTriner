import { io, Socket } from 'socket.io-client';
import { getSession } from './auth';
import { supabase } from './supabase';

let socket: Socket | null = null;

export function getSocket(): Socket {
    if (!socket) {
        const session = getSession();
        const apiUrL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        
        // Extract just the origin to avoid "Invalid namespace" errors caused by paths like /api/v1
        let socketUrl = apiUrL;
        try {
            socketUrl = new URL(apiUrL).origin;
        } catch (e) {
            // Fallback if URL parsing fails
        }
        
        socket = io(socketUrl, {
            auth: async (cb) => {
                const { data } = await supabase.auth.getSession();
                const supToken = data.session?.access_token;
                const fallbackToken = session?.id;
                console.log('Socket connecting with token:', supToken ? 'SUPABASE_JWT' : 'FALLBACK_UUID', supToken || fallbackToken);
                cb({
                    token: supToken || fallbackToken
                });
            },
            autoConnect: false
        });

        socket.on('connect', () => {
            console.log('Connected to WebSocket server');
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from WebSocket server');
        });

        socket.on('connect_error', (err: Error) => {
            console.error('WebSocket connection error:', err.message);
        });
    }

    return socket;
}

export function connectSocket() {
    const s = getSocket();
    if (!s.connected) {
        s.connect();
    }
}

export function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import config from '../config';
import { logger } from '../common/logger';
import { JWTPayload, UserRole } from '@airtrainr/shared';

export class SocketService {
    private static instance: SocketService;
    private io: SocketIOServer | null = null;

    private constructor() {}

    public static getInstance(): SocketService {
        if (!SocketService.instance) {
            SocketService.instance = new SocketService();
        }
        return SocketService.instance;
    }

    public init(server: HTTPServer): void {
        this.io = new SocketIOServer(server, {
            cors: {
                origin: config.corsOrigins,
                credentials: true,
                methods: ['GET', 'POST'],
            },
        });

        // Middleware for authentication
        this.io.use((socket: Socket, next) => {
            const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
            logger.info(`Incoming socket connection attempt. Token present: ${!!token}`);
            logger.info(`Handshake auth: ${JSON.stringify(socket.handshake.auth)}`);
            
            if (!token) {
                return next(new Error('Authentication error: Token missing'));
            }

            const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;

            try {
                let decoded: JWTPayload;
                try {
                    decoded = jwt.verify(cleanToken, config.jwtAccessSecret) as JWTPayload;
                } catch (e) {
                    // Fallback for Supabase JWT tokens used by frontend
                    const supPayload = jwt.decode(cleanToken) as any;
                    if (supPayload && supPayload.sub) {
                        decoded = {
                            userId: supPayload.sub,
                            email: supPayload.email || '',
                            role: supPayload.user_role === 'trainer' ? UserRole.TRAINER : UserRole.ATHLETE,
                            subAccountAccess: [],
                            iat: supPayload.iat || Math.floor(Date.now() / 1000),
                            exp: supPayload.exp || Math.floor(Date.now() / 1000) + 3600
                        };
                        logger.info(`Fallback decoded Supabase token for user: ${decoded.userId}`);
                    } else {
                        logger.warn(`Fallback token decoding failed. supPayload: ${JSON.stringify(supPayload)}`);
                        throw new Error('Authentication error: Invalid token');
                    }
                }
                
                (socket as any).user = decoded;
                next();
            } catch (err: any) {
                logger.error(`Socket authentication failed: ${err.message}`);
                // Ensure we call next with the Error so the client knows it failed
                next(new Error(`Authentication error: ${err.message || 'Invalid token'}`));
            }
        });

        this.io.on('connection', (socket: Socket) => {
            const user = (socket as any).user as JWTPayload;
            logger.info(`Socket connected: ${socket.id} (User: ${user.userId})`);

            // Join personal room for private notifications
            socket.join(`user:${user.userId}`);

            socket.on('join_booking', (bookingId: string) => {
                // TODO: Verify user is part of this booking
                socket.join(`booking:${bookingId}`);
                logger.info(`User ${user.userId} joined room booking:${bookingId}`);
            });

            socket.on('leave_booking', (bookingId: string) => {
                socket.leave(`booking:${bookingId}`);
                logger.info(`User ${user.userId} left room booking:${bookingId}`);
            });

            socket.on('disconnect', () => {
                logger.info(`Socket disconnected: ${socket.id}`);
            });
        });
    }

    public emitToUser(userId: string, event: string, data: any): void {
        if (!this.io) return;
        this.io.to(`user:${userId}`).emit(event, data);
    }

    public emitToBooking(bookingId: string, event: string, data: any): void {
        if (!this.io) return;
        this.io.to(`booking:${bookingId}`).emit(event, data);
    }

    public getIO(): SocketIOServer | null {
        return this.io;
    }
}

const initSocketService = (server: HTTPServer) => SocketService.getInstance().init(server);
export const socketService = SocketService.getInstance();
export default initSocketService;

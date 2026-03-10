import { Request, Response } from 'express';
import { messageService } from './message.service';
import { ApiResponse, JWTPayload } from '@airtrainr/shared';
import { asyncHandler } from '../../common/middleware';

export class MessageController {
    /**
     * Send a new message
     */
    sendMessage = asyncHandler(async (req: Request, res: Response) => {
        const { bookingId, content } = req.body;
        const user = (req as any).user as JWTPayload;

        const message = await messageService.sendMessage(bookingId, user.userId, content);

        const response: ApiResponse<any> = {
            success: true,
            data: message,
        };
        res.status(201).json(response);
    });

    /**
     * Get chat history for a booking
     */
    getBookingMessages = asyncHandler(async (req: Request, res: Response) => {
        const { bookingId } = req.params;
        const user = (req as any).user as JWTPayload;

        const messages = await messageService.getBookingMessages(bookingId, user.userId);

        const response: ApiResponse<any[]> = {
            success: true,
            data: messages,
        };
        res.json(response);
    });

    /**
     * Mark messages in a booking as read
     */
    markAsRead = asyncHandler(async (req: Request, res: Response) => {
        const { bookingId } = req.params;
        const user = (req as any).user as JWTPayload;

        await messageService.markAsRead(bookingId, user.userId);

        const response: ApiResponse<null> = {
            success: true,
            data: null,
        };
        res.json(response);
    });
}

export const messageController = new MessageController();

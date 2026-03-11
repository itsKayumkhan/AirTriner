import { Router } from 'express';
import { messageController } from './message.controller';
import { authenticate } from '../../common/middleware';

const router: Router = Router();

// All message routes require authentication
router.use(authenticate);

router.post('/', messageController.sendMessage);
router.get('/booking/:bookingId', messageController.getBookingMessages);
router.patch('/booking/:bookingId/read', messageController.markAsRead);

export default router;

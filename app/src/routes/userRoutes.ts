import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as userController from '../controllers/userController';

const router = Router();

router.get('/me', authenticate, userController.getMe);
router.put('/me/role', authenticate, userController.updateMyRole);
router.put('/me/profile', authenticate, userController.updateMyProfile);
router.get('/:id', authenticate, userController.getById);

export default router;

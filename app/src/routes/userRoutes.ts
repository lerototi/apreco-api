import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as userController from '../controllers/userController';
import * as farmPropertyController from '../controllers/farmPropertyController';

const router = Router();

router.get('/me',                                  authenticate, userController.getMe);
router.get('/me/profile',                          authenticate, userController.getMyProfile);
router.post('/me/roles',                           authenticate, userController.addMyRole);
router.put('/me/profile',                          authenticate, userController.updateMyProfile);

// ─── Propriedades rurais ──────────────────────────────────────────────────────
router.get('/me/properties',                       authenticate, farmPropertyController.getMyProperties);
router.post('/me/properties',                      authenticate, farmPropertyController.createMyProperty);
router.put('/me/properties/:propertyId',           authenticate, farmPropertyController.updateMyProperty);
router.delete('/me/properties/:propertyId',        authenticate, farmPropertyController.deleteMyProperty);

router.get('/:id',                                 authenticate, userController.getById);

export default router;

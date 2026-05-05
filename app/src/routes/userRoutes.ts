import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as userController from '../controllers/userController';
import * as farmPropertyController from '../controllers/farmPropertyController';
import * as establishmentController from '../controllers/establishmentController';

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

// ─── Estabelecimento — vinculação de produtores ───────────────────────────────
router.get('/me/establishment/producers',                          authenticate, establishmentController.getLinkedProducers);
router.post('/me/establishment/producers/:producerUid',            authenticate, establishmentController.linkProducerToEstablishment);
router.delete('/me/establishment/producers/:producerUid',          authenticate, establishmentController.unlinkProducerFromEstablishment);

router.get('/:id',                                 authenticate, userController.getById);

export default router;

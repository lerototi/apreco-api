import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as userController from '../controllers/userController';
import * as farmPropertyController from '../controllers/farmPropertyController';
import * as establishmentController from '../controllers/establishmentController';
import * as producerProductController from '../controllers/producerProductController';
import * as producerInputController from '../controllers/producerInputController';

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

// ─── Produtos do produtor ─────────────────────────────────────────────────────
router.get('/me/products',                  authenticate, producerProductController.getMyProducts);
router.post('/me/products',                 authenticate, producerProductController.createMyProduct);
router.put('/me/products/:productId',       authenticate, producerProductController.updateMyProduct);
router.delete('/me/products/:productId',    authenticate, producerProductController.deleteMyProduct);

// ─── Insumos do produtor ──────────────────────────────────────────────────────
router.get('/me/inputs',                    authenticate, producerInputController.getMyInputs);
router.post('/me/inputs',                   authenticate, producerInputController.createMyInput);
router.put('/me/inputs/:inputId',           authenticate, producerInputController.updateMyInput);
router.delete('/me/inputs/:inputId',        authenticate, producerInputController.deleteMyInput);

router.get('/:id',                                 authenticate, userController.getById);

export default router;

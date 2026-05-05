import { Router } from 'express';
import * as marketplaceController from '../controllers/marketplaceController';

const router = Router();

// Rotas públicas — sem autenticação
router.get('/products',  marketplaceController.getProducts);
router.get('/producers', marketplaceController.getProducers);

export default router;

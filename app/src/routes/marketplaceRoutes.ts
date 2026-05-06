import { Router } from 'express';
import * as marketplaceController from '../controllers/marketplaceController';
import * as demandController from '../controllers/demandController';

const router = Router();

// Rotas públicas — sem autenticação
router.get('/products',  marketplaceController.getProducts);
router.get('/producers', marketplaceController.getProducers);

// ─── Demandas abertas (visíveis a produtores) ──────────────────────────────
router.get('/demands',            demandController.getOpenDemands);
router.get('/demands/:demandId',  demandController.getOpenDemand);

export default router;

/**
 * establishmentRoutes — rotas privadas do perfil establishment.
 *
 * Prefixo: /establishment  (montado em server.ts)
 * Auth:    todas as rotas exigem token Firebase válido (middleware authenticate)
 *
 * Demandas:
 *   GET    /establishment/demands                → lista demandas do estabelecimento logado
 *   GET    /establishment/demands/:demandId      → detalhe de uma demanda própria
 *   POST   /establishment/demands                → cria nova demanda
 *   PUT    /establishment/demands/:demandId      → edita demanda (só status 'open')
 *   DELETE /establishment/demands/:demandId      → cancela demanda
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as demandController from '../controllers/demandController';

const router = Router();

// ─── Demandas ─────────────────────────────────────────────────────────────────
router.get('/demands',             authenticate, demandController.getMyDemands);
router.get('/demands/:demandId',   authenticate, demandController.getMyDemand);
router.post('/demands',            authenticate, demandController.createMyDemand);
router.put('/demands/:demandId',   authenticate, demandController.updateMyDemand);
router.delete('/demands/:demandId',authenticate, demandController.cancelMyDemand);

export default router;

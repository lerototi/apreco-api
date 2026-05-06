/**
 * establishmentRoutes — rotas privadas do perfil establishment.
 *
 * Prefixo: /establishment  (montado em server.ts)
 * Auth:    todas as rotas exigem token Firebase válido (middleware authenticate)
 *
 * Demandas:
 *   GET    /establishment/demands                                    → lista demandas
 *   GET    /establishment/demands/:demandId                          → detalhe de demanda
 *   POST   /establishment/demands                                    → cria demanda
 *   PUT    /establishment/demands/:demandId                          → edita demanda (só 'open')
 *   DELETE /establishment/demands/:demandId                          → cancela demanda
 *
 * Ofertas (visão do estabelecimento):
 *   GET    /establishment/demands/:demandId/offers                   → lista ofertas da demanda
 *   GET    /establishment/demands/:demandId/offers/:offerId          → detalhe de oferta
 *   POST   /establishment/demands/:demandId/offers/:offerId/accept   → aceita negociação
 *   POST   /establishment/demands/:demandId/offers/:offerId/reject   → recusa oferta
 *   POST   /establishment/demands/:demandId/offers/:offerId/confirm  → confirma negócio fechado
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as demandController from '../controllers/demandController';
import * as offerController from '../controllers/offerController';

const router = Router();

// ─── Demandas ─────────────────────────────────────────────────────────────────
router.get('/demands',              authenticate, demandController.getMyDemands);
router.get('/demands/:demandId',    authenticate, demandController.getMyDemand);
router.post('/demands',             authenticate, demandController.createMyDemand);
router.put('/demands/:demandId',    authenticate, demandController.updateMyDemand);
router.delete('/demands/:demandId', authenticate, demandController.cancelMyDemand);

// ─── Ofertas (visão do estabelecimento) ───────────────────────────────────────
router.get('/demands/:demandId/offers',                     authenticate, offerController.getOffersForDemand);
router.get('/demands/:demandId/offers/:offerId',            authenticate, offerController.getOfferDetail);
router.post('/demands/:demandId/offers/:offerId/accept',    authenticate, offerController.acceptOffer);
router.post('/demands/:demandId/offers/:offerId/reject',    authenticate, offerController.rejectOffer);
router.post('/demands/:demandId/offers/:offerId/confirm',   authenticate, offerController.confirmOffer);

export default router;

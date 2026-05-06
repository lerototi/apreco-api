/**
 * marketplaceRoutes — rotas públicas e de produtores.
 *
 * Prefixo: /marketplace  (montado em server.ts)
 *
 * Rotas públicas (sem autenticação):
 *   GET  /marketplace/products               → lista produtos do marketplace
 *   GET  /marketplace/producers              → lista produtores
 *   GET  /marketplace/demands                → lista demandas abertas
 *   GET  /marketplace/demands/:demandId      → detalhe de demanda aberta
 *
 * Rotas do produtor (autenticado):
 *   GET    /marketplace/my-offers                                    → lista próprias ofertas
 *   POST   /marketplace/demands/:demandId/offers                     → envia oferta
 *   DELETE /marketplace/demands/:demandId/offers/:offerId            → cancela própria oferta
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as marketplaceController from '../controllers/marketplaceController';
import * as demandController from '../controllers/demandController';
import * as offerController from '../controllers/offerController';

const router = Router();

// ─── Público ──────────────────────────────────────────────────────────────────
router.get('/products',           marketplaceController.getProducts);
router.get('/producers',          marketplaceController.getProducers);
router.get('/demands',            demandController.getOpenDemands);
router.get('/demands/:demandId',  demandController.getOpenDemand);

// ─── Produtor (autenticado) ───────────────────────────────────────────────────
router.get('/my-offers',                                          authenticate, offerController.getMyOffers);
router.post('/demands/:demandId/offers',                          authenticate, offerController.submitOffer);
router.delete('/demands/:demandId/offers/:offerId',               authenticate, offerController.cancelOffer);

export default router;

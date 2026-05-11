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
 *   GET    /marketplace/my-offers                         → lista próprias ofertas
 *   POST   /marketplace/demands/:demandId/offers          → envia oferta
 *   DELETE /marketplace/offers/:offerId                   → cancela própria oferta
 *
 * Chat (mensagens de negociação — produtor):
 *   GET    /marketplace/chat-threads                      → lista threads ativas
 *   GET    /marketplace/chat-threads/unread-count         → total não lidas
 *   GET    /marketplace/offers/:offerId/messages          → lista msgs da oferta
 *   POST   /marketplace/offers/:offerId/messages          → envia msg
 *   POST   /marketplace/offers/:offerId/messages/read     → marca lidas
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as marketplaceController from '../controllers/marketplaceController';
import * as demandController from '../controllers/demandController';
import * as offerController from '../controllers/offerController';
import * as offerMessageController from '../controllers/offerMessageController';

const router = Router();

// ─── Público ──────────────────────────────────────────────────────────────────
router.get('/products',           marketplaceController.getProducts);
router.get('/producers',          marketplaceController.getProducers);
router.get('/demands',            demandController.getOpenDemands);
router.get('/demands/:demandId',  demandController.getOpenDemand);

// ─── Produtor (autenticado) ───────────────────────────────────────────────────
router.get('/my-offers',                                authenticate, offerController.getMyOffers);
router.post('/demands/:demandId/offers',                authenticate, offerController.submitOffer);
router.delete('/offers/:offerId',                       authenticate, offerController.cancelOffer);

// ─── Chat ─────────────────────────────────────────────────────────────────────
router.get('/chat-threads',                             authenticate, offerMessageController.producerGetChatThreads);
router.get('/chat-threads/unread-count',                authenticate, offerMessageController.producerUnreadCount);
router.get('/offers/:offerId/messages',                 authenticate, offerMessageController.producerGetMessages);
router.post('/offers/:offerId/messages',                authenticate, offerMessageController.producerSendMessage);
router.post('/offers/:offerId/messages/read',           authenticate, offerMessageController.producerMarkRead);

export default router;

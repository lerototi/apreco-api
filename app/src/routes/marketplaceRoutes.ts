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
 * Negociação (produtor responde contraproposta do estab.):
 *   POST   /marketplace/offers/:offerId/accept-negotiation  → aceita termos (negotiating → accepted)
 *   POST   /marketplace/offers/:offerId/reject-negotiation  → recusa termos (negotiating → rejected)
 *   POST   /marketplace/offers/:offerId/resubmit            → reenvia oferta rejeitada (rejected → pending)
 *
 * Chat (mensagens de negociação — produtor):
 *   GET    /marketplace/chat-threads                      → lista threads ativas
 *   GET    /marketplace/chat-threads/unread-count         → total não lidas
 *   GET    /marketplace/offers/:offerId/messages          → lista msgs da oferta
 *   POST   /marketplace/offers/:offerId/messages          → envia msg
 *   POST   /marketplace/offers/:offerId/messages/read     → marca lidas
 *
 * Entregas (produtor):
 *   GET  /marketplace/deliveries                          → lista próprias entregas
 *   GET  /marketplace/deliveries/by-offer/:offerId        → entrega de uma oferta específica
 *   GET  /marketplace/deliveries/:deliveryId              → detalhe
 *   POST /marketplace/deliveries/:deliveryId/ship         → marca como enviado
 *   POST /marketplace/deliveries/:deliveryId/cancel       → cancela entrega pendente
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as marketplaceController from '../controllers/marketplaceController';
import * as demandController from '../controllers/demandController';
import * as offerController from '../controllers/offerController';
import * as offerMessageController from '../controllers/offerMessageController';
import * as deliveryController from '../controllers/deliveryController';
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

// ─── Negociação (produtor) ────────────────────────────────────────────────────
router.post('/offers/:offerId/accept-negotiation',  authenticate, offerController.producerAcceptNegotiation);
router.post('/offers/:offerId/reject-negotiation',  authenticate, offerController.producerRejectNegotiation);
router.post('/offers/:offerId/resubmit',            authenticate, offerController.producerResubmitOffer);

// ─── Chat ─────────────────────────────────────────────────────────────────────
router.get('/chat-threads',                             authenticate, offerMessageController.producerGetChatThreads);
router.get('/chat-threads/unread-count',                authenticate, offerMessageController.producerUnreadCount);
router.get('/offers/:offerId/messages',                 authenticate, offerMessageController.producerGetMessages);
router.post('/offers/:offerId/messages',                authenticate, offerMessageController.producerSendMessage);
router.post('/offers/:offerId/messages/read',           authenticate, offerMessageController.producerMarkRead);

// ─── Entregas (produtor) ──────────────────────────────────────────────────────
router.get('/deliveries',                                   authenticate, deliveryController.producerGetDeliveries);
router.get('/deliveries/by-offer/:offerId',                 authenticate, deliveryController.producerGetDeliveryByOffer);
router.get('/deliveries/:deliveryId',                       authenticate, deliveryController.producerGetDelivery);
router.post('/deliveries/:deliveryId/schedule',             authenticate, deliveryController.producerScheduleDelivery);
router.post('/deliveries/:deliveryId/ship',                 authenticate, deliveryController.producerShipDelivery);
router.post('/deliveries/:deliveryId/cancel',               authenticate, deliveryController.producerCancelDelivery);

export default router;

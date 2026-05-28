/**
 * establishmentRoutes — rotas privadas do perfil establishment.
 *
 * Prefixo: /establishment  (montado em server.ts)
 * Auth:    todas as rotas exigem token Firebase válido (middleware authenticate)
 *
 * Demandas:
 *   GET    /establishment/demands                         → lista demandas
 *   GET    /establishment/demands/:demandId               → detalhe de demanda
 *   POST   /establishment/demands                         → cria demanda
 *   PUT    /establishment/demands/:demandId               → edita demanda (só 'open')
 *   DELETE /establishment/demands/:demandId               → cancela demanda
 *
 * Ofertas (visão do estabelecimento):
 *   GET    /establishment/pending-offers                  → todas ofertas pending/negotiating cross-demands
 *   GET    /establishment/demands/:demandId/offers        → lista ofertas da demanda
 *   GET    /establishment/offers/:offerId                 → detalhe de oferta
 *   POST   /establishment/offers/:offerId/accept          → aceita diretamente (pending/negotiating → accepted)
 *   POST   /establishment/offers/:offerId/negotiate       → propõe novos termos (→ negotiating)
 *   POST   /establishment/offers/:offerId/reject          → recusa oferta
 *
 * Propostas de negociação: REMOVIDAS — negociação agora acontece dentro da própria oferta
 *
 * Chat (mensagens de negociação):
 *   GET    /establishment/chat-threads                    → lista threads ativas
 *   GET    /establishment/chat-threads/unread-count       → total não lidas
 *   GET    /establishment/offers/:offerId/messages        → lista msgs da oferta
 *   POST   /establishment/offers/:offerId/messages        → envia msg
 *   POST   /establishment/offers/:offerId/messages/read   → marca lidas
 *
 * Entregas (estabelecimento):
 *   GET  /establishment/deliveries                        → lista entregas do estabelecimento
 *   GET  /establishment/deliveries/by-offer/:offerId      → entrega de uma oferta específica
 *   GET  /establishment/deliveries/:deliveryId            → detalhe
 *   POST /establishment/deliveries/:deliveryId/confirm    → confirma recebimento
 *   POST /establishment/deliveries/:deliveryId/dispute    → abre disputa
 *   POST /establishment/deliveries/:deliveryId/cancel     → cancela entrega em disputa
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as demandController from '../controllers/demandController';
import * as offerController from '../controllers/offerController';
import * as offerMessageController from '../controllers/offerMessageController';
import * as deliveryController from '../controllers/deliveryController';

const router = Router();

// ─── Demandas ─────────────────────────────────────────────────────────────────
router.get('/demands',              authenticate, demandController.getMyDemands);
router.get('/demands/:demandId',    authenticate, demandController.getMyDemand);
router.post('/demands',             authenticate, demandController.createMyDemand);
router.put('/demands/:demandId',    authenticate, demandController.updateMyDemand);
router.delete('/demands/:demandId', authenticate, demandController.cancelMyDemand);

// ─── Ofertas (visão do estabelecimento) ───────────────────────────────────────
router.get('/pending-offers',                         authenticate, offerController.getPendingOffers);
router.get('/all-offers',                             authenticate, offerController.getAllOffers);
router.get('/demands/:demandId/offers',               authenticate, offerController.getOffersForDemand);
router.get('/offers/:offerId',                        authenticate, offerController.getOfferDetail);
router.post('/offers/:offerId/accept',                authenticate, offerController.acceptOffer);
router.post('/offers/:offerId/negotiate',             authenticate, offerController.negotiateOfferHandler);
router.post('/offers/:offerId/reject',                authenticate, offerController.rejectOffer);

// ─── Chat ─────────────────────────────────────────────────────────────────────
router.get('/chat-threads',                           authenticate, offerMessageController.estGetChatThreads);
router.get('/chat-threads/unread-count',              authenticate, offerMessageController.estUnreadCount);
router.get('/offers/:offerId/messages',               authenticate, offerMessageController.estGetMessages);
router.post('/offers/:offerId/messages',              authenticate, offerMessageController.estSendMessage);
router.post('/offers/:offerId/messages/read',         authenticate, offerMessageController.estMarkRead);

// ─── Entregas (estabelecimento) ───────────────────────────────────────────────
router.get('/deliveries',                                       authenticate, deliveryController.estGetDeliveries);
router.get('/deliveries/by-offer/:offerId',                     authenticate, deliveryController.estGetDeliveryByOffer);
router.get('/deliveries/:deliveryId',                           authenticate, deliveryController.estGetDelivery);
router.post('/deliveries/:deliveryId/confirm',                  authenticate, deliveryController.estConfirmDelivery);
router.post('/deliveries/:deliveryId/dispute',                  authenticate, deliveryController.estDisputeDelivery);
router.post('/deliveries/:deliveryId/cancel',                   authenticate, deliveryController.estCancelDelivery);

export default router;

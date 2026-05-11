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
 *   GET    /establishment/pending-offers                  → todas ofertas pending/accepted cross-demands
 *   GET    /establishment/demands/:demandId/offers        → lista ofertas da demanda
 *   GET    /establishment/offers/:offerId                 → detalhe de oferta
 *   POST   /establishment/offers/:offerId/accept          → aceita negociação
 *   POST   /establishment/offers/:offerId/reject          → recusa oferta
 *   POST   /establishment/offers/:offerId/confirm         → confirma negócio fechado
 *
 * Chat (mensagens de negociação):
 *   GET    /establishment/chat-threads                    → lista threads ativas
 *   GET    /establishment/chat-threads/unread-count       → total não lidas
 *   GET    /establishment/offers/:offerId/messages        → lista msgs da oferta
 *   POST   /establishment/offers/:offerId/messages        → envia msg
 *   POST   /establishment/offers/:offerId/messages/read   → marca lidas
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as demandController from '../controllers/demandController';
import * as offerController from '../controllers/offerController';
import * as offerMessageController from '../controllers/offerMessageController';

const router = Router();

// ─── Demandas ─────────────────────────────────────────────────────────────────
router.get('/demands',              authenticate, demandController.getMyDemands);
router.get('/demands/:demandId',    authenticate, demandController.getMyDemand);
router.post('/demands',             authenticate, demandController.createMyDemand);
router.put('/demands/:demandId',    authenticate, demandController.updateMyDemand);
router.delete('/demands/:demandId', authenticate, demandController.cancelMyDemand);

// ─── Ofertas (visão do estabelecimento) ───────────────────────────────────────
router.get('/pending-offers',                         authenticate, offerController.getPendingOffers);
router.get('/demands/:demandId/offers',               authenticate, offerController.getOffersForDemand);
router.get('/offers/:offerId',                        authenticate, offerController.getOfferDetail);
router.post('/offers/:offerId/accept',                authenticate, offerController.acceptOffer);
router.post('/offers/:offerId/reject',                authenticate, offerController.rejectOffer);
router.post('/offers/:offerId/confirm',               authenticate, offerController.confirmOffer);

// ─── Chat ─────────────────────────────────────────────────────────────────────
router.get('/chat-threads',                           authenticate, offerMessageController.estGetChatThreads);
router.get('/chat-threads/unread-count',              authenticate, offerMessageController.estUnreadCount);
router.get('/offers/:offerId/messages',               authenticate, offerMessageController.estGetMessages);
router.post('/offers/:offerId/messages',              authenticate, offerMessageController.estSendMessage);
router.post('/offers/:offerId/messages/read',         authenticate, offerMessageController.estMarkRead);

export default router;

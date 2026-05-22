/**
 * Factories para criar dados de teste tipados.
 * Use estas funções para montar fixtures sem repetir boilerplate nos testes.
 */

import type {
  UserDocument,
  ConsumerProfile,
  RuralProducerProfile,
  EstablishmentProfile,
  CreateUserInput,
  UserRole,
} from '../../models/user';
import type { DecodedIdToken } from 'firebase-admin/auth';

// ─── Timestamp fake ───────────────────────────────────────────────────────────

export const fakeTimestamp = new Date('2024-01-01T00:00:00.000Z') as unknown as
  import('firebase-admin').firestore.Timestamp;

// ─── User factories ───────────────────────────────────────────────────────────

/** Cria um UserDocument completo com valores padrão sobrescrevíveis */
export function makeUser(overrides: Partial<UserDocument> = {}): UserDocument {
  const base: UserDocument = {
    id: 'uid-test-001',
    email: 'teste@apreco.com',
    displayName: 'Usuário Teste',
    photoURL: null,
    role: 'consumer',
    roles: ['consumer'],
    createdAt: fakeTimestamp,
    updatedAt: fakeTimestamp,
    active: true,
    ...overrides,
  };
  // Keep roles in sync with role if caller only sets role
  if (overrides.role && !overrides.roles) {
    base.roles = [overrides.role];
  }
  return base;
}

/** Cria um usuário com role 'ruralProducer' */
export function makeRuralProducer(overrides: Partial<UserDocument> = {}): UserDocument {
  return makeUser({
    id: 'uid-ruralproducer-001',
    email: 'produtor@apreco.com',
    displayName: 'João Produtor',
    role: 'ruralProducer',
    roles: ['ruralProducer'],
    ...overrides,
  });
}

/** Cria um usuário com roles ['consumer', 'ruralProducer'] */
export function makeMultiRoleUser(overrides: Partial<UserDocument> = {}): UserDocument {
  return makeUser({
    id: 'uid-multi-001',
    email: 'multi@apreco.com',
    displayName: 'Usuário Multi',
    role: 'ruralProducer',
    roles: ['consumer', 'ruralProducer'],
    ...overrides,
  });
}

/** Cria um usuário com role 'establishment' */
export function makeEstablishment(overrides: Partial<UserDocument> = {}): UserDocument {
  return makeUser({
    id: 'uid-establishment-001',
    email: 'mercado@apreco.com',
    displayName: 'Mercado Central',
    role: 'establishment',
    roles: ['establishment'],
    ...overrides,
  });
}

// ─── Profile factories ────────────────────────────────────────────────────────

export function makeConsumerProfile(overrides: Partial<ConsumerProfile> = {}): ConsumerProfile {
  return {
    name: 'Maria Consumer',
    city: 'São Paulo',
    neighborhood: null,
    interests: [],
    ...overrides,
  };
}

export function makeRuralProducerProfile(overrides: Partial<RuralProducerProfile> = {}): RuralProducerProfile {
  return {
    avatarUrl: null,
    userName: 'joao_horta',
    displayName: 'João da Horta',
    bio: 'Produtor orgânico há 10 anos.',
    phone: '(11) 99999-0000',
    isWhatsApp: true,
    organic: true,
    certifications: ['IBD'],
    deliveryOptions: ['retirada', 'entrega'],
    instagram: 'joao_horta',
    website: null,
    ...overrides,
  };
}

export function makeEstablishmentProfile(overrides: Partial<EstablishmentProfile> = {}): EstablishmentProfile {
  return {
    avatarUrl: null,
    userName: null,
    phone: '(11) 3000-0000',
    isWhatsApp: false,
    businessName: 'Mercado Central',
    cnpj: '12.345.678/0001-90',
    address: 'Rua das Feiras, 100',
    city: 'São Paulo',
    state: 'SP',
    bio: null,
    businessType: 'mercado',
    instagram: null,
    website: null,
    recurringNeeds: ['verduras', 'frutas'],
    linkedProducerIds: [],
    ...overrides,
  };
}

// ─── Auth factories ───────────────────────────────────────────────────────────

/** Cria um DecodedIdToken fake (retorno do auth.verifyIdToken) */
export function makeDecodedToken(overrides: Partial<DecodedIdToken> = {}): DecodedIdToken {
  return {
    uid: 'uid-test-001',
    email: 'teste@apreco.com',
    name: 'Usuário Teste',
    picture: null,
    iss: 'https://securetoken.google.com/apreco-test',
    aud: 'apreco-test',
    auth_time: 1704067200,
    sub: 'uid-test-001',
    iat: 1704067200,
    exp: 1704070800,
    firebase: {
      identities: { email: ['teste@apreco.com'] },
      sign_in_provider: 'google.com',
    },
    ...overrides,
  } as DecodedIdToken;
}

/** Cria um CreateUserInput para testes de criação */
export function makeCreateUserInput(overrides: Partial<CreateUserInput> = {}): CreateUserInput {
  return {
    uid: 'uid-test-001',
    email: 'teste@apreco.com',
    displayName: 'Usuário Teste',
    photoURL: null,
    ...overrides,
  };
}

// ─── Request/Response mocks ───────────────────────────────────────────────────

/** Cria um mock de Request do Express com user autenticado */
export function makeRequest(overrides: Record<string, unknown> = {}) {
  return {
    headers: { authorization: 'Bearer fake-token' },
    user: makeDecodedToken(),
    body: {},
    params: {},
    query: {},
    ...overrides,
  } as unknown as import('express').Request;
}

/** Cria um mock de Response do Express com métodos espiados */
export function makeResponse() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return res as unknown as import('express').Response;
}

import type { FarmProperty, FarmPropertyInput } from '../../models/farmProperty';
import type { EstablishmentDemand } from '../../models/establishmentDemand';
import type { DemandOffer } from '../../models/demandOffer';
import type { ChatMessage, MessageAuthorRole } from '../../models/offerMessage';

export function makeFarmPropertyInput(overrides: Partial<FarmPropertyInput> = {}): FarmPropertyInput {
  return {
    name: 'Sítio Boa Esperança',
    description: 'Produção de hortaliças orgânicas',
    location: { latitude: -22.9035, longitude: -47.0628 },
    photos: [],
    ...overrides,
  };
}

export function makeFarmProperty(overrides: Partial<FarmProperty> = {}): FarmProperty {
  return {
    id: 'prop-001',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...makeFarmPropertyInput(),
    ...overrides,
  };
}

// ─── Demand factories ─────────────────────────────────────────────────────────

export function makeEstablishmentDemand(overrides: Partial<EstablishmentDemand> = {}): EstablishmentDemand {
  return {
    id: 'demand-001',
    establishmentUid: 'uid-test-001',
    establishmentName: 'Mercado Central',
    productName: 'Tomate Cereja Orgânico',
    category: 'hortalicas',
    quantityNeeded: 20,
    unit: 'kg',
    maxPricePerUnit: 12.00,
    isRecurring: false,
    deadline: '2099-12-31',
    deliveryLocation: {
      displayName: 'Mercado Central',
      city: 'São Paulo',
      state: 'SP',
      coords: null,
      placeId: null,
    },
    notes: null,
    status: 'open',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ─── Offer factories ──────────────────────────────────────────────────────────

export function makeDemandOffer(overrides: Partial<DemandOffer> = {}): DemandOffer {
  return {
    id: 'offer-001',
    producerUid: 'uid-producer-001',
    producerName: 'Sítio Raízes Vivas',
    demandId: 'demand-001',
    establishmentUid: 'uid-test-001',
    quantity: 20,
    pricePerUnit: 10.00,
    message: 'Oferta de teste',
    status: 'pending',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  } as DemandOffer;
}

// ─── ChatMessage factory ──────────────────────────────────────────────────────

export function makeChatMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-001',
    senderUid: 'uid-producer-001',
    authorRole: 'ruralProducer' as MessageAuthorRole,
    senderName: 'Sítio Raízes Vivas',
    offerId: 'offer-001',
    demandId: 'demand-001',
    productId: null,
    text: 'Mensagem de teste',
    readBy: [],
    participantUids: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

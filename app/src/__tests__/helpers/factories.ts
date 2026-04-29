/**
 * Factories para criar dados de teste tipados.
 * Use estas funções para montar fixtures sem repetir boilerplate nos testes.
 */

import type {
  UserDocument,
  ConsumidorProfile,
  AgricultorProfile,
  EstabelecimentoProfile,
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
  return {
    id: 'uid-test-001',
    email: 'teste@apreco.com',
    displayName: 'Usuário Teste',
    photoURL: null,
    role: 'consumidor',
    createdAt: fakeTimestamp,
    updatedAt: fakeTimestamp,
    active: true,
    profile: makeConsumidorProfile(),
    ...overrides,
  };
}

/** Cria um usuário com role 'agricultor' */
export function makeAgricultor(overrides: Partial<UserDocument> = {}): UserDocument {
  return makeUser({
    id: 'uid-agricultor-001',
    email: 'agricultor@apreco.com',
    displayName: 'João Agricultor',
    role: 'agricultor',
    profile: makeAgricultorProfile(),
    ...overrides,
  });
}

/** Cria um usuário com role 'estabelecimento' */
export function makeEstabelecimento(overrides: Partial<UserDocument> = {}): UserDocument {
  return makeUser({
    id: 'uid-estabelecimento-001',
    email: 'mercado@apreco.com',
    displayName: 'Mercado Central',
    role: 'estabelecimento',
    profile: makeEstabelecimentoProfile(),
    ...overrides,
  });
}

// ─── Profile factories ────────────────────────────────────────────────────────

export function makeConsumidorProfile(overrides: Partial<ConsumidorProfile> = {}): ConsumidorProfile {
  return {
    phone: null,
    address: null,
    city: 'São Paulo',
    state: 'SP',
    bio: null,
    interests: [],
    ...overrides,
  };
}

export function makeAgricultorProfile(overrides: Partial<AgricultorProfile> = {}): AgricultorProfile {
  return {
    phone: '(11) 99999-0000',
    farmName: 'Sítio Boa Esperança',
    address: 'Estrada Rural, km 5',
    city: 'Campinas',
    state: 'SP',
    bio: 'Produtor orgânico há 10 anos.',
    products: ['tomate', 'alface'],
    deliveryOptions: ['retirada', 'entrega'],
    organic: true,
    certifications: ['IBD'],
    ...overrides,
  };
}

export function makeEstabelecimentoProfile(overrides: Partial<EstabelecimentoProfile> = {}): EstabelecimentoProfile {
  return {
    phone: '(11) 3000-0000',
    businessName: 'Mercado Central',
    cnpj: '12.345.678/0001-90',
    address: 'Rua das Feiras, 100',
    city: 'São Paulo',
    state: 'SP',
    bio: null,
    businessType: 'mercado',
    recurringNeeds: ['verduras', 'frutas'],
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

/** Cria roles de teste para cada tipo */
export const TEST_ROLES: UserRole[] = ['consumidor', 'agricultor', 'estabelecimento'];

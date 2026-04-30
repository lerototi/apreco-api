/**
 * Testes unitários — src/models/user.ts
 *
 * Cobre:
 *  - isValidRole
 *  - sanitizeProfile (consumidor, ruralProducer, estabelecimento)
 *  - toPublicProfile
 *  - createUser
 *  - findById
 *  - updateRole
 *  - updateProfile
 */

import { firestoreStore } from '../__mocks__/firebase-module';

import {
  isValidRole,
  sanitizeProfile,
  toPublicProfile,
  createUser,
  findById,
  updateRole,
  updateProfile,
  VALID_ROLES,
} from '../../models/user';

import {
  makeUser,
  makeRuralProducer,
  makeEstabelecimento,
  makeConsumidorProfile,
  makeRuralProducerProfile,
  makeEstabelecimentoProfile,
} from '../helpers/factories';

// Limpa o store fake antes de cada teste
beforeEach(() => {
  firestoreStore.clear();
});

// ─── isValidRole ──────────────────────────────────────────────────────────────

describe('isValidRole', () => {
  it('retorna true para roles válidos', () => {
    VALID_ROLES.forEach((role) => {
      expect(isValidRole(role)).toBe(true);
    });
  });

  it('retorna false para role inválido', () => {
    expect(isValidRole('admin')).toBe(false);
    expect(isValidRole('')).toBe(false);
    expect(isValidRole('agricultor')).toBe(false);
    expect(isValidRole('CONSUMIDOR')).toBe(false);
  });
});

// ─── sanitizeProfile ──────────────────────────────────────────────────────────

describe('sanitizeProfile', () => {
  describe('consumidor', () => {
    it('mapeia campos corretamente', () => {
      const input = makeConsumidorProfile({ city: 'Curitiba', interests: ['orgânicos'] }) as unknown as Record<string, unknown>;
      const result = sanitizeProfile('consumidor', input);
      expect(result).toEqual(expect.objectContaining({ city: 'Curitiba', interests: ['orgânicos'] }));
    });

    it('garante array vazio para interests ausente', () => {
      const result = sanitizeProfile('consumidor', {});
      expect((result as { interests: string[] }).interests).toEqual([]);
    });

    it('converte campos nulos corretamente', () => {
      const result = sanitizeProfile('consumidor', { name: null });
      expect((result as { name: string | null }).name).toBeNull();
    });

    it('ignora campos não pertencentes ao schema', () => {
      const result = sanitizeProfile('consumidor', { phone: '11999', campoExtra: 'x' });
      expect(result).not.toHaveProperty('phone');
      expect(result).not.toHaveProperty('campoExtra');
    });
  });

  describe('ruralProducer', () => {
    it('mapeia campos corretamente', () => {
      const input = makeRuralProducerProfile({ nickname: 'ze_horta', productionSites: ['feira'] }) as unknown as Record<string, unknown>;
      const result = sanitizeProfile('ruralProducer', input);
      expect(result).toEqual(expect.objectContaining({ nickname: 'ze_horta', productionSites: ['feira'] }));
    });

    it('organic padrão é false quando ausente', () => {
      const result = sanitizeProfile('ruralProducer', {});
      expect((result as { organic: boolean }).organic).toBe(false);
    });

    it('isWhatsApp padrão é false quando ausente', () => {
      const result = sanitizeProfile('ruralProducer', {});
      expect((result as { isWhatsApp: boolean }).isWhatsApp).toBe(false);
    });

    it('productionSites padrão é array vazio quando ausente', () => {
      const result = sanitizeProfile('ruralProducer', {});
      expect((result as { productionSites: string[] }).productionSites).toEqual([]);
    });

    it('ignora campos não pertencentes ao schema', () => {
      const result = sanitizeProfile('ruralProducer', { campoDesconhecido: 'valor', locaisProducao: ['x'] });
      expect(result).not.toHaveProperty('campoDesconhecido');
      expect(result).not.toHaveProperty('locaisProducao');
    });
  });

  describe('estabelecimento', () => {
    it('mapeia campos corretamente', () => {
      const input = makeEstabelecimentoProfile({ businessType: 'restaurante' }) as unknown as Record<string, unknown>;
      const result = sanitizeProfile('estabelecimento', input);
      expect(result).toEqual(expect.objectContaining({ businessType: 'restaurante' }));
    });

    it('garante array vazio para recurringNeeds ausente', () => {
      const result = sanitizeProfile('estabelecimento', {});
      expect((result as { recurringNeeds: string[] }).recurringNeeds).toEqual([]);
    });
  });
});

// ─── toPublicProfile ──────────────────────────────────────────────────────────

describe('toPublicProfile', () => {
  it('retorna apenas os campos públicos', () => {
    const user = makeUser({ email: 'segredo@apreco.com' });
    const pub = toPublicProfile(user);

    expect(pub).not.toHaveProperty('email');
    expect(pub).not.toHaveProperty('createdAt');
    expect(pub).not.toHaveProperty('updatedAt');
    expect(pub).toHaveProperty('id');
    expect(pub).toHaveProperty('displayName');
    expect(pub).toHaveProperty('photoURL');
    expect(pub).toHaveProperty('role');
    expect(pub).toHaveProperty('profile');
    expect(pub).toHaveProperty('active');
  });

  it('preserva o id corretamente', () => {
    const user = makeUser({ id: 'uid-xyz' });
    expect(toPublicProfile(user).id).toBe('uid-xyz');
  });
});

// ─── createUser ───────────────────────────────────────────────────────────────

describe('createUser', () => {
  it('cria documento no Firestore com role padrão consumidor', async () => {
    const data = await createUser({ uid: 'uid-novo', email: 'novo@apreco.com', displayName: 'Novo' });

    expect(data.role).toBe('consumidor');
    expect(data.active).toBe(true);
    expect(data.email).toBe('novo@apreco.com');
    expect(firestoreStore.has('users/uid-novo')).toBe(true);
  });

  it('aceita email e displayName nulos', async () => {
    const data = await createUser({ uid: 'uid-null' });
    expect(data.email).toBeNull();
    expect(data.displayName).toBeNull();
  });
});

// ─── findById ─────────────────────────────────────────────────────────────────

describe('findById', () => {
  it('retorna null para uid inexistente', async () => {
    const result = await findById('uid-nao-existe');
    expect(result).toBeNull();
  });

  it('retorna o usuário quando existe', async () => {
    const user = makeUser({ id: 'uid-existe' });
    firestoreStore.set('users/uid-existe', user);

    const result = await findById('uid-existe');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('uid-existe');
    expect(result!.email).toBe(user.email);
  });
});

// ─── updateRole ───────────────────────────────────────────────────────────────

describe('updateRole', () => {
  it('atualiza o role no store', async () => {
    const user = makeUser({ id: 'uid-role' });
    firestoreStore.set('users/uid-role', user);

    const result = await updateRole('uid-role', 'ruralProducer');

    expect(result.role).toBe('ruralProducer');
    expect(firestoreStore.get('users/uid-role')!.role).toBe('ruralProducer');
  });
});

// ─── updateProfile ────────────────────────────────────────────────────────────

describe('updateProfile', () => {
  it('atualiza o profile no store', async () => {
    const user = makeRuralProducer({ id: 'uid-profile' });
    firestoreStore.set('users/uid-profile', user);

    const novoProfile = makeRuralProducerProfile({ nickname: 'novo_nick' });
    const result = await updateProfile('uid-profile', novoProfile);

    expect((result.profile as { nickname: string }).nickname).toBe('novo_nick');
  });

  it('funciona para todos os roles', async () => {
    const users = [
      makeUser({ id: 'uid-c', role: 'consumidor' }),
      makeRuralProducer({ id: 'uid-r' }),
      makeEstabelecimento({ id: 'uid-e' }),
    ];

    for (const u of users) {
      firestoreStore.set(`users/${u.id}`, u);
      const profile = sanitizeProfile(u.role, {});
      await expect(updateProfile(u.id, profile)).resolves.not.toThrow();
    }
  });
});

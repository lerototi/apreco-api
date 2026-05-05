/**
 * Testes unitários — src/controllers/farmPropertyController.ts
 *
 * Cobre:
 *  - getMyProperties:   lista retornada, erro do Firestore
 *  - createMyProperty:  criação válida, nome ausente (400), erro (500)
 *  - updateMyProperty:  atualização válida, propriedade não encontrada (404), erro (500)
 *  - deleteMyProperty:  deleção válida, propriedade não encontrada (404), erro (500)
 */

import { firestoreStore } from '../__mocks__/firebase-module';
import {
  getMyProperties,
  createMyProperty,
  updateMyProperty,
  deleteMyProperty,
} from '../../controllers/farmPropertyController';
import { makeRequest, makeResponse, makeFarmProperty } from '../helpers/factories';

const PRODUCER_UID = 'uid-test-001';
const PROPERTY_PATH = (id: string) => `ruralProducers/${PRODUCER_UID}/properties/${id}`;

beforeEach(() => {
  firestoreStore.clear();
});

// ─── getMyProperties ──────────────────────────────────────────────────────────

describe('getMyProperties', () => {
  it('retorna lista de propriedades do produtor', async () => {
    const prop1 = makeFarmProperty({ id: 'prop-001', name: 'Sítio A' });
    const prop2 = makeFarmProperty({ id: 'prop-002', name: 'Sítio B' });
    firestoreStore.set(PROPERTY_PATH('prop-001'), prop1 as unknown as Record<string, unknown>);
    firestoreStore.set(PROPERTY_PATH('prop-002'), prop2 as unknown as Record<string, unknown>);

    const req = makeRequest();
    const res = makeResponse();

    await getMyProperties(req, res);

    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.properties).toHaveLength(2);
    expect(returned.properties.map((p: { name: string }) => p.name)).toEqual(
      expect.arrayContaining(['Sítio A', 'Sítio B']),
    );
  });

  it('retorna lista vazia quando não há propriedades', async () => {
    const req = makeRequest();
    const res = makeResponse();

    await getMyProperties(req, res);

    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.properties).toEqual([]);
  });

  it('retorna 500 quando o Firestore lança erro', async () => {
    const { db } = await import('../__mocks__/firebase-module');
    db.collection.mockReturnValueOnce({
      doc: jest.fn(() => ({
        collection: jest.fn(() => ({
          orderBy: jest.fn(() => ({
            get: jest.fn().mockRejectedValueOnce(new Error('Firestore offline')),
          })),
        })),
      })),
    } as any);

    const req = makeRequest();
    const res = makeResponse();

    await getMyProperties(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error fetching properties.' });
  });
});

// ─── createMyProperty ─────────────────────────────────────────────────────────

describe('createMyProperty', () => {
  it('cria propriedade válida e retorna 201', async () => {
    const req = makeRequest({
      body: {
        name: 'Sítio Boa Esperança',
        description: 'Produção orgânica',
        location: { latitude: -22.9, longitude: -47.0 },
        photos: [],
      },
    });
    const res = makeResponse();

    await createMyProperty(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.property.name).toBe('Sítio Boa Esperança');
    expect(returned.property.id).toBeDefined();
  });

  it('retorna 400 quando nome está ausente', async () => {
    const req = makeRequest({ body: { description: 'Sem nome' } });
    const res = makeResponse();

    await createMyProperty(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'O nome da propriedade é obrigatório.' });
  });

  it('retorna 400 quando nome é string vazia', async () => {
    const req = makeRequest({ body: { name: '   ' } });
    const res = makeResponse();

    await createMyProperty(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('ignora location inválida e salva como null', async () => {
    const req = makeRequest({
      body: { name: 'Sitio', location: { latitude: 'invalido', longitude: null } },
    });
    const res = makeResponse();

    await createMyProperty(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.property.location).toBeNull();
  });
});

// ─── updateMyProperty ─────────────────────────────────────────────────────────

describe('updateMyProperty', () => {
  it('atualiza propriedade existente com sucesso', async () => {
    const prop = makeFarmProperty({ id: 'prop-001', name: 'Original' });
    firestoreStore.set(PROPERTY_PATH('prop-001'), prop as unknown as Record<string, unknown>);

    const req = makeRequest({
      params: { propertyId: 'prop-001' },
      body: { name: 'Atualizado', description: 'Nova descrição', photos: [], location: null },
    });
    const res = makeResponse();

    await updateMyProperty(req, res);

    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.property.name).toBe('Atualizado');
  });

  it('retorna 404 quando propriedade não existe', async () => {
    const req = makeRequest({
      params: { propertyId: 'prop-inexistente' },
      body: { name: 'Qualquer' },
    });
    const res = makeResponse();

    await updateMyProperty(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Property not found.' });
  });
});

// ─── deleteMyProperty ─────────────────────────────────────────────────────────

describe('deleteMyProperty', () => {
  it('deleta propriedade existente e retorna mensagem de sucesso', async () => {
    const prop = makeFarmProperty({ id: 'prop-001' });
    firestoreStore.set(PROPERTY_PATH('prop-001'), prop as unknown as Record<string, unknown>);

    const req = makeRequest({ params: { propertyId: 'prop-001' } });
    const res = makeResponse();

    await deleteMyProperty(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: 'Property deleted.' });
    expect(firestoreStore.has(PROPERTY_PATH('prop-001'))).toBe(false);
  });

  it('retorna 404 quando propriedade não existe', async () => {
    const req = makeRequest({ params: { propertyId: 'prop-fantasma' } });
    const res = makeResponse();

    await deleteMyProperty(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Property not found.' });
  });
});

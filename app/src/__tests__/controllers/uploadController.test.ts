/**
 * Testes unitários — src/controllers/uploadController.ts
 *
 * Cobre:
 *  - uploadPhoto com arquivo válido → 200 + downloadUrl
 *  - uploadPhoto sem arquivo → 400
 *  - Erro do Storage → 500
 */

import { uploadPhoto } from '../../controllers/uploadController';
import { makeRequest, makeResponse } from '../helpers/factories';
import { mockStorage, firestoreStore } from '../__mocks__/firebase-module';

beforeEach(() => {
    firestoreStore.clear();
    jest.clearAllMocks();
});

describe('uploadPhoto', () => {
    it('retorna 200 e downloadUrl quando recebe um arquivo válido', async () => {
        const fakeFile = {
            buffer: Buffer.from('fake-image-content'),
            originalname: 'foto.jpg',
            mimetype: 'image/jpeg',
        };

        const req = makeRequest({ file: fakeFile });
        const res = makeResponse();

        await uploadPhoto(req, res);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ downloadUrl: expect.stringContaining('firebasestorage.googleapis.com') }),
        );

        const url = (res.json as jest.Mock).mock.calls[0][0].downloadUrl;
        expect(url).toContain('/o/uploads%2F');
        expect(url).toContain('alt=media&token=');
    });

    it('retorna 400 quando nenhum arquivo é enviado', async () => {
        const req = makeRequest({ file: undefined });
        const res = makeResponse();

        await uploadPhoto(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Nenhum arquivo enviado.' });
    });

    it('retorna 500 quando o Storage lança erro', async () => {
        const fakeFile = {
            buffer: Buffer.from('fake'),
            originalname: 'foto.jpg',
            mimetype: 'image/jpeg',
        };

        const originalBucket = mockStorage.bucket as jest.Mock;
        originalBucket.mockReturnValueOnce({
            name: 'apreco-test.appspot.com',
            file: jest.fn(() => { throw new Error('Falha no Storage'); }),
        });

        const req = makeRequest({ file: fakeFile });
        const res = makeResponse();

        await uploadPhoto(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao fazer upload da imagem.' });
    });
});

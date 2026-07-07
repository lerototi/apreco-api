import { Request, Response } from 'express';
import { storage, storageBucket } from '../config/firebase';
import { randomUUID } from 'crypto';
import path from 'path';

const UPLOADS_PREFIX = 'uploads';

export async function uploadPhoto(req: Request, res: Response): Promise<void> {
    const file = req.file;
    if (!file) {
        res.status(400).json({ error: 'Nenhum arquivo enviado.' });
        return;
    }

    const ext = path.extname(file.originalname) || '.jpg';
    const filename = `${Date.now()}_${randomUUID()}${ext}`;
    const blobPath = `${UPLOADS_PREFIX}/${req.user.uid}/${filename}`;

    try {
        const bucket = storage.bucket(storageBucket);
        const blob = bucket.file(blobPath);

        const downloadToken = randomUUID();

        await blob.save(file.buffer, {
            metadata: {
                contentType: file.mimetype,
                metadata: {
                    firebaseStorageDownloadTokens: downloadToken,
                },
            },
        });

        const bucketName = bucket.name;
        const encodedPath = blobPath.split('/').map(encodeURIComponent).join('%2F');
        const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${downloadToken}`;

        res.json({ downloadUrl });
    } catch (e) {
        console.error('[upload] erro:', e);
        res.status(500).json({ error: 'Erro ao fazer upload da imagem.' });
    }
}

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

let _bucket: any = null;

function getBucket() {
  if (_bucket) return _bucket;

  if (!getApps().length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccount) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set');
    }

    initializeApp({
      credential: cert(JSON.parse(serviceAccount)),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  }

  _bucket = getStorage().bucket();
  return _bucket;
}

export async function uploadToFirebase(
  buffer: Buffer,
  filename: string,
  mimetype: string,
): Promise<string> {
  const bucket = getBucket();
  const file = bucket.file(`uploads/${filename}`);
  await file.save(buffer, {
    metadata: { contentType: mimetype },
    public: true,
  });
  return `https://storage.googleapis.com/${bucket.name}/uploads/${filename}`;
}

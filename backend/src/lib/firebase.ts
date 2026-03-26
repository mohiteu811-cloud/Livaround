import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

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

const bucket = getStorage().bucket();

export async function uploadToFirebase(
  buffer: Buffer,
  filename: string,
  mimetype: string,
): Promise<string> {
  const file = bucket.file(`uploads/${filename}`);
  await file.save(buffer, {
    metadata: { contentType: mimetype },
    public: true,
  });
  return `https://storage.googleapis.com/${bucket.name}/uploads/${filename}`;
}

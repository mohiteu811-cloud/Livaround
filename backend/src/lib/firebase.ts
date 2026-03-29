import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

let _bucket: any = null;

function getBucket() {
  if (_bucket) return _bucket;

  if (!getApps().length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccount) {
      console.error('FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set. File uploads will fail.');
      throw new Error('File storage is not configured. Please set FIREBASE_SERVICE_ACCOUNT_JSON.');
    }
    if (!process.env.FIREBASE_STORAGE_BUCKET) {
      console.error('FIREBASE_STORAGE_BUCKET environment variable is not set. File uploads will fail.');
      throw new Error('File storage is not configured. Please set FIREBASE_STORAGE_BUCKET.');
    }

    try {
      initializeApp({
        credential: cert(JSON.parse(serviceAccount)),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      });
    } catch (err: any) {
      console.error('Firebase initialization failed:', err?.message || err);
      throw new Error(`File storage configuration error: ${err?.message || 'Invalid credentials'}`);
    }
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
  try {
    await file.save(buffer, {
      metadata: { contentType: mimetype },
      public: true,
    });
  } catch (err: any) {
    console.error('Firebase upload failed:', { filename, mimetype, bufferSize: buffer.length, error: err?.message || err });
    throw new Error(`Firebase upload failed: ${err?.message || 'Unknown error'}`);
  }
  return `https://storage.googleapis.com/${bucket.name}/uploads/${filename}`;
}

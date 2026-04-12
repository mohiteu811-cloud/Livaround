import { Server as TusServer } from '@tus/server';
import { S3Store } from '@tus/s3-store';

// ── Lazy TUS server ──────────────────────────────────────────────────────────
// The S3Store and TusServer are created on first use, not at module scope.
// If the R2 env vars are missing, the server gracefully returns 503 instead
// of crashing the entire commercial extension loader on startup.

let _tusServer: InstanceType<typeof TusServer> | null = null;
let _initFailed = false;

function getTusServer(): InstanceType<typeof TusServer> | null {
  if (_tusServer) return _tusServer;
  if (_initFailed) return null;

  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    console.warn('TUS upload disabled: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, or R2_BUCKET_NAME not set');
    _initFailed = true;
    return null;
  }

  try {
    const s3Store = new S3Store({
      s3ClientConfig: {
        bucket,
        region: 'auto',
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
      },
    });

    _tusServer = new TusServer({
      path: '/api/walkthroughs/upload',
      datastore: s3Store,
    });

    return _tusServer;
  } catch (err: any) {
    console.error('TUS server initialization failed:', err.message);
    _initFailed = true;
    return null;
  }
}

export { getTusServer };

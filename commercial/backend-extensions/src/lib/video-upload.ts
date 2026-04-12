// ── Lazy TUS server ──────────────────────────────────────────────────────────
// @tus/server and @tus/s3-store are ESM-only packages. ts-node compiles
// static `import` statements into `require()`, which crashes on ESM modules.
// We use dynamic `import()` inside an async init function to avoid this.

let _tusServer: any = null;
let _initFailed = false;
let _initPromise: Promise<any> | null = null;

async function initTusServer(): Promise<any> {
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
    const { S3Store } = await import('@tus/s3-store');
    const { Server: TusServer } = await import('@tus/server');

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

export async function getTusServer(): Promise<any> {
  if (!_initPromise) {
    _initPromise = initTusServer();
  }
  return _initPromise;
}

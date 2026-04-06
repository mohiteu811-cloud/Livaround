import { Server as TusServer } from '@tus/server';
import { S3Store } from '@tus/s3-store';
import { S3Client } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const s3Store = new S3Store({
  s3ClientConfig: {
    bucket: process.env.R2_BUCKET_NAME!,
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  },
});

export const tusServer = new TusServer({
  path: '/api/walkthroughs/upload',
  datastore: s3Store,
});

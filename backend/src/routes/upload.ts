import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, AuthRequest } from '../middleware/auth';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /image\/(jpeg|jpg|png|webp|gif)|video\/(mp4|quicktime|webm|3gpp)/;
    cb(null, allowed.test(file.mimetype));
  },
});

const router = Router();
router.use(authenticate);

router.post('/', upload.single('file'), (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded or unsupported type' });

  const host = process.env.PUBLIC_URL ||
    `${req.protocol}://${req.get('host')}`;
  const url = `${host}/uploads/${req.file.filename}`;
  return res.json({ url, type: req.file.mimetype.startsWith('video/') ? 'video' : 'image' });
});

export default router;

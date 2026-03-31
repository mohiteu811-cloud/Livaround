import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate, AuthRequest } from '../middleware/auth';
import { uploadToFirebase } from '../lib/firebase';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /image\/(jpeg|jpg|png|webp|gif)|video\/(mp4|quicktime|webm|3gpp)|audio\/(aac|mp4|m4a|mpeg|ogg|webm|wav|x-m4a)|application\/(pdf)|text\/(csv|plain)/;
    cb(null, allowed.test(file.mimetype));
  },
});

const router = Router();
router.use(authenticate);

router.post('/', upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded or unsupported type' });

  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const url = await uploadToFirebase(req.file.buffer, filename, req.file.mimetype);

    const type = req.file.mimetype.startsWith('video/') ? 'video'
      : req.file.mimetype.startsWith('audio/') ? 'audio'
      : req.file.mimetype === 'application/pdf' ? 'pdf'
      : req.file.mimetype.startsWith('text/') ? 'document'
      : 'image';
    return res.json({ url, type });
  } catch (err) {
    console.error('Upload failed:', err);
    return res.status(500).json({ error: 'Upload failed' });
  }
});

export default router;

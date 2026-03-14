const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ctrl = require('../controllers/signatureController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Ensure upload dir exists
const uploadDir = './uploads/signatures';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, `sig-${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Hanya file gambar yang diizinkan'));
  },
});

router.use(authenticate);
router.get('/', ctrl.getAll);
router.post('/', requireAdmin, upload.single('image'), ctrl.create);
router.delete('/:id', requireAdmin, ctrl.remove);

module.exports = router;

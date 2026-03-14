const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const ctrl = require('../controllers/companyController');
const { authenticate } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: './uploads/logos',
  filename: (req, file, cb) => {
    cb(null, `logo-${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|svg/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
});

router.use(authenticate);
router.get('/', ctrl.getSettings);
router.put('/', ctrl.updateSettings);
router.post('/logo', upload.single('logo'), ctrl.uploadLogo);

module.exports = router;

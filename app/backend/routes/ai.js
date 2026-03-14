const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { generateDocText } = require('../controllers/aiController');

router.use(authenticate);
router.post('/generate-text', generateDocText);

module.exports = router;

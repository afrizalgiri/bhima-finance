const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/formTokenController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// PUBLIC — validate token
router.get('/validate/:token', ctrl.validate);

// Auth required
router.use(authenticate);
router.get('/', ctrl.getAll);
router.post('/', ctrl.create);
router.delete('/:id', requireAdmin, ctrl.remove);

module.exports = router;

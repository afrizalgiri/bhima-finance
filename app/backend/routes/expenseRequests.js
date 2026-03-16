const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/expenseRequestController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// PUBLIC - no auth needed (for team form submissions)
router.post('/submit', ctrl.create);

// Auth required for all below
router.use(authenticate);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.put('/:id/status', ctrl.updateStatus);
router.post('/:id/pdf', ctrl.generatePdf);
router.delete('/:id', requireAdmin, ctrl.remove);

module.exports = router;

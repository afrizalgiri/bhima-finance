const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/expenseRequestController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// PUBLIC - no auth needed
router.post('/submit', ctrl.create);
router.post('/upload-attachment', ctrl.uploadAttachment);
router.get('/boss-approval/:token', ctrl.getBossApproval);
router.post('/boss-approval/:token/decide', ctrl.bossDecide);

// Auth required for all below
router.use(authenticate);
router.get('/my', ctrl.mySubmissions);
router.post('/my-submit', ctrl.submitAuthenticated);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.put('/:id/status', ctrl.updateStatus);
router.patch('/:id/transfer', ctrl.updateTransferInfo);
router.post('/:id/send-to-boss', ctrl.sendToBoss);
router.post('/:id/pdf', ctrl.generatePdf);
router.delete('/:id', requireAdmin, ctrl.remove);

module.exports = router;

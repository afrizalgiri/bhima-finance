const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/poController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.post('/:id/pdf', ctrl.generatePdf);
router.delete('/:id', requireAdmin, ctrl.remove);

module.exports = router;

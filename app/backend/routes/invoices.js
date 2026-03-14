const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/invoiceController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);
router.get('/:id/pdf', ctrl.generatePdf);

module.exports = router;

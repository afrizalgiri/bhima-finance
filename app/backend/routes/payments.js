const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.getAll);
router.post('/', [
  body('invoiceId').notEmpty(),
  body('amount').isFloat({ min: 0.01 }),
  body('date').isISO8601(),
], ctrl.create);
router.delete('/:id', ctrl.remove);

module.exports = router;

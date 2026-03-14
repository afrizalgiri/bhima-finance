const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/expenseController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.post('/', [
  body('name').notEmpty(),
  body('date').isISO8601(),
  body('category').notEmpty(),
  body('amount').isFloat({ min: 0 }),
], ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);
router.post('/pdf', ctrl.generatePdf);

module.exports = router;

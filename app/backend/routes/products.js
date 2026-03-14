const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/productController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.post('/', [
  body('name').notEmpty(),
  body('price').isFloat({ min: 0 }),
  body('unit').notEmpty(),
], ctrl.create);
router.put('/:id', [
  body('name').notEmpty(),
  body('price').isFloat({ min: 0 }),
], ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;

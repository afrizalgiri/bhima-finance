const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/clientController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.post('/', [
  body('name').notEmpty().withMessage('Name required'),
  body('address').notEmpty().withMessage('Address required'),
  body('email').optional().isEmail().withMessage('Valid email required'),
], ctrl.create);
router.put('/:id', [
  body('name').notEmpty().withMessage('Name required'),
  body('address').notEmpty().withMessage('Address required'),
  body('email').optional().isEmail(),
], ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;

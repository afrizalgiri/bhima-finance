const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/userController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate);

router.get('/', requireAdmin, ctrl.listUsers);
router.post('/', requireAdmin, ctrl.createUser);
router.put('/:id', ctrl.updateUser);              // admin edit siapa saja, staff hanya dirinya
router.put('/:id/reset-password', requireAdmin, ctrl.resetPassword);
router.delete('/:id', requireAdmin, ctrl.deleteUser);

module.exports = router;

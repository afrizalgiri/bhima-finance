const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/payrollController');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;

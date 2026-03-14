const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { getAll } = require('../controllers/activityController');

router.use(authenticate);
router.get('/', getAll);

module.exports = router;

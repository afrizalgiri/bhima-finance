const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reportController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/invoices', ctrl.invoiceReport);
router.get('/payments', ctrl.paymentReport);
router.get('/expenses', ctrl.expenseReport);
router.get('/cashflow', ctrl.cashflowReport);

module.exports = router;

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/lampiranController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// Master lampiran
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.post('/upload', ctrl.uploadFile);          // multipart/form-data
router.post('/generate/excel', ctrl.generateExcel);
router.post('/generate/word', ctrl.generateWord);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);
router.get('/:id/download', ctrl.download);

// Junction: lampiran per dokumen
router.get('/dokumen/:dokumenType/:dokumenId', ctrl.getByDocument);
router.post('/dokumen/attach', ctrl.attachToDocument);
router.delete('/dokumen/:dokumenType/:dokumenId/:lampiranId', ctrl.detachFromDocument);
router.put('/dokumen/reorder', ctrl.reorder);

module.exports = router;

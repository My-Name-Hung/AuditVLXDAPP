const express = require('express');
const router = express.Router();
const auditsController = require('../controllers/auditsController');
const { authenticateToken } = require('../middlewares/auth');

router.get('/', authenticateToken, auditsController.getAllAudits);
router.get('/:id', authenticateToken, auditsController.getAuditById);
router.post('/', authenticateToken, auditsController.createAudit);
router.put('/:id', authenticateToken, auditsController.updateAudit);
router.delete('/:id', authenticateToken, auditsController.deleteAudit);

module.exports = router;


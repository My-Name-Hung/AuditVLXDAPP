const express = require('express');
const router = express.Router();
const storesController = require('../controllers/storesController');
const { authenticateToken } = require('../middlewares/auth');

router.get('/', authenticateToken, storesController.getAllStores);
router.get('/:id', authenticateToken, storesController.getStoreById);
router.post('/', authenticateToken, storesController.createStore);
router.put('/:id', authenticateToken, storesController.updateStore);
router.delete('/:id', authenticateToken, storesController.deleteStore);

module.exports = router;


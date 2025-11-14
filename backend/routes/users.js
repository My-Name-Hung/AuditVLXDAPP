const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const { authenticateToken } = require('../middlewares/auth');

router.get('/', authenticateToken, usersController.getAllUsers);
router.get('/:id', authenticateToken, usersController.getUserById);
router.post('/', authenticateToken, usersController.createUser);
router.put('/:id', authenticateToken, usersController.updateUser);
router.delete('/:id', authenticateToken, usersController.deleteUser);

module.exports = router;


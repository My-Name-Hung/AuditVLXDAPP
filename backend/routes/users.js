const express = require('express');
const router = express.Router();
const multer = require('multer');
const usersController = require('../controllers/usersController');
const { authenticateToken } = require('../middlewares/auth');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/', authenticateToken, usersController.getAllUsers);
router.get('/:id', authenticateToken, usersController.getUserById);
router.post('/', authenticateToken, usersController.createUser);
router.put('/:id', authenticateToken, usersController.updateUser);
router.delete('/:id', authenticateToken, usersController.deleteUser);
router.post('/:id/reset-password', authenticateToken, usersController.resetPassword);
router.post('/avatar', authenticateToken, upload.single('avatar'), usersController.uploadAvatar);

module.exports = router;


const express = require("express");
const router = express.Router();
const storesController = require("../controllers/storesController");
const storeUsersController = require("../controllers/storeUsersController");
const { authenticateToken } = require("../middlewares/auth");

router.get("/", authenticateToken, storesController.getAllStores);
router.get("/:id", authenticateToken, storesController.getStoreById);
router.post("/", authenticateToken, storesController.createStore);
router.put("/:id", authenticateToken, storesController.updateStore);
router.patch(
  "/:id/status",
  authenticateToken,
  storesController.updateStoreStatus
);
router.post(
  "/:id/reset",
  authenticateToken,
  storesController.resetStoreAuditData
);
router.delete("/:id", authenticateToken, storesController.deleteStore);

// StoreUsers routes
router.get(
  "/:storeId/users",
  authenticateToken,
  storeUsersController.getStoreUsers
);
router.put(
  "/:storeId/users",
  authenticateToken,
  storeUsersController.assignUsersToStore
);
router.post(
  "/:storeId/users/:userId",
  authenticateToken,
  storeUsersController.addUserToStore
);
router.delete(
  "/:storeId/users/:userId",
  authenticateToken,
  storeUsersController.removeUserFromStore
);

module.exports = router;

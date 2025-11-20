const StoreUser = require("../models/StoreUser");

/**
 * Get all users assigned to a store
 * GET /api/stores/:storeId/users
 */
const getStoreUsers = async (req, res) => {
  try {
    const { storeId } = req.params;
    const users = await StoreUser.getUsersByStoreId(parseInt(storeId));
    res.json({ data: users });
  } catch (error) {
    console.error("Get store users error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Assign users to a store (replace all existing assignments)
 * PUT /api/stores/:storeId/users
 * Body: { userIds: [1, 2, 3] }
 */
const assignUsersToStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { userIds } = req.body;

    if (!Array.isArray(userIds)) {
      return res.status(400).json({ error: "userIds must be an array" });
    }

    // Validate all user IDs are numbers
    const validUserIds = userIds
      .map((id) => parseInt(id))
      .filter((id) => !isNaN(id) && id > 0);

    if (validUserIds.length === 0 && userIds.length > 0) {
      return res.status(400).json({ error: "All userIds must be valid numbers" });
    }

    const assignments = await StoreUser.assignUsersToStore(
      parseInt(storeId),
      validUserIds
    );

    res.json({
      message: "Users assigned successfully",
      data: assignments,
    });
  } catch (error) {
    console.error("Assign users to store error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Add a single user to a store
 * POST /api/stores/:storeId/users/:userId
 */
const addUserToStore = async (req, res) => {
  try {
    const { storeId, userId } = req.params;
    const assignment = await StoreUser.addUserToStore(
      parseInt(storeId),
      parseInt(userId)
    );

    if (!assignment) {
      return res.status(409).json({
        error: "User is already assigned to this store",
      });
    }

    res.json({
      message: "User added to store successfully",
      data: assignment,
    });
  } catch (error) {
    console.error("Add user to store error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Remove a user from a store
 * DELETE /api/stores/:storeId/users/:userId
 */
const removeUserFromStore = async (req, res) => {
  try {
    const { storeId, userId } = req.params;
    const removed = await StoreUser.removeUserFromStore(
      parseInt(storeId),
      parseInt(userId)
    );

    if (!removed) {
      return res.status(404).json({
        error: "User is not assigned to this store",
      });
    }

    res.json({
      message: "User removed from store successfully",
    });
  } catch (error) {
    console.error("Remove user from store error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  getStoreUsers,
  assignUsersToStore,
  addUserToStore,
  removeUserFromStore,
};


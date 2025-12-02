const express = require("express");
const router = express.Router();
const cementProductsController = require("../controllers/cementProductsController");
const { authenticateToken } = require("../middlewares/auth");

router.get("/", authenticateToken, cementProductsController.getAllCementProducts);
router.get("/:id", authenticateToken, cementProductsController.getCementProductById);
router.post("/", authenticateToken, cementProductsController.createCementProduct);
router.put("/:id", authenticateToken, cementProductsController.updateCementProduct);
router.delete("/:id", authenticateToken, cementProductsController.deleteCementProduct);
router.post("/import", authenticateToken, cementProductsController.importCementProducts);

module.exports = router;


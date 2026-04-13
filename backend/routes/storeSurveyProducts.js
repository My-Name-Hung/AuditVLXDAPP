const express = require("express");
const router = express.Router();
const storeSurveyProductsController = require("../controllers/storeSurveyProductsController");
const { authenticateToken } = require("../middlewares/auth");

router.get("/survey/:surveyId", authenticateToken, storeSurveyProductsController.getProductsBySurveyId);
router.post("/", authenticateToken, storeSurveyProductsController.createProduct);
router.put("/:id", authenticateToken, storeSurveyProductsController.updateProduct);
router.delete("/:id", authenticateToken, storeSurveyProductsController.deleteProduct);

module.exports = router;


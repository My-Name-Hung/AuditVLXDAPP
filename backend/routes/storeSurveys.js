const express = require("express");
const router = express.Router();
const storeSurveysController = require("../controllers/storeSurveysController");
const { authenticateToken } = require("../middlewares/auth");

router.post("/", authenticateToken, storeSurveysController.createStoreSurvey);
router.get("/", authenticateToken, storeSurveysController.getAllStoreSurveys);
router.get("/:id", authenticateToken, storeSurveysController.getStoreSurveyById);
router.get("/audit/:auditId", authenticateToken, storeSurveysController.getStoreSurveyByAuditId);
router.get("/store/:storeId", authenticateToken, storeSurveysController.getStoreSurveysByStoreId);
router.put("/:id", authenticateToken, storeSurveysController.updateStoreSurvey);
router.delete("/:id", authenticateToken, storeSurveysController.deleteStoreSurvey);

module.exports = router;


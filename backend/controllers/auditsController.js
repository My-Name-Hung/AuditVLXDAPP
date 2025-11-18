const Audit = require("../models/Audit");

const getAllAudits = async (req, res) => {
  try {
    const { userId, storeId, result } = req.query;
    const filters = {};

    if (userId) filters.UserId = parseInt(userId);
    if (storeId) filters.StoreId = parseInt(storeId);
    if (result) filters.Result = result;

    const audits = await Audit.findAll(filters);
    res.json(audits);
  } catch (error) {
    console.error("Get all audits error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getAuditById = async (req, res) => {
  try {
    const { id } = req.params;
    const audit = await Audit.findById(id);

    if (!audit) {
      return res.status(404).json({ error: "Audit not found" });
    }

    res.json(audit);
  } catch (error) {
    console.error("Get audit by id error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const createAudit = async (req, res) => {
  try {
    const { userId, storeId, result, notes, auditDate } = req.body;

    if (!userId || !storeId) {
      return res.status(400).json({ error: "UserId and StoreId are required" });
    }

    // If result is provided, validate it
    if (result && !["pass", "fail", "audited"].includes(result.toLowerCase())) {
      return res
        .status(400)
        .json({ error: 'Result must be "pass", "fail" hoặc "audited"' });
    }

    const auditResult = result ? result.toLowerCase() : "audited";

    const audit = await Audit.create({
      UserId: userId,
      StoreId: storeId,
      Result: auditResult,
      Notes: notes,
      AuditDate: auditDate,
    });

    const Store = require("../models/Store");
    await Store.refreshStatusFromLatest(storeId);

    res.status(201).json(audit);
  } catch (error) {
    console.error("Create audit error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const updateAudit = async (req, res) => {
  try {
    const { id } = req.params;
    const { result, failedReason } = req.body;

    const audit = await Audit.findById(id);
    if (!audit) {
      return res.status(404).json({ error: "Audit not found" });
    }

    if (result && !["pass", "fail", "audited"].includes(result.toLowerCase())) {
      return res
        .status(400)
        .json({ error: 'Result must be "pass", "fail" hoặc "audited"' });
    }

    const updatedAudit = await Audit.updateResult(
      id,
      result ? result.toLowerCase() : audit.Result,
      failedReason !== undefined ? failedReason : audit.FailedReason
    );

    const Store = require("../models/Store");
    await Store.refreshStatusFromLatest(audit.StoreId);

    res.json(updatedAudit);
  } catch (error) {
    console.error("Update audit error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const deleteAudit = async (req, res) => {
  try {
    const { id } = req.params;

    const audit = await Audit.findById(id);
    if (!audit) {
      return res.status(404).json({ error: "Audit not found" });
    }

    const { getPool, sql } = require("../config/database");
    const pool = await getPool();
    const request = pool.request();
    request.input("Id", sql.Int, id);

    await request.query("DELETE FROM Audits WHERE Id = @Id");

    const Store = require("../models/Store");
    await Store.refreshStatusFromLatest(audit.StoreId);

    res.json({ message: "Audit deleted successfully" });
  } catch (error) {
    console.error("Delete audit error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  getAllAudits,
  getAuditById,
  createAudit,
  updateAudit,
  deleteAudit,
};

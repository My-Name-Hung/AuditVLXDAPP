const Audit = require('../models/Audit');

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
    console.error('Get all audits error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getAuditById = async (req, res) => {
  try {
    const { id } = req.params;
    const audit = await Audit.findById(id);

    if (!audit) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    res.json(audit);
  } catch (error) {
    console.error('Get audit by id error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createAudit = async (req, res) => {
  try {
    const { userId, storeId, result, notes, auditDate } = req.body;

    if (!userId || !storeId || !result) {
      return res.status(400).json({ error: 'UserId, StoreId, and Result are required' });
    }

    if (!['pass', 'fail'].includes(result.toLowerCase())) {
      return res.status(400).json({ error: 'Result must be "pass" or "fail"' });
    }

    const audit = await Audit.create({
      UserId: userId,
      StoreId: storeId,
      Result: result.toLowerCase(),
      Notes: notes,
      AuditDate: auditDate,
    });

    res.status(201).json(audit);
  } catch (error) {
    console.error('Create audit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateAudit = async (req, res) => {
  try {
    const { id } = req.params;
    const { result, notes } = req.body;

    const audit = await Audit.findById(id);
    if (!audit) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    if (result && !['pass', 'fail'].includes(result.toLowerCase())) {
      return res.status(400).json({ error: 'Result must be "pass" or "fail"' });
    }

    const { getPool, sql } = require('../config/database');
    const pool = await getPool();
    const request = pool.request();

    request.input('Id', sql.Int, id);
    request.input('Result', sql.VarChar(20), result || audit.Result);
    request.input('Notes', sql.NVarChar(1000), notes !== undefined ? notes : audit.Notes);

    const result_query = await request.query(`
      UPDATE Audits 
      SET Result = @Result, 
          Notes = @Notes,
          UpdatedAt = GETDATE()
      OUTPUT INSERTED.*
      WHERE Id = @Id
    `);

    res.json(result_query.recordset[0]);
  } catch (error) {
    console.error('Update audit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteAudit = async (req, res) => {
  try {
    const { id } = req.params;

    const audit = await Audit.findById(id);
    if (!audit) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    const { getPool, sql } = require('../config/database');
    const pool = await getPool();
    const request = pool.request();
    request.input('Id', sql.Int, id);

    await request.query('DELETE FROM Audits WHERE Id = @Id');

    res.json({ message: 'Audit deleted successfully' });
  } catch (error) {
    console.error('Delete audit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getAllAudits,
  getAuditById,
  createAudit,
  updateAudit,
  deleteAudit,
};


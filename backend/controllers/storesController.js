const Store = require('../models/Store');
const { resetStoreAuditById } = require('../utils/auditReset');

const getAllStores = async (req, res) => {
  try {
    const { status, territoryId, userId, rank, storeName, userName, page, pageSize } = req.query;
    const filters = {};
    
    if (status) filters.Status = status;
    if (territoryId) filters.TerritoryId = parseInt(territoryId);
    if (userId) filters.UserId = parseInt(userId);
    if (rank !== undefined && rank !== null && rank !== '') {
      filters.Rank = parseInt(rank);
    }
    if (storeName) filters.storeName = storeName;
    if (userName) filters.userName = userName;

    // Pagination
    const currentPage = parseInt(page) || 1;
    const limit = parseInt(pageSize) || 50;
    const offset = (currentPage - 1) * limit;

    filters.limit = limit;
    filters.offset = offset;

    const [stores, total] = await Promise.all([
      Store.findAll(filters),
      Store.count(filters)
    ]);

    res.json({
      data: stores,
      pagination: {
        page: currentPage,
        pageSize: limit,
        total: total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get all stores error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getStoreById = async (req, res) => {
  try {
    const { id } = req.params;
    const store = await Store.findById(id);

    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }

    // Get store details with related data
    const { getPool, sql } = require('../config/database');
    const pool = await getPool();
    const request = pool.request();
    request.input('StoreId', sql.Int, id);

    // Set timeout to 60 seconds
    request.timeout = 60000;
    
    // Get audits with images for this store
    const auditsResult = await request.query(`
      SELECT 
        a.Id as AuditId,
        a.Result,
        a.Notes,
        a.AuditDate,
        a.CreatedAt as AuditCreatedAt,
        u.Id as UserId,
        u.FullName as UserFullName,
        u.UserCode,
        (
          SELECT 
            i.Id,
            i.ImageUrl,
            i.ReferenceImageUrl,
            i.Latitude,
            i.Longitude,
            i.CapturedAt
          FROM Images i
          WHERE i.AuditId = a.Id
          ORDER BY i.CapturedAt DESC
          FOR JSON PATH
        ) as Images
      FROM Audits a
      INNER JOIN Users u ON a.UserId = u.Id
      WHERE a.StoreId = @StoreId
      ORDER BY a.AuditDate DESC, a.CreatedAt DESC
    `);

    // Parse JSON images for each audit
    const audits = auditsResult.recordset.map(audit => {
      let images = [];
      try {
        images = audit.Images ? JSON.parse(audit.Images) : [];
      } catch (e) {
        images = [];
      }
      return {
        ...audit,
        Images: images
      };
    });

    // Get store with territory and user info
    const storeDetailsResult = await request.query(`
      SELECT 
        s.*,
        t.TerritoryName,
        u.FullName as UserFullName,
        u.UserCode
      FROM Stores s
      LEFT JOIN Territories t ON s.TerritoryId = t.Id
      LEFT JOIN Users u ON s.UserId = u.Id
      WHERE s.Id = @StoreId
    `);

    const storeDetails = storeDetailsResult.recordset[0];

    res.json({
      ...storeDetails,
      audits
    });
  } catch (error) {
    console.error('Get store by id error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createStore = async (req, res) => {
  try {
    const { 
      storeName, 
      address, 
      phone, 
      email, 
      latitude, 
      longitude,
      territoryId,
      userId,
      rank,
      taxCode,
      partnerName,
      openDate,
    } = req.body;

    if (!storeName || !address) {
      return res.status(400).json({ error: 'StoreName and address are required' });
    }

    if (rank && ![1, 2].includes(parseInt(rank))) {
      return res.status(400).json({ error: 'Rank must be 1 or 2' });
    }

    const store = await Store.create({
      StoreName: storeName,
      Address: address,
      Phone: phone,
      Email: email,
      Latitude: latitude,
      Longitude: longitude,
      TerritoryId: territoryId,
      UserId: userId,
      Rank: rank ? parseInt(rank) : null,
      TaxCode: taxCode,
      PartnerName: partnerName,
      OpenDate: openDate || null,
    });

    res.status(201).json(store);
  } catch (error) {
    console.error('Create store error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateStore = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      storeName, 
      address, 
      phone, 
      email, 
      latitude, 
      longitude, 
      status,
      territoryId,
      userId,
      rank,
      taxCode,
      partnerName,
      openDate,
    } = req.body;

    const store = await Store.findById(id);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }

    // Validate status if provided
    if (status && !['not_audited', 'audited', 'passed', 'failed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be: not_audited, audited, passed, or failed' });
    }

    // Validate rank if provided
    if (rank !== undefined && rank !== null && ![1, 2].includes(parseInt(rank))) {
      return res.status(400).json({ error: 'Rank must be 1 or 2' });
    }

    const { getPool, sql } = require('../config/database');
    const pool = await getPool();
    const request = pool.request();

    request.input('Id', sql.Int, id);
    request.input('StoreName', sql.NVarChar(200), storeName !== undefined ? storeName : store.StoreName);
    request.input('Address', sql.NVarChar(500), address !== undefined ? address : store.Address);
    request.input('Phone', sql.VarChar(20), phone !== undefined ? phone : store.Phone);
    request.input('Email', sql.NVarChar(200), email !== undefined ? email : store.Email);
    request.input('Latitude', sql.Decimal(10, 8), latitude !== undefined ? latitude : store.Latitude);
    request.input('Longitude', sql.Decimal(11, 8), longitude !== undefined ? longitude : store.Longitude);
    request.input('Status', sql.VarChar(20), status !== undefined ? status : store.Status);
    request.input('TerritoryId', sql.Int, territoryId !== undefined ? territoryId : store.TerritoryId);
    request.input('UserId', sql.Int, userId !== undefined ? userId : store.UserId);
    request.input('Rank', sql.Int, rank !== undefined ? rank : store.Rank);
    request.input('TaxCode', sql.VarChar(50), taxCode !== undefined ? taxCode : store.TaxCode);
    request.input('PartnerName', sql.NVarChar(200), partnerName !== undefined ? partnerName : store.PartnerName);
    request.input('OpenDate', sql.Date, openDate !== undefined ? openDate : store.OpenDate);

    const result = await request.query(`
      UPDATE Stores 
      SET StoreName = @StoreName, 
          Address = @Address, 
          Phone = @Phone, 
          Email = @Email,
          Latitude = @Latitude,
          Longitude = @Longitude,
          Status = @Status,
          TerritoryId = @TerritoryId,
          UserId = @UserId,
          Rank = @Rank,
          TaxCode = @TaxCode,
          PartnerName = @PartnerName,
          OpenDate = @OpenDate,
          UpdatedAt = GETDATE()
      OUTPUT INSERTED.*
      WHERE Id = @Id
    `);

    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Update store error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateStoreStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, failedReason } = req.body;

    if (!status || !['not_audited', 'audited', 'passed', 'failed'].includes(status)) {
      return res.status(400).json({ error: 'Status is required and must be: not_audited, audited, passed, or failed' });
    }

    // If status is 'failed', failedReason is required
    if (status === 'failed' && (!failedReason || failedReason.trim() === '')) {
      return res.status(400).json({ error: 'FailedReason is required when status is "failed"' });
    }

    const store = await Store.findById(id);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }

    const updatedStore = await Store.updateStatus(id, status, failedReason || null);
    res.json(updatedStore);
  } catch (error) {
    console.error('Update store status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const resetStoreAuditData = async (req, res) => {
  try {
    const { id } = req.params;
    const storeId = parseInt(id, 10);

    if (Number.isNaN(storeId)) {
      return res.status(400).json({ error: "Invalid store id" });
    }

    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const result = await resetStoreAuditById(storeId);
    const updatedStore = await Store.findById(storeId);

    res.json({
      message: "Đã làm mới dữ liệu audit và hình ảnh của cửa hàng.",
      auditsDeleted: result.auditsDeleted,
      store: updatedStore,
    });
  } catch (error) {
    console.error("Reset store audit error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const deleteStore = async (req, res) => {
  try {
    const { id } = req.params;

    const store = await Store.findById(id);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }

    const { getPool, sql } = require('../config/database');
    const pool = await getPool();
    const request = pool.request();
    request.input('Id', sql.Int, id);

    await request.query('DELETE FROM Stores WHERE Id = @Id');

    res.json({ message: 'Store deleted successfully' });
  } catch (error) {
    console.error('Delete store error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getAllStores,
  getStoreById,
  createStore,
  updateStore,
  updateStoreStatus,
  resetStoreAuditData,
  deleteStore,
};


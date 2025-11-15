const Store = require('../models/Store');

const getAllStores = async (req, res) => {
  try {
    const { status, territoryId, userId } = req.query;
    const filters = {};
    
    if (status) filters.Status = status;
    if (territoryId) filters.TerritoryId = parseInt(territoryId);
    if (userId) filters.UserId = parseInt(userId);

    const stores = await Store.findAll(filters);
    res.json(stores);
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

    res.json(store);
  } catch (error) {
    console.error('Get store by id error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createStore = async (req, res) => {
  try {
    const { storeName, address, phone, email, latitude, longitude } = req.body;

    if (!storeName || !address) {
      return res.status(400).json({ error: 'StoreName and address are required' });
    }

    const store = await Store.create({
      StoreName: storeName,
      Address: address,
      Phone: phone,
      Email: email,
      Latitude: latitude,
      Longitude: longitude,
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
    const { storeName, address, phone, email, latitude, longitude, status } = req.body;

    const store = await Store.findById(id);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }

    // Validate status if provided
    if (status && !['not_audited', 'audited', 'passed', 'failed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be: not_audited, audited, passed, or failed' });
    }

    const { getPool, sql } = require('../config/database');
    const pool = await getPool();
    const request = pool.request();

    request.input('Id', sql.Int, id);
    request.input('StoreName', sql.NVarChar(200), storeName || store.StoreName);
    request.input('Address', sql.NVarChar(500), address || store.Address);
    request.input('Phone', sql.VarChar(20), phone || store.Phone);
    request.input('Email', sql.NVarChar(200), email || store.Email);
    request.input('Latitude', sql.Decimal(10, 8), latitude !== undefined ? latitude : store.Latitude);
    request.input('Longitude', sql.Decimal(11, 8), longitude !== undefined ? longitude : store.Longitude);
    request.input('Status', sql.VarChar(20), status || store.Status);

    const result = await request.query(`
      UPDATE Stores 
      SET StoreName = @StoreName, 
          Address = @Address, 
          Phone = @Phone, 
          Email = @Email,
          Latitude = @Latitude,
          Longitude = @Longitude,
          Status = @Status,
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
    const { status } = req.body;

    if (!status || !['not_audited', 'audited', 'passed', 'failed'].includes(status)) {
      return res.status(400).json({ error: 'Status is required and must be: not_audited, audited, passed, or failed' });
    }

    const store = await Store.findById(id);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }

    const updatedStore = await Store.updateStatus(id, status);
    res.json(updatedStore);
  } catch (error) {
    console.error('Update store status error:', error);
    res.status(500).json({ error: 'Internal server error' });
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
  deleteStore,
};


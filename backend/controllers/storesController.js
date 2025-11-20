const Store = require("../models/Store");
const Audit = require("../models/Audit");
const { resetStoreAuditById } = require("../utils/auditReset");

const getAllStores = async (req, res) => {
  try {
    const {
      status,
      territoryId,
      userId,
      rank,
      storeName,
      userName,
      page,
      pageSize,
    } = req.query;
    const filters = {};

    if (status) filters.Status = status;
    if (territoryId) filters.TerritoryId = parseInt(territoryId);
    if (userId) filters.UserId = parseInt(userId);
    if (rank !== undefined && rank !== null && rank !== "") {
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
      Store.count(filters),
    ]);

    // Get current user ID from token
    const currentUserId = req.user?.id || req.user?.userId;

    // Get status for all assigned users for each store
    const { getPool, sql } = require("../config/database");
    const pool = await getPool();
    const StoreUser = require("../models/StoreUser");

    for (let store of stores) {
      // Get all assigned users for this store
      const assignedUsers = await StoreUser.getUsersByStoreId(store.Id);
      
      // If no assigned users, check primary user (backward compatibility)
      if (assignedUsers.length === 0 && store.UserId) {
        // Get primary user info
        const userRequest = pool.request();
        userRequest.input("UserId", sql.Int, store.UserId);
        const userResult = await userRequest.query(`
          SELECT Id, FullName, UserCode
          FROM Users
          WHERE Id = @UserId
        `);
        
        if (userResult.recordset.length > 0) {
          assignedUsers.push({
            UserId: userResult.recordset[0].Id,
            FullName: userResult.recordset[0].FullName,
            UserCode: userResult.recordset[0].UserCode,
          });
        }
      }

      // Get status for each assigned user
      const userStatuses = [];
      for (const assignedUser of assignedUsers) {
        const auditRequest = pool.request();
        auditRequest.input("StoreId", sql.Int, store.Id);
        auditRequest.input("UserId", sql.Int, assignedUser.UserId);

        const auditResult = await auditRequest.query(`
          SELECT TOP 1 
            Result,
            FailedReason,
            AuditDate
          FROM Audits
          WHERE StoreId = @StoreId AND UserId = @UserId
          ORDER BY AuditDate DESC, CreatedAt DESC
        `);

        let userStatus = "not_audited";
        if (auditResult.recordset.length > 0) {
          const latestAudit = auditResult.recordset[0];
          if (latestAudit.Result === "pass") {
            userStatus = "passed";
          } else if (latestAudit.Result === "fail") {
            userStatus = "failed";
          } else if (latestAudit.Result === "audited") {
            userStatus = "audited";
          }
        }

        userStatuses.push({
          UserId: assignedUser.UserId,
          UserFullName: assignedUser.FullName,
          UserCode: assignedUser.UserCode,
          Status: userStatus,
        });
      }

      // Store user statuses array
      store.userStatuses = userStatuses;

      // For backward compatibility: if currentUserId is provided, set store.Status to current user's status
      if (currentUserId) {
        const currentUserStatus = userStatuses.find(
          (us) => us.UserId === currentUserId
        );
        if (currentUserStatus) {
          store.Status = currentUserStatus.Status;
        } else {
          store.Status = "not_audited";
        }
      } else {
        // If no currentUserId, use the first user's status or default
        store.Status = userStatuses.length > 0 ? userStatuses[0].Status : "not_audited";
      }
    }

    res.json({
      data: stores,
      pagination: {
        page: currentPage,
        pageSize: limit,
        total: total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all stores error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getStoreById = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query; // For admin to view specific user's data
    const store = await Store.findById(id);

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    // Get store details with related data
    const { getPool, sql } = require("../config/database");
    const pool = await getPool();
    const request = pool.request();
    request.input("StoreId", sql.Int, id);

    // Set timeout to 60 seconds
    request.timeout = 60000;

    // Get audits with images for this store
    const auditsResult = await request.query(`
      SELECT 
        a.Id as AuditId,
        a.Result,
        a.Notes,
        a.AuditDate,
        a.FailedReason,
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
    const audits = auditsResult.recordset.map((audit) => {
      let images = [];
      try {
        images = audit.Images ? JSON.parse(audit.Images) : [];
      } catch (_error) {
        images = [];
      }
      return {
        ...audit,
        Images: images,
      };
    });

    // Get current user ID from token
    const currentUserId = req.user?.id || req.user?.userId;

    // Get store with territory info
    const storeDetailsResult = await request.query(`
      SELECT 
        s.*,
        t.TerritoryName
      FROM Stores s
      LEFT JOIN Territories t ON s.TerritoryId = t.Id
      WHERE s.Id = @StoreId
    `);

    const storeDetails = storeDetailsResult.recordset[0];

    // Get current user info if available
    let currentUserInfo = null;
    if (currentUserId) {
      const userRequest = pool.request();
      userRequest.input("UserId", sql.Int, currentUserId);
      const userResult = await userRequest.query(`
        SELECT Id, FullName, UserCode
        FROM Users
        WHERE Id = @UserId
      `);
      if (userResult.recordset.length > 0) {
        currentUserInfo = userResult.recordset[0];
      }
    }

    // Filter audits by current user
    const userAudits = currentUserId
      ? audits.filter((audit) => audit.UserId === currentUserId)
      : audits;

    // Calculate user-specific status based on latest audit
    let userStatus = "not_audited";
    let userFailedReason = null;
    let userLatitude = storeDetails.Latitude;
    let userLongitude = storeDetails.Longitude;

    if (currentUserId && userAudits.length > 0) {
      // Get latest audit for this user
      const latestAudit = userAudits.sort(
        (a, b) => new Date(b.AuditDate) - new Date(a.AuditDate)
      )[0];

      if (latestAudit.Result === "pass") {
        userStatus = "passed";
        userFailedReason = null;
      } else if (latestAudit.Result === "fail") {
        userStatus = "failed";
        userFailedReason = latestAudit.FailedReason;
      } else if (latestAudit.Result === "audited") {
        userStatus = "audited";
        userFailedReason = null;
      }

      // Get latitude/longitude from latest audit's first image
      if (latestAudit.Images && latestAudit.Images.length > 0) {
        const firstImage = latestAudit.Images[0];
        if (firstImage.Latitude && firstImage.Longitude) {
          userLatitude = firstImage.Latitude;
          userLongitude = firstImage.Longitude;
        }
      }
    }

    // Get assigned users for this store
    const StoreUser = require("../models/StoreUser");
    const assignedUsers = await StoreUser.getUsersByStoreId(parseInt(id));

    // If no assigned users, check primary user (backward compatibility)
    let allAssignedUsers = assignedUsers;
    if (assignedUsers.length === 0 && storeDetails.UserId) {
      const userRequest = pool.request();
      userRequest.input("UserId", sql.Int, storeDetails.UserId);
      const userResult = await userRequest.query(`
        SELECT Id, FullName, UserCode
        FROM Users
        WHERE Id = @UserId
      `);
      
      if (userResult.recordset.length > 0) {
        allAssignedUsers = [{
          UserId: userResult.recordset[0].Id,
          FullName: userResult.recordset[0].FullName,
          UserCode: userResult.recordset[0].UserCode,
        }];
      }
    }

    // Get status for each assigned user
    const userStatuses = [];
    for (const assignedUser of allAssignedUsers) {
      const auditRequest = pool.request();
      auditRequest.input("StoreId", sql.Int, parseInt(id));
      auditRequest.input("UserId", sql.Int, assignedUser.UserId);

      const auditResult = await auditRequest.query(`
        SELECT TOP 1 
          Result,
          FailedReason,
          AuditDate
        FROM Audits
        WHERE StoreId = @StoreId AND UserId = @UserId
        ORDER BY AuditDate DESC, CreatedAt DESC
      `);

      let userStatus = "not_audited";
      if (auditResult.recordset.length > 0) {
        const latestAudit = auditResult.recordset[0];
        if (latestAudit.Result === "pass") {
          userStatus = "passed";
        } else if (latestAudit.Result === "fail") {
          userStatus = "failed";
        } else if (latestAudit.Result === "audited") {
          userStatus = "audited";
        }
      }

      userStatuses.push({
        UserId: assignedUser.UserId,
        UserFullName: assignedUser.FullName,
        UserCode: assignedUser.UserCode,
        Status: userStatus,
      });
    }

    res.json({
      ...storeDetails,
      Status: userStatus, // Override with user-specific status
      FailedReason: userFailedReason, // Override with user-specific failed reason
      Latitude: userLatitude, // Override with user-specific latitude
      Longitude: userLongitude, // Override with user-specific longitude
      UserFullName:
        currentUserInfo?.FullName || storeDetails.UserFullName || null,
      UserCode: currentUserInfo?.UserCode || storeDetails.UserCode || null,
      audits: audits, // Return all audits (frontend will filter by selectedUserId)
      assignedUsers: allAssignedUsers,
      userStatuses, // Status for each assigned user
    });
  } catch (error) {
    console.error("Get store by id error:", error);
    res.status(500).json({ error: "Internal server error" });
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
    } = req.body;

    if (!storeName || !address) {
      return res
        .status(400)
        .json({ error: "StoreName and address are required" });
    }

    if (rank && ![1, 2].includes(parseInt(rank))) {
      return res.status(400).json({ error: "Rank must be 1 or 2" });
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
    });

    res.status(201).json(store);
  } catch (error) {
    console.error("Create store error:", error);
    res.status(500).json({ error: "Internal server error" });
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
    } = req.body;

    const store = await Store.findById(id);
    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    // Validate status if provided
    if (
      status &&
      !["not_audited", "audited", "passed", "failed"].includes(status)
    ) {
      return res.status(400).json({
        error:
          "Invalid status. Must be: not_audited, audited, passed, or failed",
      });
    }

    // Validate rank if provided
    if (
      rank !== undefined &&
      rank !== null &&
      ![1, 2].includes(parseInt(rank))
    ) {
      return res.status(400).json({ error: "Rank must be 1 or 2" });
    }

    const { getPool, sql } = require("../config/database");
    const pool = await getPool();
    const request = pool.request();

    request.input("Id", sql.Int, id);
    request.input(
      "StoreName",
      sql.NVarChar(200),
      storeName !== undefined ? storeName : store.StoreName
    );
    request.input(
      "Address",
      sql.NVarChar(500),
      address !== undefined ? address : store.Address
    );
    request.input(
      "Phone",
      sql.VarChar(20),
      phone !== undefined ? phone : store.Phone
    );
    request.input(
      "Email",
      sql.NVarChar(200),
      email !== undefined ? email : store.Email
    );
    request.input(
      "Latitude",
      sql.Decimal(10, 8),
      latitude !== undefined ? latitude : store.Latitude
    );
    request.input(
      "Longitude",
      sql.Decimal(11, 8),
      longitude !== undefined ? longitude : store.Longitude
    );
    request.input(
      "Status",
      sql.VarChar(20),
      status !== undefined ? status : store.Status
    );
    request.input(
      "TerritoryId",
      sql.Int,
      territoryId !== undefined ? territoryId : store.TerritoryId
    );
    request.input(
      "UserId",
      sql.Int,
      userId !== undefined ? userId : store.UserId
    );
    // Handle Rank: if rank is explicitly null, set it to null; otherwise use provided value or existing value
    if (rank !== undefined) {
      if (rank === null || rank === "") {
        request.input("Rank", sql.Int, null);
      } else {
        request.input("Rank", sql.Int, parseInt(rank));
      }
    } else {
      request.input("Rank", sql.Int, store.Rank);
    }
    request.input(
      "TaxCode",
      sql.VarChar(50),
      taxCode !== undefined ? taxCode : store.TaxCode
    );
    request.input(
      "PartnerName",
      sql.NVarChar(200),
      partnerName !== undefined ? partnerName : store.PartnerName
    );

    // Build dynamic UPDATE query to handle null Rank properly
    let updateQuery = `
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
          TaxCode = @TaxCode,
          PartnerName = @PartnerName,
          UpdatedAt = GETDATE()`;
    
    // Handle Rank separately to allow null
    if (rank !== undefined) {
      if (rank === null || rank === "") {
        updateQuery += `, Rank = NULL`;
      } else {
        updateQuery += `, Rank = @Rank`;
      }
    } else {
      updateQuery += `, Rank = @Rank`;
    }
    
    updateQuery += `
      OUTPUT INSERTED.*
      WHERE Id = @Id`;

    const result = await request.query(updateQuery);

    // Sync UserId to StoreUsers if UserId was updated (only if StoreUsers is empty for backward compatibility)
    if (userId !== undefined) {
      const StoreUser = require("../models/StoreUser");
      await StoreUser.syncPrimaryUser(id, userId);
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error("Update store error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const updateStoreStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, failedReason, auditId } = req.body;

    if (!status || !["audited", "passed", "failed"].includes(status)) {
      return res.status(400).json({
        error: "Status must be one của: audited, passed, failed",
      });
    }

    if (status === "failed" && (!failedReason || failedReason.trim() === "")) {
      return res
        .status(400)
        .json({ error: "Vui lòng nhập lý do khi chọn trạng thái 'Không đạt'" });
    }

    const store = await Store.findById(id);
    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const targetAudit = auditId
      ? await Audit.findById(auditId)
      : await Audit.findLatestByStore(id);

    if (!targetAudit || targetAudit.StoreId !== store.Id) {
      return res
        .status(400)
        .json({ error: "Không tìm thấy bản ghi audit hợp lệ để cập nhật" });
    }

    const auditResultMap = {
      audited: "audited",
      passed: "pass",
      failed: "fail",
    };

    const updatedAudit = await Audit.updateResult(
      targetAudit.Id,
      auditResultMap[status],
      status === "failed" ? failedReason : null
    );

    await Store.refreshStatusFromLatest(id);
    const updatedStore = await Store.findById(id);

    res.json({
      store: updatedStore,
      audit: updatedAudit,
    });
  } catch (error) {
    console.error("Update store status error:", error);
    res.status(500).json({ error: "Internal server error" });
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
      return res.status(404).json({ error: "Store not found" });
    }

    const { getPool, sql } = require("../config/database");
    const pool = await getPool();
    const request = pool.request();
    request.input("Id", sql.Int, id);

    await request.query("DELETE FROM Stores WHERE Id = @Id");

    res.json({ message: "Store deleted successfully" });
  } catch (error) {
    console.error("Delete store error:", error);
    res.status(500).json({ error: "Internal server error" });
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

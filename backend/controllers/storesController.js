const Store = require("../models/Store");
const Audit = require("../models/Audit");
const { resetStoreAuditById } = require("../utils/auditReset");
const { getPool, sql } = require("../config/database");
const ExcelJS = require("exceljs");

const getStatusLabel = (status) => {
  const labels = {
    not_audited: "Chưa thực hiện",
    audited: "Đã thực hiện",
    passed: "Đạt",
    failed: "Không đạt",
  };
  return labels[status] || status || "";
};

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

    if (stores.length === 0) {
      return res.json({
        data: [],
        pagination: {
          page: currentPage,
          pageSize: limit,
          total: 0,
          totalPages: 0,
        },
      });
    }

    const pool = await getPool();

    const storeIds = stores.map((store) => store.Id);
    const storeUsersMap = await getStoreUsersMap(pool, storeIds);
    const primaryUsersMap = await getPrimaryUsersMap(pool, stores);
    const latestAuditMap = await getLatestAuditMap(pool, storeIds);

    for (const store of stores) {
      let assignedUsers = storeUsersMap.get(store.Id) || [];

      if (assignedUsers.length === 0 && store.UserId) {
        const fallbackUser = primaryUsersMap.get(store.UserId);
        if (fallbackUser) {
          assignedUsers = [fallbackUser];
        }
      }

      const userStatuses = assignedUsers.map((assignedUser) => {
        const latestAuditResult =
          latestAuditMap.get(`${store.Id}-${assignedUser.UserId}`) || null;
        return {
          UserId: assignedUser.UserId,
          UserFullName: assignedUser.UserFullName,
          UserCode: assignedUser.UserCode,
          Status: mapAuditResultToStatus(latestAuditResult),
        };
      });

      store.userStatuses = userStatuses;

      if (currentUserId) {
        const currentUserStatus = userStatuses.find(
          (us) => us.UserId === currentUserId
        );
        store.Status = currentUserStatus
          ? currentUserStatus.Status
          : "not_audited";
      } else if (userStatuses.length > 0) {
        store.Status = userStatuses[0].Status;
      } else if (!store.Status) {
        store.Status = "not_audited";
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

const fetchStoresForExport = async () => {
  const pool = await getPool();
  const request = pool.request();
  request.timeout = 60000;

  const result = await request.query(`
    SELECT 
      s.Id,
      s.StoreCode,
      s.StoreName,
      s.Address,
      s.Phone,
      s.Email,
      s.Status,
      s.Rank,
      s.TaxCode,
      s.PartnerName,
      s.Latitude,
      s.Longitude,
      s.TerritoryId,
      t.TerritoryName,
      s.UserId,
      u.FullName as UserFullName,
      u.UserCode,
      (
        SELECT 
          su.UserId,
          usr.FullName,
          usr.UserCode,
          latest.Result
        FROM StoreUsers su
        INNER JOIN Users usr ON su.UserId = usr.Id
        OUTER APPLY (
          SELECT TOP 1 Result
          FROM Audits a
          WHERE a.StoreId = s.Id AND a.UserId = su.UserId
          ORDER BY a.AuditDate DESC, a.CreatedAt DESC
        ) latest
        WHERE su.StoreId = s.Id
        ORDER BY su.CreatedAt ASC
        FOR JSON PATH
      ) as AssignedUsersJson,
      (
        SELECT TOP 1 Result
        FROM Audits aPrimary
        WHERE aPrimary.StoreId = s.Id AND aPrimary.UserId = s.UserId
        ORDER BY aPrimary.AuditDate DESC, aPrimary.CreatedAt DESC
      ) as PrimaryLatestResult
    FROM Stores s
    LEFT JOIN Territories t ON s.TerritoryId = t.Id
    LEFT JOIN Users u ON s.UserId = u.Id
    ORDER BY s.StoreCode ASC
  `);

  return result.recordset.map((row) => {
    let assignedUsers = [];
    if (row.AssignedUsersJson) {
      try {
        assignedUsers = JSON.parse(row.AssignedUsersJson);
      } catch (_error) {
        assignedUsers = [];
      }
    }

    if (assignedUsers.length === 0 && row.UserId && row.UserFullName) {
      assignedUsers = [
        {
          UserId: row.UserId,
          FullName: row.UserFullName,
          UserCode: row.UserCode,
          Result: row.PrimaryLatestResult || null,
        },
      ];
    }

    const userStatuses = assignedUsers.map((user) => ({
      UserId: user.UserId,
      UserFullName: user.FullName,
      UserCode: user.UserCode,
      Status: mapAuditResultToStatus(user.Result),
    }));

    return {
      Id: row.Id,
      StoreCode: row.StoreCode,
      StoreName: row.StoreName,
      Address: row.Address,
      Phone: row.Phone,
      Email: row.Email,
      Status: row.Status,
      Rank: row.Rank,
      TaxCode: row.TaxCode,
      PartnerName: row.PartnerName,
      Latitude: row.Latitude,
      Longitude: row.Longitude,
      TerritoryName: row.TerritoryName,
      UserFullName: row.UserFullName,
      UserCode: row.UserCode,
      userStatuses,
    };
  });
};

const exportStores = async (_req, res) => {
  try {
    const stores = await fetchStoresForExport();
    res.json({
      success: true,
      data: stores,
    });
  } catch (error) {
    console.error("Export stores error:", error);
    res.status(500).json({ error: "Không thể xuất danh sách cửa hàng" });
  }
};

const exportStoresExcel = async (_req, res) => {
  try {
    const stores = await fetchStoresForExport();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Danh sách cửa hàng");

    const headerStyle = {
      font: { bold: true, color: { argb: "FFFFFFFF" } },
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0138C3" },
      },
      alignment: { horizontal: "center", vertical: "middle" },
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      },
    };

    sheet.mergeCells("A1:P1");
    sheet.getCell("A1").value = "CÔNG TY CỔ PHẦN XI MĂNG TÂY ĐÔ";
    sheet.getCell("A1").font = { bold: true, size: 14 };
    sheet.getCell("A1").alignment = { horizontal: "center" };

    sheet.mergeCells("A2:P2");
    sheet.getCell("A2").value = "DANH SÁCH CỬA HÀNG";
    sheet.getCell("A2").font = { bold: true, size: 12 };
    sheet.getCell("A2").alignment = { horizontal: "center" };

    sheet.getRow(4).values = [
      "STT",
      "Mã cửa hàng",
      "Tên cửa hàng",
      "Loại đối tượng",
      "Địa chỉ",
      "Mã số thuế",
      "Tên đối tác",
      "Số điện thoại",
      "Email",
      "Trạng thái",
      "Địa bàn phụ trách",
      "User phụ trách",
      "Link chi tiết",
      "Latitude",
      "Longitude",
      "Xem trên Google Maps",
    ];
    sheet.getRow(4).eachCell((cell) => {
      cell.style = headerStyle;
    });

    let rowIndex = 0;
    stores.forEach((store) => {
      const statuses =
        store.userStatuses && store.userStatuses.length > 0
          ? store.userStatuses
          : [
              {
                UserFullName: store.UserFullName || "",
                UserCode: store.UserCode || "",
                Status: store.Status,
              },
            ];

      statuses.forEach((userStatus) => {
        rowIndex++;
        const row = sheet.addRow([
          rowIndex,
          store.StoreCode,
          store.StoreName,
          store.Rank === 1
            ? "Đơn vị, tổ chức"
            : store.Rank === 2
            ? "Cá nhân"
            : "-",
          store.Address || "",
          store.TaxCode || "",
          store.PartnerName || "",
          store.Phone || "",
          store.Email || "",
          getStatusLabel(userStatus.Status),
          store.TerritoryName || "",
          userStatus.UserFullName
            ? `${userStatus.UserFullName}${
                userStatus.UserCode ? ` (${userStatus.UserCode})` : ""
              }`
            : "",
          "",
          store.Latitude || "",
          store.Longitude || "",
          "",
        ]);

        const detailCell = row.getCell(13);
        detailCell.value = {
          text: "Link chi tiết",
          hyperlink: `https://quanlythuongvu.ximangtaydo.vn/stores/${store.Id}`,
        };
        detailCell.font = { color: { argb: "FF0000FF" }, underline: true };

        const mapCell = row.getCell(16);
        if (store.Latitude && store.Longitude) {
          mapCell.value = {
            text: "Xem trên Google Maps",
            hyperlink: `https://www.google.com/maps?q=${store.Latitude},${store.Longitude}`,
          };
          mapCell.font = { color: { argb: "FF0000FF" }, underline: true };
        }

        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" },
          };
        });
      });
    });

    sheet.columns = [
      { width: 10 },
      { width: 15 },
      { width: 30 },
      { width: 20 },
      { width: 40 },
      { width: 15 },
      { width: 25 },
      { width: 15 },
      { width: 25 },
      { width: 20 },
      { width: 25 },
      { width: 30 },
      { width: 25 },
      { width: 15 },
      { width: 15 },
      { width: 25 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `DanhSachCuaHang_${
      new Date().toISOString().split("T")[0]
    }.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (error) {
    console.error("Export stores excel error:", error);
    res.status(500).json({ error: "Không thể tạo file Excel" });
  }
};

// Lightweight aggregated status counts for all stores
const getStatusSummary = async (req, res) => {
  try {
    const { territoryId, userId, rank, storeName } = req.query;
    const filters = {};

    if (territoryId) {
      filters.TerritoryId = parseInt(territoryId);
    }
    if (userId) {
      filters.UserId = parseInt(userId);
    }
    if (rank !== undefined && rank !== null && rank !== "") {
      filters.Rank = parseInt(rank);
    }
    if (storeName) {
      filters.storeName = storeName;
    }

    const counts = await Store.countByStatus(filters);

    res.json({
      success: true,
      data: counts,
    });
  } catch (error) {
    console.error("Get status summary error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const mapAuditResultToStatus = (result) => {
  if (!result) return "not_audited";
  if (result === "pass") return "passed";
  if (result === "fail") return "failed";
  if (result === "audited") return "audited";
  return "not_audited";
};

const buildInClause = (items, prefix, request) => {
  return items
    .map((item, index) => {
      const paramName = `${prefix}${index}`;
      request.input(paramName, sql.Int, item);
      return `@${paramName}`;
    })
    .join(", ");
};

const CHUNK_SIZE = 2000;

const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

const getStoreUsersMap = async (pool, storeIds) => {
  const map = new Map();
  if (storeIds.length === 0) {
    return map;
  }

  const chunks = chunkArray(storeIds, CHUNK_SIZE);

  for (const chunk of chunks) {
    const usersRequest = pool.request();
    const inClause = buildInClause(chunk, "StoreId", usersRequest);

    const result = await usersRequest.query(`
      SELECT 
        su.StoreId,
        u.Id as UserId,
        u.FullName as UserFullName,
        u.UserCode
      FROM StoreUsers su
      INNER JOIN Users u ON su.UserId = u.Id
      WHERE su.StoreId IN (${inClause})
      ORDER BY su.StoreId, su.CreatedAt ASC
    `);

    result.recordset.forEach((row) => {
      if (!map.has(row.StoreId)) {
        map.set(row.StoreId, []);
      }
      map.get(row.StoreId).push({
        UserId: row.UserId,
        UserFullName: row.UserFullName,
        UserCode: row.UserCode,
      });
    });
  }

  return map;
};

const getPrimaryUsersMap = async (pool, stores) => {
  const map = new Map();
  const primaryUserIds = [
    ...new Set(
      stores
        .filter((store) => !!store.UserId)
        .map((store) => parseInt(store.UserId, 10))
    ),
  ];

  if (primaryUserIds.length === 0) {
    return map;
  }

  const chunks = chunkArray(primaryUserIds, CHUNK_SIZE);

  for (const chunk of chunks) {
    const usersRequest = pool.request();
    const inClause = buildInClause(chunk, "PrimaryUserId", usersRequest);

    const result = await usersRequest.query(`
      SELECT Id, FullName, UserCode
      FROM Users
      WHERE Id IN (${inClause})
    `);

    result.recordset.forEach((row) => {
      map.set(row.Id, {
        UserId: row.Id,
        UserFullName: row.FullName,
        UserCode: row.UserCode,
      });
    });
  }

  return map;
};

const getLatestAuditMap = async (pool, storeIds) => {
  const map = new Map();
  if (storeIds.length === 0) {
    return map;
  }

  const chunks = chunkArray(storeIds, CHUNK_SIZE);

  for (const chunk of chunks) {
    const auditRequest = pool.request();
    const inClause = buildInClause(chunk, "AuditStoreId", auditRequest);

    const result = await auditRequest.query(`
      WITH RankedAudits AS (
        SELECT 
          StoreId,
          UserId,
          Result,
          ROW_NUMBER() OVER (
            PARTITION BY StoreId, UserId
            ORDER BY AuditDate DESC, CreatedAt DESC
          ) AS RowNum
        FROM Audits
        WHERE StoreId IN (${inClause})
      )
      SELECT StoreId, UserId, Result
      FROM RankedAudits
      WHERE RowNum = 1
    `);

    result.recordset.forEach((row) => {
      map.set(`${row.StoreId}-${row.UserId}`, row.Result);
    });
  }

  return map;
};

const getStoreById = async (req, res) => {
  try {
    const { id } = req.params;
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
        allAssignedUsers = [
          {
            UserId: userResult.recordset[0].Id,
            FullName: userResult.recordset[0].FullName,
            UserCode: userResult.recordset[0].UserCode,
          },
        ];
      }
    }

    // Compute latest status for each user with a single query
    const latestStatusRequest = pool.request();
    latestStatusRequest.input("StoreId", sql.Int, parseInt(id, 10));
    const latestStatusResult = await latestStatusRequest.query(`
      WITH RankedAudits AS (
        SELECT 
          UserId,
          Result,
          FailedReason,
          ROW_NUMBER() OVER (
            PARTITION BY UserId
            ORDER BY AuditDate DESC, CreatedAt DESC
          ) AS rn
        FROM Audits
        WHERE StoreId = @StoreId
      )
      SELECT UserId, Result, FailedReason
      FROM RankedAudits
      WHERE rn = 1
    `);

    const latestStatusMap = new Map();
    latestStatusResult.recordset.forEach((row) => {
      latestStatusMap.set(row.UserId, row);
    });

    const userStatuses = allAssignedUsers.map((assignedUser) => {
      const latest = latestStatusMap.get(assignedUser.UserId);
      return {
        UserId: assignedUser.UserId,
        UserFullName: assignedUser.FullName,
        UserCode: assignedUser.UserCode,
        Status: mapAuditResultToStatus(latest?.Result),
        FailedReason: latest?.FailedReason || null,
      };
    });

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
  exportStores,
  exportStoresExcel,
  getStoreById,
  createStore,
  updateStore,
  updateStoreStatus,
  resetStoreAuditData,
  deleteStore,
  getStatusSummary,
};

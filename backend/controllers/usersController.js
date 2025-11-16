const bcrypt = require("bcryptjs");
const User = require("../models/User");

const getAllUsers = async (req, res) => {
  try {
    const { search, role, page, pageSize } = req.query;
    const filters = {};

    if (search) filters.search = search;
    if (role) filters.Role = role;

    // Pagination
    const currentPage = parseInt(page) || 1;
    const limit = parseInt(pageSize) || 50;
    const offset = (currentPage - 1) * limit;

    filters.limit = limit;
    filters.offset = offset;

    const [users, total] = await Promise.all([
      User.findAll(filters),
      User.count(filters),
    ]);

    res.json({
      data: users,
      pagination: {
        page: currentPage,
        pageSize: limit,
        total: total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Remove password from response
    const { Password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error("Get user by id error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const createUser = async (req, res) => {
  try {
    const { username, password, fullName, email, phone, role } = req.body;

    if (!username || !password || !fullName) {
      return res
        .status(400)
        .json({ error: "Username, password, and fullName are required" });
    }

    const existingUser = await User.findByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      Username: username,
      Password: hashedPassword,
      FullName: fullName,
      Email: email,
      Phone: phone,
      Role: role || "user",
      IsChangePassword: true, // Default to true - user must change password on first login
    });

    const { Password, ...userWithoutPassword } = user;
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, phone, role, password } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { getPool, sql } = require("../config/database");
    const pool = await getPool();
    const request = pool.request();

    request.input("Id", sql.Int, id);
    request.input("FullName", sql.NVarChar(200), fullName || user.FullName);
    request.input("Email", sql.NVarChar(200), email || user.Email);
    request.input("Phone", sql.VarChar(20), phone || user.Phone);
    request.input("Role", sql.VarChar(50), role || user.Role);

    let updateQuery = `
      UPDATE Users 
      SET FullName = @FullName, 
          Email = @Email, 
          Phone = @Phone, 
          Role = @Role,
          UpdatedAt = GETDATE()
    `;

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      request.input("Password", sql.NVarChar(255), hashedPassword);
      updateQuery += ", Password = @Password";
    }

    updateQuery += " OUTPUT INSERTED.* WHERE Id = @Id";

    const result = await request.query(updateQuery);
    const { Password, ...userWithoutPassword } = result.recordset[0];

    res.json(userWithoutPassword);
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Avatar image is required" });
    }

    const userId = req.user.id;
    const { uploadImageWithWatermark } = require("../services/cloudinaryService");

    // Upload to Cloudinary (without watermark for avatar)
    const cloudinary = require("cloudinary").v2;
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

    const uploadResult = await cloudinary.uploader.upload(base64Image, {
      folder: "avatars",
      resource_type: "image",
      transformation: [
        { width: 400, height: 400, crop: "fill", gravity: "face" },
        { quality: "auto" },
      ],
    });

    // Update user avatar in database
    const { getPool, sql } = require("../config/database");
    const pool = await getPool();
    const request = pool.request();
    request.input("Id", sql.Int, userId);
    request.input("Avatar", sql.NVarChar(500), uploadResult.secure_url);

    const result = await request.query(`
      UPDATE Users 
      SET Avatar = @Avatar, UpdatedAt = GETDATE()
      OUTPUT INSERTED.*
      WHERE Id = @Id
    `);

    const { Password, ...userWithoutPassword } = result.recordset[0];
    res.json({ avatar: uploadResult.secure_url, user: userWithoutPassword });
  } catch (error) {
    console.error("Upload avatar error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { force } = req.query; // force=true to delete even if has audits

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if user has audits
    const { getPool, sql } = require("../config/database");
    const pool = await getPool();
    const request = pool.request();
    request.input("UserId", sql.Int, id);

    const auditResult = await request.query(`
      SELECT COUNT(*) as AuditCount
      FROM Audits
      WHERE UserId = @UserId
    `);

    const auditCount = auditResult.recordset[0].AuditCount;

    // If user has audits and force is not true, return warning
    if (auditCount > 0 && force !== "true") {
      return res.status(200).json({
        warning: true,
        message: `Nhân viên này đã có ${auditCount} audit. Bạn có chắc muốn xóa không?`,
        auditCount: auditCount,
      });
    }

    // Delete user (and related audits/images will be handled by cascade or separately)
    request.input("Id", sql.Int, id);
    await request.query("DELETE FROM Users WHERE Id = @Id");

    res.json({
      message: "User deleted successfully",
      deletedAudits: auditCount,
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  uploadAvatar,
};

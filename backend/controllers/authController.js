const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Tên đăng nhập và mật khẩu là bắt buộc" });
    }

    // Allow login by Username or UserCode
    const user = await User.findByUsernameOrUserCode(username);
    if (!user) {
      return res
        .status(401)
        .json({ error: "Tài khoản hoặc mật khẩu không đúng hãy thử lại." });
    }

    const isValidPassword = await bcrypt.compare(password, user.Password);
    if (!isValidPassword) {
      return res
        .status(401)
        .json({ error: "Tài khoản hoặc mật khẩu không đúng hãy thử lại." });
    }

    // Allow login even if IsChangePassword is true - frontend will handle navigation

    const token = jwt.sign(
      { id: user.Id, username: user.Username, role: user.Role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    res.json({
      token,
      user: {
        id: user.Id,
        userCode: user.UserCode,
        username: user.Username,
        fullName: user.FullName,
        email: user.Email,
        phone: user.Phone,
        role: user.Role,
        avatar: user.Avatar || null,
        isChangePassword: user.IsChangePassword || false,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Lỗi máy chủ. Vui lòng thử lại sau." });
  }
};

const register = async (req, res) => {
  try {
    const { username, password, fullName, email, phone, role } = req.body;

    if (!username || !password || !fullName) {
      return res
        .status(400)
        .json({ error: "Tên đăng nhập, mật khẩu và họ tên là bắt buộc" });
    }

    // Check if user exists
    const existingUser = await User.findByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: "Tên đăng nhập đã tồn tại" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      Username: username,
      Password: hashedPassword,
      FullName: fullName,
      Email: email,
      Phone: phone,
      Role: role || "user",
    });

    const token = jwt.sign(
      { id: user.Id, username: user.Username, role: user.Role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    res.status(201).json({
      token,
      user: {
        id: user.Id,
        userCode: user.UserCode,
        username: user.Username,
        fullName: user.FullName,
        email: user.Email,
        role: user.Role,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Lỗi máy chủ. Vui lòng thử lại sau." });
  }
};

const refreshToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token là bắt buộc" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ error: "Không tìm thấy người dùng" });
    }

    const newToken = jwt.sign(
      { id: user.Id, username: user.Username, role: user.Role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    res.json({ token: newToken });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(401).json({ error: "Token không hợp lệ" });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Mật khẩu hiện tại và mật khẩu mới là bắt buộc" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(
      currentPassword,
      user.Password
    );
    if (!isValidPassword) {
      return res.status(401).json({ error: "Mật khẩu hiện tại không đúng" });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await User.updatePassword(userId, hashedNewPassword);

    res.status(200).json({
      success: true,
      message: "Đổi mật khẩu thành công",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Lỗi máy chủ. Vui lòng thử lại sau." });
  }
};

module.exports = {
  login,
  register,
  refreshToken,
  changePassword,
};

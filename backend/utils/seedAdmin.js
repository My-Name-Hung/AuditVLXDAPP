const bcrypt = require("bcryptjs");
const User = require("../models/User");

async function seedAdminUser() {
  const username = "adminxmtd";
  const password = "Admin@123";
  const fullName = "Quản trị viên XMTĐ";
  const email = "admin@xmtd.com";
  const phone = "+84 912 345 678";

  try {
    const existingUser = await User.findByUsername(username);
    if (existingUser) {
      console.log(`ℹ️  Admin account '${username}' đã tồn tại.`);
      return existingUser;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const adminUser = await User.create({
      Username: username,
      Password: hashedPassword,
      FullName: fullName,
      Email: email,
      Phone: phone,
      Role: "admin",
      IsChangePassword: 0, // Admin không cần đổi mật khẩu
    });

    console.log("✅ Đã tạo tài khoản quản trị mặc định:");
    console.log(`   - Username: ${username}`);
    console.log(`   - Password: ${password}`);
    return adminUser;
  } catch (error) {
    console.error("❌ Không thể seed tài khoản admin mặc định:", error.message);
    throw error;
  }
}

module.exports = { seedAdminUser };

const bcrypt = require("bcryptjs");
const User = require("../models/User");

async function seedAdminUser() {
  const username = process.env.ADMIN_DEFAULT_USERNAME || "adminxmtd";
  const password = process.env.ADMIN_DEFAULT_PASSWORD || "Admin@123";
  const fullName = process.env.ADMIN_DEFAULT_FULLNAME || "Quản trị viên XMTĐ";
  const email = process.env.ADMIN_DEFAULT_EMAIL || "admin@xmtd.com";
  const phone = process.env.ADMIN_DEFAULT_PHONE || "+84 912 345 678";

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

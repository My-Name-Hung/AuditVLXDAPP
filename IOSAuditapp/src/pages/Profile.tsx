import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import api from "../services/api";
import "./Profile.css";

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
  const { colors, isDarkMode, toggleDarkMode } = useTheme();

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    fullName: user?.fullName || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    user?.avatar || null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleEdit = () => {
    setEditing(true);
    setFormData({
      fullName: user?.fullName || "",
      email: user?.email || "",
      phone: user?.phone || "",
    });
  };

  const handleCancel = () => {
    setEditing(false);
    setChangingPassword(false);
    setFormData({
      fullName: user?.fullName || "",
      email: user?.email || "",
      phone: user?.phone || "",
    });
    setPasswordData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setAvatarFile(null);
    setAvatarPreview(user?.avatar || null);
    setError("");
    setSuccess("");
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Kích thước ảnh không được vượt quá 5MB");
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setError("");
    setSuccess("");

    if (!formData.fullName.trim()) {
      setError("Vui lòng nhập tên đầy đủ");
      return;
    }

    if (!formData.email.trim()) {
      setError("Vui lòng nhập email");
      return;
    }

    setLoading(true);
    try {
      // Upload avatar if changed
      let avatarUrl = user?.avatar;
      if (avatarFile) {
        const formDataAvatar = new FormData();
        formDataAvatar.append("avatar", avatarFile);

        const avatarResponse = await api.post(
          "/users/upload-avatar",
          formDataAvatar,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );
        avatarUrl = avatarResponse.data.avatarUrl;
      }

      // Update user info
      await api.put(`/users/${user?.id}`, {
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        avatar: avatarUrl,
      });

      updateUser({
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        avatar: avatarUrl,
      });

      setSuccess("Cập nhật thông tin thành công");
      setEditing(false);
      setAvatarFile(null);
    } catch (err: any) {
      setError(err.response?.data?.error || "Cập nhật thông tin thất bại");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    setError("");
    setSuccess("");

    if (
      !passwordData.currentPassword ||
      !passwordData.newPassword ||
      !passwordData.confirmPassword
    ) {
      setError("Vui lòng điền đầy đủ thông tin");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError("Mật khẩu mới phải có ít nhất 6 ký tự");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });

      setSuccess("Đổi mật khẩu thành công");
      setChangingPassword(false);
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err: any) {
      setError(err.response?.data?.error || "Đổi mật khẩu thất bại");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm("Bạn có chắc muốn đăng xuất?")) {
      await logout();
      navigate("/login");
    }
  };

  return (
    <div
      className="profile-container"
      style={{ backgroundColor: colors.secondary }}
    >
      {/* Header with back button */}
      <div
        className="profile-header"
        style={{
          backgroundColor: colors.background,
          borderBottomColor: colors.icon + "20",
        }}
      >
        <button
          className="profile-back-button"
          onClick={() => navigate(-1)}
          style={{ color: colors.text }}
        >
          ← Quay lại
        </button>
        <h1 className="profile-header-title" style={{ color: colors.text }}>
          Hồ sơ
        </h1>
        <div style={{ width: "80px" }}></div> {/* Spacer for centering */}
      </div>

      <div className="profile-content">
        {error && <div className="profile-error">{error}</div>}
        {success && <div className="profile-success">{success}</div>}

        {/* Avatar Section */}
        <div className="profile-avatar-section">
          <div className="profile-avatar-container">
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Avatar"
                className="profile-avatar"
              />
            ) : (
              <div
                className="profile-avatar-placeholder"
                style={{ color: colors.primary }}
              >
                👤
              </div>
            )}
            {editing && (
              <button
                className="profile-avatar-edit-button"
                onClick={() => fileInputRef.current?.click()}
                style={{ backgroundColor: colors.primary }}
              >
                📷
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              style={{ display: "none" }}
            />
          </div>
          <h2 className="profile-name" style={{ color: colors.text }}>
            {user?.fullName || "N/A"}
          </h2>
          <p className="profile-role" style={{ color: colors.icon }}>
            {user?.position || user?.role || "N/A"}
          </p>
        </div>

        {/* User Info Section */}
        <div
          className="profile-info-section"
          style={{ backgroundColor: colors.background }}
        >
          <div className="profile-info-item">
            <span className="profile-info-label" style={{ color: colors.icon }}>
              Tên đăng nhập:
            </span>
            <span className="profile-info-value" style={{ color: colors.text }}>
              {user?.username || "N/A"}
            </span>
          </div>

          <div className="profile-info-item">
            <span className="profile-info-label" style={{ color: colors.icon }}>
              Mã nhân viên:
            </span>
            <span className="profile-info-value" style={{ color: colors.text }}>
              {user?.userCode || "N/A"}
            </span>
          </div>

          {editing ? (
            <>
              <div className="profile-info-item">
                <label
                  className="profile-info-label"
                  style={{ color: colors.icon }}
                >
                  Tên đầy đủ:
                </label>
                <input
                  type="text"
                  className="profile-input"
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  style={{
                    color: colors.text,
                    borderColor: colors.icon + "40",
                  }}
                />
              </div>

              <div className="profile-info-item">
                <label
                  className="profile-info-label"
                  style={{ color: colors.icon }}
                >
                  Email:
                </label>
                <input
                  type="email"
                  className="profile-input"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  style={{
                    color: colors.text,
                    borderColor: colors.icon + "40",
                  }}
                />
              </div>

              <div className="profile-info-item">
                <label
                  className="profile-info-label"
                  style={{ color: colors.icon }}
                >
                  Số điện thoại:
                </label>
                <input
                  type="tel"
                  className="profile-input"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  style={{
                    color: colors.text,
                    borderColor: colors.icon + "40",
                  }}
                />
              </div>
            </>
          ) : (
            <>
              <div className="profile-info-item">
                <span
                  className="profile-info-label"
                  style={{ color: colors.icon }}
                >
                  Tên đầy đủ:
                </span>
                <span
                  className="profile-info-value"
                  style={{ color: colors.text }}
                >
                  {user?.fullName || "N/A"}
                </span>
              </div>

              <div className="profile-info-item">
                <span
                  className="profile-info-label"
                  style={{ color: colors.icon }}
                >
                  Email:
                </span>
                <span
                  className="profile-info-value"
                  style={{ color: colors.text }}
                >
                  {user?.email || "N/A"}
                </span>
              </div>

              <div className="profile-info-item">
                <span
                  className="profile-info-label"
                  style={{ color: colors.icon }}
                >
                  Số điện thoại:
                </span>
                <span
                  className="profile-info-value"
                  style={{ color: colors.text }}
                >
                  {user?.phone || "N/A"}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Change Password Section */}
        {changingPassword && (
          <div
            className="profile-password-section"
            style={{ backgroundColor: colors.background }}
          >
            <h3
              className="profile-section-title"
              style={{ color: colors.text }}
            >
              Đổi mật khẩu
            </h3>
            <div className="profile-info-item">
              <label
                className="profile-info-label"
                style={{ color: colors.icon }}
              >
                Mật khẩu hiện tại:
              </label>
              <input
                type="password"
                className="profile-input"
                value={passwordData.currentPassword}
                onChange={(e) =>
                  setPasswordData({
                    ...passwordData,
                    currentPassword: e.target.value,
                  })
                }
                style={{ color: colors.text, borderColor: colors.icon + "40" }}
              />
            </div>
            <div className="profile-info-item">
              <label
                className="profile-info-label"
                style={{ color: colors.icon }}
              >
                Mật khẩu mới:
              </label>
              <input
                type="password"
                className="profile-input"
                value={passwordData.newPassword}
                onChange={(e) =>
                  setPasswordData({
                    ...passwordData,
                    newPassword: e.target.value,
                  })
                }
                style={{ color: colors.text, borderColor: colors.icon + "40" }}
              />
            </div>
            <div className="profile-info-item">
              <label
                className="profile-info-label"
                style={{ color: colors.icon }}
              >
                Xác nhận mật khẩu:
              </label>
              <input
                type="password"
                className="profile-input"
                value={passwordData.confirmPassword}
                onChange={(e) =>
                  setPasswordData({
                    ...passwordData,
                    confirmPassword: e.target.value,
                  })
                }
                style={{ color: colors.text, borderColor: colors.icon + "40" }}
              />
            </div>
          </div>
        )}

        {/* Theme Toggle */}
        <div
          className="profile-theme-section"
          style={{ backgroundColor: colors.background }}
        >
          <div className="profile-theme-item">
            <span className="profile-info-label" style={{ color: colors.icon }}>
              Giao diện sáng/tối:
            </span>
            <label className="profile-toggle">
              <input
                type="checkbox"
                checked={isDarkMode}
                onChange={(e) => toggleDarkMode(e.target.checked)}
              />
              <span className="profile-toggle-slider" />
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="profile-actions">
          {editing ? (
            <>
              <button
                className="profile-button profile-button-save"
                onClick={handleSave}
                disabled={loading}
                style={{ backgroundColor: colors.primary }}
              >
                {loading ? "Đang lưu..." : "Lưu"}
              </button>
              <button
                className="profile-button profile-button-cancel"
                onClick={handleCancel}
                disabled={loading}
              >
                Hủy
              </button>
            </>
          ) : (
            <>
              <button
                className="profile-button profile-button-edit"
                onClick={handleEdit}
                style={{ backgroundColor: colors.primary }}
              >
                Chỉnh sửa thông tin
              </button>
              {!changingPassword ? (
                <button
                  className="profile-button profile-button-password"
                  onClick={() => setChangingPassword(true)}
                >
                  Đổi mật khẩu
                </button>
              ) : (
                <>
                  <button
                    className="profile-button profile-button-save"
                    onClick={handleChangePassword}
                    disabled={loading}
                    style={{ backgroundColor: colors.primary }}
                  >
                    {loading ? "Đang lưu..." : "Xác nhận đổi mật khẩu"}
                  </button>
                  <button
                    className="profile-button profile-button-cancel"
                    onClick={handleCancel}
                    disabled={loading}
                  >
                    Hủy
                  </button>
                </>
              )}
            </>
          )}
          <button
            className="profile-button profile-button-logout"
            onClick={handleLogout}
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
}

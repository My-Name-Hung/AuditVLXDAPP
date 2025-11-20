import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/api';
import './ChangePassword.css';

export default function ChangePassword() {
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const { colors } = useTheme();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Vui lòng điền đầy đủ thông tin');
      return;
    }

    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });

      if (response.status >= 200 && response.status < 300) {
        setLoading(false);
        updateUser({ isChangePassword: false });
        alert('Đổi mật khẩu thành công');
        navigate('/stores');
      }
    } catch (err: any) {
      setLoading(false);
      const errorMessage =
        err.response?.data?.error || err.message || 'Đổi mật khẩu thất bại. Vui lòng thử lại.';
      setError(errorMessage);
    }
  };

  return (
    <div className="change-password-container" style={{ backgroundColor: colors.background }}>
      <div className="change-password-header">
        <button
          className="change-password-back-button"
          onClick={() => navigate(-1)}
          style={{ color: colors.text }}
        >
          ← Quay lại
        </button>
        <h1 className="change-password-title" style={{ color: colors.text }}>
          Thay đổi mật khẩu
        </h1>
      </div>

      <div className="change-password-content">
        <p className="change-password-subtitle" style={{ color: colors.icon }}>
          Vui lòng nhập mật khẩu mới
        </p>

        <form className="change-password-form" onSubmit={handleChangePassword}>
          {error && <div className="change-password-error">{error}</div>}

          <div className="change-password-input-container">
            <span className="change-password-input-icon">🔒</span>
            <input
              type={showCurrentPassword ? 'text' : 'password'}
              className="change-password-input"
              placeholder="Mật khẩu hiện tại"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
            />
            <button
              type="button"
              className="change-password-eye-button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
            >
              {showCurrentPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>

          <div className="change-password-input-container">
            <span className="change-password-input-icon">🔒</span>
            <input
              type={showNewPassword ? 'text' : 'password'}
              className="change-password-input"
              placeholder="Mật khẩu mới"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
            />
            <button
              type="button"
              className="change-password-eye-button"
              onClick={() => setShowNewPassword(!showNewPassword)}
            >
              {showNewPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>

          <div className="change-password-input-container">
            <span className="change-password-input-icon">🔒</span>
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              className="change-password-input"
              placeholder="Xác nhận mật khẩu mới"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
            />
            <button
              type="button"
              className="change-password-eye-button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>

          <button
            type="submit"
            className="change-password-button"
            disabled={loading}
            style={{ backgroundColor: colors.primary }}
          >
            {loading ? 'Đang xử lý...' : 'Xác nhận'}
          </button>
        </form>
      </div>
    </div>
  );
}


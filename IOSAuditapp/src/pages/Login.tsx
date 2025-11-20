import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, saveCredentials, getSavedCredentials, clearSavedCredentials } from '../contexts/AuthContext';
import { Colors } from '../constants/theme';
import api from '../services/api';
import iconImage from '../assets/icon.jpg';
import './Login.css';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSavedCredentials();
  }, []);

  const loadSavedCredentials = () => {
    const saved = getSavedCredentials();
    if (saved) {
      setUsername(saved.username);
      setPassword(saved.password);
      setRememberPassword(true);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Vui lòng nhập tên đăng nhập và mật khẩu');
      return;
    }

    setLoading(true);
    try {
      const response = await login(username.trim(), password);

      if (rememberPassword) {
        saveCredentials(username.trim(), password);
      } else {
        clearSavedCredentials();
      }

      if (response.user.isChangePassword) {
        setLoading(false);
        navigate('/change-password');
        return;
      }

      setLoading(false);
      navigate('/stores');
    } catch (err: any) {
      setLoading(false);
      const errorMessage =
        err.response?.data?.error || err.message || 'Tài khoản hoặc mật khẩu không đúng hãy thử lại.';
      setError(errorMessage);
    }
  };

  return (
    <div className="login-container" style={{ backgroundColor: Colors.light.secondary }}>
      <div className="login-content">
        <div className="login-logo-container">
          <img src={iconImage} alt="Logo" className="login-logo" />
        </div>

        <h1 className="login-title" style={{ color: Colors.light.primary }}>
          Đăng nhập hệ thống
        </h1>
        <p className="login-subtitle">Quản lý thương vụ XMTĐ</p>

        <form className="login-form" onSubmit={handleLogin}>
          {error && <div className="login-error">{error}</div>}

          <div className="login-input-container">
            <span className="login-input-icon">👤</span>
            <input
              type="text"
              className="login-input"
              placeholder="Tên đăng nhập hoặc Mã nhân viên"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>

          <div className="login-input-container">
            <span className="login-input-icon">🔒</span>
            <input
              type={showPassword ? 'text' : 'password'}
              className="login-input"
              placeholder="Mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
            />
            <button
              type="button"
              className="login-eye-button"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>

          <div className="login-remember-container">
            <label className="login-checkbox-container">
              <input
                type="checkbox"
                checked={rememberPassword}
                onChange={(e) => setRememberPassword(e.target.checked)}
                className="login-checkbox"
              />
              <span className="login-checkbox-label">Ghi nhớ mật khẩu</span>
            </label>
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={loading}
            style={{ backgroundColor: Colors.light.primary }}
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  );
}


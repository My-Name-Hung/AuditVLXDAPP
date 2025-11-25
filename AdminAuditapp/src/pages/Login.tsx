import { useEffect, useState } from "react";
import { PiEyeSlashThin, PiEyeThin } from "react-icons/pi";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "./Login.css";

const REMEMBER_PASSWORD_KEY = "rememberPassword";
const SAVED_USERNAME_KEY = "savedUsername";
const SAVED_PASSWORD_KEY = "savedPassword";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [salesModalOpen, setSalesModalOpen] = useState(false);
  const { login, logout } = useAuth();
  const navigate = useNavigate();

  // Load saved credentials on mount
  useEffect(() => {
    const savedRemember =
      localStorage.getItem(REMEMBER_PASSWORD_KEY) === "true";
    if (savedRemember) {
      const savedUsername = localStorage.getItem(SAVED_USERNAME_KEY);
      const savedPassword = localStorage.getItem(SAVED_PASSWORD_KEY);
      if (savedUsername) setUsername(savedUsername);
      if (savedPassword) setPassword(savedPassword);
      setRememberPassword(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await login(username, password);
      
      // Check if user role is sales
      if (response?.user?.role === 'sales') {
        // Logout sales user immediately
        logout();
        setSalesModalOpen(true);
        setLoading(false);
        return;
      }

      // Save credentials if remember password is checked
      if (rememberPassword) {
        localStorage.setItem(REMEMBER_PASSWORD_KEY, "true");
        localStorage.setItem(SAVED_USERNAME_KEY, username);
        localStorage.setItem(SAVED_PASSWORD_KEY, password);
      } else {
        // Clear saved credentials if unchecked
        localStorage.removeItem(REMEMBER_PASSWORD_KEY);
        localStorage.removeItem(SAVED_USERNAME_KEY);
        localStorage.removeItem(SAVED_PASSWORD_KEY);
      }

      navigate("/");
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } } };
      setError(
        apiError.response?.data?.error ||
          "Tài khoản hoặc mật khẩu không đúng hãy thử lại."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-illustration">
        <div className="illustration-content">
          <p className="kicker">ĐƯỢC THỰC HIỆN BỞI ĐỘI NGŨ IT GROUP XMTĐ</p>
          <h1>QUẢN LÝ SALE XMTĐ</h1>
          <ul>
            <li>SĐT: (+84.292) 3862077</li>
            <li>Email: ximangtaydo@xmtd.vn</li>
            <li>Mã số thuế: 1800561359</li>
            <li>Địa chỉ: Km14, QL91, P.Phước Thới, TP.Cần Thơ</li>
          </ul>
        </div>
      </div>

      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <img src="/icon.jpg" alt="Logo" className="login-logo" />
            <h1>Đăng nhập hệ thống</h1>
            <p>Vui lòng sử dụng tài khoản được cấp để truy cập.</p>
          </div>
          <form onSubmit={handleSubmit} className="login-form">
            {error && <div className="error-message">{error}</div>}
            <div className="form-group">
              <label htmlFor="username">Tên đăng nhập</label>
              <input
                type="text"
                id="username"
                placeholder="Nhập tên đăng nhập"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Mật khẩu</label>
              <div className="input-with-icon">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="eye-button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={
                    showPassword ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"
                  }
                >
                  {showPassword ? <PiEyeSlashThin /> : <PiEyeThin />}
                </button>
              </div>
            </div>
            <div className="form-group remember-password">
              <label className="remember-checkbox">
                <input
                  type="checkbox"
                  checked={rememberPassword}
                  onChange={(e) => setRememberPassword(e.target.checked)}
                />
                <span>Ghi nhớ mật khẩu</span>
              </label>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary btn-full"
            >
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>
        </div>
      </div>

      {/* Sales Role Modal */}
      {salesModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Thông báo</h3>
            <p>Bạn là nhân viên Sales và không thể truy cập trang quản trị này.</p>
            <div className="modal-actions">
              <button
                className="btn-primary"
                onClick={() => {
                  setSalesModalOpen(false);
                  setUsername("");
                  setPassword("");
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

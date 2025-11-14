import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "./Login.css";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(username, password);
      navigate("/");
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } } };
      setError(
        apiError.response?.data?.error ||
          "Không thể đăng nhập. Vui lòng kiểm tra lại thông tin."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-illustration">
        <div className="illustration-content">
          <p className="kicker">Quản lý thương vụ XMTĐ</p>
          <h1>Nền tảng điều phối chương trình và cửa hàng toàn quốc</h1>
          <p>
            Theo dõi tiến độ, quản lý người dùng và đồng bộ dữ liệu từ hiện
            trường trong một giao diện duy nhất.
          </p>
          <ul>
            <li>📊 Thống kê theo thời gian thực</li>
            <li>🏪 Quản lý chuỗi cửa hàng & nhà phân phối</li>
            <li>⤴️ Import/Export dữ liệu chuẩn Excel</li>
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
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
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
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import iconImage from "../assets/icon.jpg";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import "./Header.css";

interface HeaderProps {
  title?: string;
}

export default function Header({ title }: HeaderProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { colors } = useTheme();

  return (
    <header
      className="header"
      style={{
        backgroundColor: colors.background,
        borderBottomColor: colors.icon + "20",
      }}
    >
      <div
        className="header-user-section"
        onClick={() => navigate("/profile")}
        style={{ cursor: "pointer" }}
      >
        {user?.avatar ? (
          <img src={user.avatar} alt="Avatar" className="header-avatar" />
        ) : (
          <div
            className="header-avatar-placeholder"
            style={{ color: colors.primary }}
          >
            👤
          </div>
        )}
        {user?.fullName && (
          <span className="header-username" style={{ color: colors.text }}>
            {user.fullName}
          </span>
        )}
      </div>

      {title && (
        <h1 className="header-title" style={{ color: colors.text }}>
          {title}
        </h1>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          className="header-dashboard-button"
          onClick={() => navigate("/dashboard")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            cursor: "pointer",
            padding: "4px 8px",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.primary}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
          <span style={{ fontSize: "12px", fontWeight: "500", color: colors.text }}>
            Thống kê
          </span>
        </div>
        <div className="header-logo-container">
          <img src={iconImage} alt="Logo" className="header-logo" />
        </div>
      </div>
    </header>
  );
}

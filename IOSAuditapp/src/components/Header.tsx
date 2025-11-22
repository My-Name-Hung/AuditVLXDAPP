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

      <div className="header-logo-container">
        <img src={iconImage} alt="Logo" className="header-logo" />
      </div>
    </header>
  );
}

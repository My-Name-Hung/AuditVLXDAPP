import { HiHome, HiOfficeBuilding, HiUsers } from "react-icons/hi";
import { HiArrowUpOnSquare } from "react-icons/hi2";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "./Layout.css";

const navItems = [
  { path: "/", label: "Tổng quan", icon: HiHome },
  { path: "/stores", label: "Danh sách cửa hàng", icon: HiOfficeBuilding },
  { path: "/users", label: "Danh sách nhân viên", icon: HiUsers },
  { path: "/import-export", label: "Tải lên danh sách", icon: HiArrowUpOnSquare },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (path: string) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src="/icon.jpg" alt="Logo" className="sidebar-logo" />
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${isActive(item.path) ? "active" : ""}`}
              >
                <Icon className="nav-icon" />
                <span className="nav-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-content">
            <div>
              <p className="topbar-kicker">Xin chào</p>
              <h1>{user?.fullName || user?.username}</h1>
            </div>
            <button onClick={handleLogout} className="btn-logout">
              Đăng xuất
            </button>
          </div>
        </header>
        <div className="content-area">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

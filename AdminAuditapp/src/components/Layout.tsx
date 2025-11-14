import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "./Layout.css";

const navSections = [
  {
    title: "Chương trình và cửa hàng",
    items: [
      { path: "/audits", label: "Danh sách chương trình", icon: "📅" },
      { path: "/stores", label: "Danh sách cửa hàng", icon: "🏬" },
    ],
  },
  {
    title: "Người dùng & NPP",
    items: [
      { path: "/users", label: "Danh sách người dùng", icon: "👥" },
      { path: "/distributors", label: "Danh sách nhà phân phối", icon: "🚚" },
    ],
  },
  {
    title: "Thống kê",
    items: [{ path: "/", label: "Dashboard", icon: "📊" }],
  },
  {
    title: "Dữ liệu",
    items: [{ path: "/import-export", label: "Upload/Download", icon: "⤴️" }],
  },
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
          <h2>Quản lý thương vụ XMTĐ</h2>
        </div>
        <nav className="sidebar-nav">
          {navSections.map((section) => (
            <div key={section.title} className="sidebar-section">
              <p className="sidebar-section__title">{section.title}</p>
              {section.items.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`nav-item ${isActive(item.path) ? "active" : ""}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
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


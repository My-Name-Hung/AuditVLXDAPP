import { useEffect, useState } from "react";
import api from "../services/api";
import "./Dashboard.css";

interface AuditRecord {
  auditDate: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState({
    users: 0,
    stores: 0,
    audits: 0,
    auditsToday: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [usersRes, storesRes, auditsRes] = await Promise.all([
        api.get("/users"),
        api.get("/stores"),
        api.get("/audits"),
      ]);

      const today = new Date().toISOString().split("T")[0];
      const auditsToday = (auditsRes.data as AuditRecord[]).filter((audit) => {
        const auditDate = new Date(audit.auditDate).toISOString().split("T")[0];
        return auditDate === today;
      }).length;

      setStats({
        users: usersRes.data.length,
        stores: storesRes.data.length,
        audits: auditsRes.data.length,
        auditsToday,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Đang tải dữ liệu...</div>;
  }

  return (
    <div className="dashboard">
      <p className="page-kicker">Thống kê</p>
      <h2>Tổng quan hoạt động</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>{stats.users}</h3>
            <p>Người dùng</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🏪</div>
          <div className="stat-content">
            <h3>{stats.stores}</h3>
            <p>Cửa hàng</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>{stats.audits}</h3>
            <p>Chương trình</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <h3>{stats.auditsToday}</h3>
            <p>Trong ngày</p>
          </div>
        </div>
      </div>
    </div>
  );
}

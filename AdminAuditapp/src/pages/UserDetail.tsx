import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { HiArrowLeft } from "react-icons/hi2";
import api from "../services/api";
import "./UserDetail.css";

interface UserDetailItem {
  CheckinDate: string;
  AuditId: number;
  StoreName: string;
  Address: string;
  CheckinTime: string;
  Notes: string;
}

export default function UserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState<any>(null);
  const [detailData, setDetailData] = useState<UserDetailItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchUserDetail();
    }
  }, [userId]);

  const fetchUserDetail = async () => {
    try {
      setLoading(true);
      const [userRes, detailRes] = await Promise.all([
        api.get(`/users/${userId}`),
        api.get(`/dashboard/user/${userId}`),
      ]);

      setUserInfo(userRes.data);
      setDetailData(detailRes.data.data || []);
    } catch (error) {
      console.error("Error fetching user detail:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Đang tải dữ liệu...</div>;
  }

  return (
    <div className="user-detail">
      <div className="user-detail-header">
        <button className="btn-back" onClick={() => navigate("/")}>
          <HiArrowLeft /> Quay lại
        </button>
        <div>
          <p className="page-kicker">Chi tiết</p>
          <h2>{userInfo?.FullName || "Chi tiết checkin"}</h2>
        </div>
      </div>

      <div className="table-container">
        <table className="detail-table">
          <thead>
            <tr>
              <th>Ngày</th>
              <th>STT</th>
              <th>NPP/Cửa hàng</th>
              <th>Địa chỉ cửa hàng</th>
              <th>Thời Gian Checkin</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {detailData.length === 0 ? (
              <tr>
                <td colSpan={6} className="no-data-cell">
                  Không có dữ liệu
                </td>
              </tr>
            ) : (
              detailData.map((item, index) => {
                const checkinDate = new Date(item.CheckinDate);
                const checkinTime = item.CheckinTime
                  ? new Date(item.CheckinTime)
                  : null;

                return (
                  <tr key={item.AuditId}>
                    <td>{checkinDate.toLocaleDateString("vi-VN")}</td>
                    <td>{index + 1}</td>
                    <td>{item.StoreName}</td>
                    <td>{item.Address || ""}</td>
                    <td>
                      {checkinTime
                        ? checkinTime.toLocaleTimeString("vi-VN")
                        : ""}
                    </td>
                    <td>{item.Notes || ""}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


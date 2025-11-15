import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { HiArrowLeft } from "react-icons/hi2";
import api from "../services/api";
import LoadingModal from "../components/LoadingModal";
import "./StoreDetail.css";

interface Store {
  Id: number;
  StoreCode: string;
  StoreName: string;
  Address: string;
  Phone: string;
  Email: string;
  Status: string;
  Rank: number | null;
  TaxCode: string | null;
  PartnerName: string | null;
  TerritoryId: number | null;
  TerritoryName: string | null;
  UserId: number | null;
  UserFullName: string | null;
  UserCode: string | null;
  Latitude: number | null;
  Longitude: number | null;
}

interface Image {
  Id: number;
  ImageUrl: string;
  ReferenceImageUrl: string | null;
  Latitude: number | null;
  Longitude: number | null;
  CapturedAt: string;
}

interface Audit {
  AuditId: number;
  Result: string;
  Notes: string;
  AuditDate: string;
  AuditCreatedAt: string;
  UserId: number;
  UserFullName: string;
  UserCode: string;
  Images: Image[];
}

export default function StoreDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [store, setStore] = useState<Store | null>(null);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const isInitialMount = useRef(true);
  const previousId = useRef<string | undefined>(id);

  useEffect(() => {
    if (id) {
      if (isInitialMount.current) {
        // Initial load
        isInitialMount.current = false;
        previousId.current = id;
        fetchStoreDetail();
      } else if (previousId.current !== id) {
        // Navigate to different store - show loading modal
        previousId.current = id;
        fetchStoreDetail(true);
      }
    }
  }, [id]);

  const fetchStoreDetail = async (showLoading = false) => {
    try {
      if (showLoading) {
        setDataLoading(true);
      } else {
        setLoading(true);
      }
      
      const res = await api.get(`/stores/${id}`);
      const data = res.data;
      setStore({
        Id: data.Id,
        StoreCode: data.StoreCode,
        StoreName: data.StoreName,
        Address: data.Address,
        Phone: data.Phone,
        Email: data.Email,
        Status: data.Status,
        Rank: data.Rank,
        TaxCode: data.TaxCode,
        PartnerName: data.PartnerName,
        TerritoryId: data.TerritoryId,
        TerritoryName: data.TerritoryName,
        UserId: data.UserId,
        UserFullName: data.UserFullName,
        UserCode: data.UserCode,
        Latitude: data.Latitude,
        Longitude: data.Longitude,
      });
      setAudits(data.audits || []);
    } catch (error) {
      console.error("Error fetching store detail:", error);
    } finally {
      if (showLoading) {
        setDataLoading(false);
      } else {
        setLoading(false);
      }
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      not_audited: "Chưa audit",
      audited: "Đã audit",
      passed: "Đạt",
      failed: "Không đạt",
    };
    return labels[status] || status;
  };

  const getRankLabel = (rank: number | null) => {
    if (rank === 1) return "Đơn vị, tổ chức";
    if (rank === 2) return "Cá nhân";
    return "-";
  };

  const getResultLabel = (result: string) => {
    return result === "pass" ? "Đạt" : "Không đạt";
  };

  if (loading) {
    return <div className="loading">Đang tải dữ liệu...</div>;
  }

  if (!store) {
    return <div className="error">Không tìm thấy cửa hàng</div>;
  }

  return (
    <div className="store-detail">
      <LoadingModal
        isOpen={dataLoading}
        message="Đang tải dữ liệu cửa hàng..."
        progress={0}
      />
      <div className="store-detail-header">
        <button className="btn-back" onClick={() => navigate("/stores")}>
          <HiArrowLeft /> Quay lại
        </button>
        <div>
          <p className="page-kicker">Chi tiết cửa hàng</p>
          <h2>{store.StoreName}</h2>
        </div>
      </div>

      <div className="store-detail-content">
        {/* Store Information */}
        <div className="info-section">
          <h3>Thông tin cửa hàng</h3>
          <div className="info-grid">
            <div className="info-item">
              <label>Mã cửa hàng:</label>
              <span>{store.StoreCode}</span>
            </div>
            <div className="info-item">
              <label>Tên cửa hàng:</label>
              <span>{store.StoreName}</span>
            </div>
            <div className="info-item">
              <label>Loại đối tượng:</label>
              <span>{getRankLabel(store.Rank)}</span>
            </div>
            <div className="info-item">
              <label>Địa chỉ:</label>
              <span>{store.Address || "-"}</span>
            </div>
            <div className="info-item">
              <label>Mã số thuế:</label>
              <span>{store.TaxCode || "-"}</span>
            </div>
            <div className="info-item">
              <label>Tên đối tác:</label>
              <span>{store.PartnerName || "-"}</span>
            </div>
            <div className="info-item">
              <label>Số điện thoại:</label>
              <span>{store.Phone || "-"}</span>
            </div>
            <div className="info-item">
              <label>Email:</label>
              <span>{store.Email || "-"}</span>
            </div>
            <div className="info-item">
              <label>Trạng thái:</label>
              <span className={`status-badge status-${store.Status}`}>
                {getStatusLabel(store.Status)}
              </span>
            </div>
            <div className="info-item">
              <label>Địa bàn phụ trách:</label>
              <span>{store.TerritoryName || "-"}</span>
            </div>
            <div className="info-item">
              <label>User phụ trách:</label>
              <span>{store.UserFullName || "-"} {store.UserCode ? `(${store.UserCode})` : ""}</span>
            </div>
            {(store.Latitude && store.Longitude) && (
              <div className="info-item">
                <label>Tọa độ:</label>
                <span>{store.Latitude}, {store.Longitude}</span>
              </div>
            )}
          </div>
        </div>

        {/* Audits and Images */}
        {audits.length > 0 && (
          <div className="audits-section">
            <h3>Lịch sử Audit và Hình ảnh</h3>
            {audits.map((audit) => (
              <div key={audit.AuditId} className="audit-card">
                <div className="audit-header">
                  <div>
                    <p className="audit-date">
                      {new Date(audit.AuditDate).toLocaleDateString("vi-VN")}
                    </p>
                    <p className="audit-user">
                      Bởi: {audit.UserFullName} ({audit.UserCode})
                    </p>
                  </div>
                  <span className={`result-badge result-${audit.Result}`}>
                    {getResultLabel(audit.Result)}
                  </span>
                </div>
                {audit.Notes && (
                  <p className="audit-notes">{audit.Notes}</p>
                )}
                {audit.Images && audit.Images.length > 0 && (
                  <div className="audit-images">
                    {audit.Images.map((image) => (
                      <div key={image.Id} className="image-item">
                        <img
                          src={image.ImageUrl}
                          alt={`Audit ${audit.AuditId}`}
                          onClick={() => setSelectedImage(image.ImageUrl)}
                          className="audit-image"
                        />
                        {image.CapturedAt && (
                          <p className="image-caption">
                            {new Date(image.CapturedAt).toLocaleString("vi-VN")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {audits.length === 0 && (
          <div className="no-audits">
            <p>Chưa có lịch sử audit cho cửa hàng này</p>
          </div>
        )}
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div className="image-modal-overlay" onClick={() => setSelectedImage(null)}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="image-modal-close" onClick={() => setSelectedImage(null)}>
              ×
            </button>
            <img src={selectedImage} alt="Full size" className="image-modal-image" />
          </div>
        </div>
      )}
    </div>
  );
}


import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { HiArrowLeft, HiDownload, HiZoomIn, HiZoomOut } from "react-icons/hi2";
import api from "../services/api";
import LoadingModal from "../components/LoadingModal";
import NotificationModal from "../components/NotificationModal";
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
  const [selectedImage, setSelectedImage] = useState<{
    url: string;
    lat: number | null;
    lon: number | null;
  } | null>(null);
  const [imageZoom, setImageZoom] = useState(100);
  const [statusUpdateModal, setStatusUpdateModal] = useState<{
    isOpen: boolean;
    newStatus: "passed" | "failed" | null;
  }>({
    isOpen: false,
    newStatus: null,
  });
  const [notification, setNotification] = useState<{
    isOpen: boolean;
    type: "success" | "error";
    message: string;
  }>({
    isOpen: false,
    type: "success",
    message: "",
  });
  const [updateLoading, setUpdateLoading] = useState(false);
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
      
      // Add timestamp to prevent caching
      const res = await api.get(`/stores/${id}`, {
        params: { _t: Date.now() }
      });
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

  // Parse watermark to extract latitude and longitude
  // Format: "Lat:10.762622 Long:106.660172 01.11.2025 15:49:00" or "L:10.762622 Lo:106.660172 01.11.2025 15:49:00"
  const parseWatermarkCoordinates = (imageUrl: string): { lat: number | null; lon: number | null } => {
    try {
      // Try to get coordinates from image metadata first (if available)
      // Otherwise, we need to extract from watermark text in the image
      // For now, we'll use the image's stored coordinates if available
      // This would require OCR or storing coordinates separately
      // For MVP, we'll use the store's coordinates as fallback
      return { lat: null, lon: null };
    } catch (error) {
      return { lat: null, lon: null };
    }
  };

  // Extract coordinates from image URL or use store coordinates
  const getImageCoordinates = (image: Image): { lat: number | null; lon: number | null } => {
    // Use stored coordinates if available
    if (image.Latitude && image.Longitude) {
      return { lat: image.Latitude, lon: image.Longitude };
    }
    // Fallback to store coordinates
    if (store?.Latitude && store?.Longitude) {
      return { lat: store.Latitude, lon: store.Longitude };
    }
    return { lat: null, lon: null };
  };

  const handleImageClick = (image: Image) => {
    const coords = getImageCoordinates(image);
    setSelectedImage({
      url: image.ImageUrl,
      lat: coords.lat,
      lon: coords.lon,
    });
    setImageZoom(100);
  };

  const handleZoomIn = () => {
    setImageZoom((prev) => Math.min(prev + 25, 300));
  };

  const handleZoomOut = () => {
    setImageZoom((prev) => Math.max(prev - 25, 50));
  };

  const handleDownloadImage = () => {
    if (!selectedImage) return;
    const link = document.createElement("a");
    link.href = selectedImage.url;
    link.download = `store-image-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleViewOnGoogleMaps = (lat: number | null, lon: number | null) => {
    if (!lat || !lon) return;
    const url = `https://www.google.com/maps?q=${lat},${lon}`;
    window.open(url, "_blank");
  };

  const handleStatusUpdateClick = (newStatus: "passed" | "failed") => {
    setStatusUpdateModal({
      isOpen: true,
      newStatus,
    });
  };

  const handleStatusUpdateConfirm = async () => {
    if (!store || !statusUpdateModal.newStatus) return;

    try {
      setUpdateLoading(true);
      setStatusUpdateModal({ isOpen: false, newStatus: null });

      await api.patch(`/stores/${store.Id}/status`, {
        status: statusUpdateModal.newStatus,
      });

      // Refresh store data
      await fetchStoreDetail();

      setUpdateLoading(false);
      setNotification({
        isOpen: true,
        type: "success",
        message: `Đã cập nhật trạng thái cửa hàng thành "${getStatusLabel(statusUpdateModal.newStatus)}" thành công.`,
      });
    } catch (error: unknown) {
      console.error("Error updating store status:", error);
      setUpdateLoading(false);
      const errorMessage =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Lỗi khi cập nhật trạng thái cửa hàng. Vui lòng thử lại.";
      setNotification({
        isOpen: true,
        type: "error",
        message: errorMessage,
      });
    }
  };

  // Collect all images from all audits for grid display
  const allImages: Array<Image & { auditDate: string; auditUser: string; auditResult: string }> = [];
  audits.forEach((audit) => {
    if (audit.Images && audit.Images.length > 0) {
      audit.Images.forEach((image) => {
        allImages.push({
          ...image,
          auditDate: audit.AuditDate,
          auditUser: `${audit.UserFullName} (${audit.UserCode})`,
          auditResult: audit.Result,
        });
      });
    }
  });

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
        {/* Top Section: Google Maps (left) + Store Info (right) */}
        <div className="top-section">
          {/* Google Maps */}
          {store.Latitude && store.Longitude && (
            <div className="map-section">
              <iframe
                title="Bản đồ"
                width="100%"
                height={400}
                scrolling="no"
                src={`https://maps.google.com/maps?q=${store.Latitude},${store.Longitude}&output=embed`}
                style={{ border: 0 }}
              ></iframe>
            </div>
          )}

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
                <span>
                  {store.UserFullName || "-"}{" "}
                  {store.UserCode ? `(${store.UserCode})` : ""}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Images Section */}
        {allImages.length > 0 && (
          <div className="audits-section">
            <div className="section-header">
              <h3>Lịch sử Audit và Hình ảnh</h3>
              <div className="status-action-buttons">
                <button
                  className="btn-status btn-passed"
                  onClick={() => handleStatusUpdateClick("passed")}
                >
                  Đạt
                </button>
                <button
                  className="btn-status btn-failed"
                  onClick={() => handleStatusUpdateClick("failed")}
                >
                  Không đạt
                </button>
              </div>
            </div>
            <div className="images-grid">
              {allImages.map((image, index) => {
                const coords = getImageCoordinates(image);
                return (
                  <div key={`${image.Id}-${index}`} className="image-card">
                    <img
                      src={image.ImageUrl}
                      alt={`Image ${image.Id}`}
                      onClick={() => handleImageClick(image)}
                      className="grid-image"
                    />
                    <div className="image-info">
                      <span className="image-time">
                        {image.CapturedAt
                          ? new Date(image.CapturedAt).toLocaleString("vi-VN")
                          : "-"}
                      </span>
                      {coords.lat && coords.lon && (
                        <button
                          className="btn-view-map"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewOnGoogleMaps(coords.lat, coords.lon);
                          }}
                        >
                          Xem trên Google Maps
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {allImages.length === 0 && (
          <div className="no-audits">
            <p>Chưa có lịch sử audit và hình ảnh cho cửa hàng này</p>
          </div>
        )}
      </div>

      {/* Image Modal with Zoom and Download */}
      {selectedImage && (
        <div
          className="image-modal-overlay"
          onClick={() => {
            setSelectedImage(null);
            setImageZoom(100);
          }}
        >
          <div
            className="image-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="image-modal-close"
              onClick={() => {
                setSelectedImage(null);
                setImageZoom(100);
              }}
            >
              ×
            </button>
            <div className="image-modal-toolbar">
              <button
                className="image-modal-btn"
                onClick={handleZoomOut}
                disabled={imageZoom <= 50}
              >
                <HiZoomOut /> Thu nhỏ
              </button>
              <span className="zoom-level">{imageZoom}%</span>
              <button
                className="image-modal-btn"
                onClick={handleZoomIn}
                disabled={imageZoom >= 300}
              >
                <HiZoomIn /> Phóng to
              </button>
              <button className="image-modal-btn" onClick={handleDownloadImage}>
                <HiDownload /> Tải về
              </button>
            </div>
            <div className="image-modal-image-container">
              <img
                src={selectedImage.url}
                alt="Full size"
                className="image-modal-image"
                style={{ transform: `scale(${imageZoom / 100})` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Status Update Confirmation Modal */}
      {statusUpdateModal.isOpen && (
        <div
          className="modal-overlay"
          onClick={() =>
            setStatusUpdateModal({ isOpen: false, newStatus: null })
          }
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Xác nhận cập nhật trạng thái</h3>
            <p>
              Bạn có chắc chắn muốn đánh dấu cửa hàng{" "}
              <strong>{store.StoreName}</strong> là{" "}
              <strong>
                {statusUpdateModal.newStatus === "passed" ? "Đạt" : "Không đạt"}
              </strong>
              ?
            </p>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() =>
                  setStatusUpdateModal({ isOpen: false, newStatus: null })
                }
              >
                Hủy
              </button>
              <button
                className="btn-primary"
                onClick={handleStatusUpdateConfirm}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Modal for Status Update */}
      <LoadingModal
        isOpen={updateLoading}
        message="Đang cập nhật trạng thái cửa hàng..."
        progress={0}
      />

      {/* Notification Modal */}
      <NotificationModal
        isOpen={notification.isOpen}
        type={notification.type}
        message={notification.message}
        onClose={() => setNotification({ ...notification, isOpen: false })}
        duration={3000}
      />
    </div>
  );
}


import { useEffect, useRef, useState } from "react";
import { HiDownload } from "react-icons/hi";
import { HiArrowLeft, HiArrowPath } from "react-icons/hi2";
import { useNavigate, useParams } from "react-router-dom";
import LoadingModal from "../components/LoadingModal";
import NotificationModal from "../components/NotificationModal";
import api from "../services/api";
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
  FailedReason: string | null;
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
  FailedReason: string | null;
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
  const [selectedAuditId, setSelectedAuditId] = useState<number | null>(null);
  const [auditDateDropdownOpen, setAuditDateDropdownOpen] = useState(false);
  const [auditDateSearch, setAuditDateSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    url: string;
    lat: number | null;
    lon: number | null;
  } | null>(null);
  const [imageZoom, setImageZoom] = useState(100);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [statusUpdateModal, setStatusUpdateModal] = useState<{
    isOpen: boolean;
    newStatus: "passed" | "failed" | null;
    failedReason: string;
    auditId: number | null;
  }>({
    isOpen: false,
    newStatus: null,
    failedReason: "",
    auditId: null,
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
  const [downloadingImage, setDownloadingImage] = useState(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        params: { _t: Date.now() },
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
        FailedReason: data.FailedReason || null,
      });
      const auditsData = data.audits || [];
      setAudits(auditsData);
      setSelectedAuditId((prev) => {
        if (prev && auditsData.some((audit: Audit) => audit.AuditId === prev)) {
          return prev;
        }
        return auditsData.length > 0 ? auditsData[0].AuditId : null;
      });
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
      not_audited: "Chưa thực hiện",
      audited: "Đã thực hiện",
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

  const formatAuditDateTime = (value: string) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("vi-VN", {
      hour12: false,
    });
  };

  const mapAuditResultToStoreStatus = (result?: string | null) => {
    if (!result) return "audited";
    if (result === "fail") return "failed";
    if (result === "pass") return "passed";
    return "audited";
  };

  // Extract coordinates from image URL or use store coordinates
  const getImageCoordinates = (
    image: Image
  ): { lat: number | null; lon: number | null } => {
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
    setImagePosition({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setImageZoom((prev) => {
      const newZoom = Math.min(prev + 25, 300);
      // Center image when zooming
      if (newZoom > 100) {
        setImagePosition({ x: 0, y: 0 });
      }
      return newZoom;
    });
  };

  const handleZoomOut = () => {
    setImageZoom((prev) => {
      const newZoom = Math.max(prev - 25, 50);
      // Reset position when zooming out to 100% or less
      if (newZoom <= 100) {
        setImagePosition({ x: 0, y: 0 });
      }
      return newZoom;
    });
  };

  const handleResetZoom = () => {
    setImageZoom(100);
    setImagePosition({ x: 0, y: 0 });
  };

  // Handle mouse wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -10 : 10;
    const newZoom = Math.max(50, Math.min(300, imageZoom + delta));
    setImageZoom(newZoom);

    // Reset position if zoomed out to 100% or less
    if (newZoom <= 100) {
      setImagePosition({ x: 0, y: 0 });
    }
  };

  // Handle mouse drag to pan image when zoomed
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (imageZoom > 100) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - imagePosition.x,
        y: e.clientY - imagePosition.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging && imageZoom > 100) {
      setImagePosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDownloadImage = async () => {
    if (!selectedImage || downloadingImage) return;
    try {
      setDownloadingImage(true);
      const response = await fetch(selectedImage.url, { mode: "cors" });
      if (!response.ok) {
        throw new Error("Không thể tải ảnh");
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `store-image-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Error downloading image:", error);
      setNotification({
        isOpen: true,
        type: "error",
        message: "Không thể tải ảnh. Vui lòng thử lại.",
      });
    } finally {
      setDownloadingImage(false);
    }
  };

  const handleViewOnGoogleMaps = (lat: number | null, lon: number | null) => {
    if (!lat || !lon) return;
    const url = `https://www.google.com/maps?q=${lat},${lon}`;
    window.open(url, "_blank");
  };

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleStatusUpdateClick = (newStatus: "passed" | "failed") => {
    if (!selectedAudit) {
      setNotification({
        isOpen: true,
        type: "error",
        message: "Không tìm thấy bản ghi audit để cập nhật.",
      });
      return;
    }
    setStatusUpdateModal({
      isOpen: true,
      newStatus,
      failedReason: "",
      auditId: selectedAudit.AuditId,
    });
  };

  const handleStatusUpdateConfirm = async () => {
    if (!store || !statusUpdateModal.newStatus) return;
    if (!statusUpdateModal.auditId) {
      setNotification({
        isOpen: true,
        type: "error",
        message: "Không xác định được ngày audit để cập nhật trạng thái.",
      });
      return;
    }

    if (
      statusUpdateModal.newStatus === "failed" &&
      !statusUpdateModal.failedReason.trim()
    ) {
      setNotification({
        isOpen: true,
        type: "error",
        message: "Vui lòng nhập lý do không đạt.",
      });
      return;
    }

    try {
      setUpdateLoading(true);
      const updatedStatus = statusUpdateModal.newStatus;
      const payload: {
        status: "passed" | "failed";
        failedReason?: string;
        auditId: number | null;
      } = {
        status: statusUpdateModal.newStatus,
        auditId: statusUpdateModal.auditId,
      };
      if (statusUpdateModal.newStatus === "failed") {
        payload.failedReason = statusUpdateModal.failedReason.trim();
      }
      setStatusUpdateModal({
        isOpen: false,
        newStatus: null,
        failedReason: "",
        auditId: null,
      });

      await api.patch(`/stores/${store.Id}/status`, payload);

      // Refresh store data
      await fetchStoreDetail();

      setUpdateLoading(false);
      setNotification({
        isOpen: true,
        type: "success",
        message: `Đã cập nhật trạng thái cửa hàng thành "${getStatusLabel(
          updatedStatus
        )}" thành công.`,
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

  const handleResetStoreConfirm = async () => {
    if (!store || !selectedAudit) {
      setNotification({
        isOpen: true,
        type: "error",
        message: "Không xác định được ngày audit để làm lại.",
      });
      return;
    }
    try {
      setResetLoading(true);
      setResetModalOpen(false);
      await api.delete(`/audits/${selectedAudit.AuditId}`);
      await fetchStoreDetail();
      setResetLoading(false);
      setNotification({
        isOpen: true,
        type: "success",
        message: "Đã xoá dữ liệu audit của ngày đã chọn.",
      });
    } catch (error: unknown) {
      console.error("Error resetting store audits:", error);
      setResetLoading(false);
      const errorMessage =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Không thể làm mới dữ liệu cửa hàng. Vui lòng thử lại.";
      setNotification({
        isOpen: true,
        type: "error",
        message: errorMessage,
      });
    }
  };

  const selectedAudit =
    audits.find((audit) => audit.AuditId === selectedAuditId) || null;
  const effectiveStatus =
    selectedAudit && store
      ? mapAuditResultToStoreStatus(selectedAudit.Result)
      : store?.Status || "not_audited";
  const selectedImages = selectedAudit?.Images || [];
  const selectedFailedReason =
    effectiveStatus === "failed" ? selectedAudit?.FailedReason || null : null;
  const filteredAudits = audits.filter((audit) =>
    formatAuditDateTime(audit.AuditDate)
      .toLowerCase()
      .includes(auditDateSearch.toLowerCase())
  );

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
      </div>

      <div className="store-detail-content">
        {/* Main Section: Store Info (left) + Google Maps (right) */}
        <div className="main-section">
          {/* Store Information - Left Panel */}
          <div className="info-section">
            <h3 className="info-section-title">{store.StoreName}</h3>
            <div className="info-list">
              <div className="info-item">
                <label>Mã cửa hàng:</label>
                <span>{store.StoreCode}</span>
              </div>
              <div className="info-item">
                <label>Địa bàn phụ trách:</label>
                <span>{store.TerritoryName || "-"}</span>
              </div>
              <div className="info-item">
                <label>Loại đối tượng:</label>
                <span>{getRankLabel(store.Rank)}</span>
              </div>
              <div className="info-item">
                <label>Thông tin liên hệ:</label>
                <span>
                  {store.Phone || "-"}
                  {store.Phone && store.PartnerName ? " - " : ""}
                  {store.PartnerName || ""}
                </span>
              </div>
              <div className="info-item">
                <label>User phụ trách:</label>
                <span>
                  {store.UserFullName || "-"}{" "}
                  {store.UserCode ? `(${store.UserCode})` : ""}
                </span>
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
                <label>Email:</label>
                <span>{store.Email || "-"}</span>
              </div>
              <div className="info-item">
                <label>Trạng thái:</label>
                <span className={`status-badge status-${effectiveStatus}`}>
                  {getStatusLabel(effectiveStatus)}
                </span>
              </div>
            </div>
          </div>

          {/* Google Maps - Right Panel */}
          {store.Latitude && store.Longitude && (
            <div className="map-section">
              <iframe
                title="Bản đồ"
                width="100%"
                height="100%"
                scrolling="no"
                src={`https://maps.google.com/maps?q=${store.Latitude},${store.Longitude}&output=embed`}
                style={{ border: 0 }}
                allowFullScreen
              ></iframe>
            </div>
          )}
        </div>

        <div className="audits-section">
          <div className="section-header">
            <div className="section-title-group">
              <h3>Lịch sử Audit và Hình ảnh</h3>
              {audits.length > 0 && (
                <div className="audit-date-selector">
                  <button
                    type="button"
                    className="audit-date-button"
                    onClick={() =>
                      setAuditDateDropdownOpen(!auditDateDropdownOpen)
                    }
                  >
                    {selectedAudit
                      ? formatAuditDateTime(selectedAudit.AuditDate)
                      : "Chưa có lịch sử"}
                    <span className="chevron">
                      {auditDateDropdownOpen ? "▲" : "▼"}
                    </span>
                  </button>
                  {auditDateDropdownOpen && (
                    <div className="audit-date-dropdown">
                      <input
                        type="text"
                        className="audit-date-search"
                        placeholder="Tìm ngày..."
                        value={auditDateSearch}
                        onChange={(e) => setAuditDateSearch(e.target.value)}
                      />
                      <div className="audit-date-options">
                        {filteredAudits.length > 0 ? (
                          filteredAudits.map((audit) => (
                            <button
                              key={audit.AuditId}
                              className={`audit-date-option ${
                                selectedAuditId === audit.AuditId
                                  ? "active"
                                  : ""
                              }`}
                              onClick={() => {
                                setSelectedAuditId(audit.AuditId);
                                setAuditDateDropdownOpen(false);
                                setAuditDateSearch("");
                              }}
                            >
                              {formatAuditDateTime(audit.AuditDate)}
                            </button>
                          ))
                        ) : (
                          <div className="audit-date-empty">
                            Không tìm thấy ngày phù hợp
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="status-action-buttons">
              <button
                className="btn-status btn-passed"
                onClick={() => handleStatusUpdateClick("passed")}
                disabled={!selectedAudit}
              >
                Đạt
              </button>
              <button
                className="btn-status btn-failed"
                onClick={() => handleStatusUpdateClick("failed")}
                disabled={!selectedAudit}
              >
                Không đạt
              </button>
              <button
                className="btn-status btn-reset"
                onClick={() => setResetModalOpen(true)}
                disabled={!selectedAudit}
              >
                Làm lại
              </button>
            </div>
          </div>

          {selectedFailedReason && (
            <div className="failed-reason-box">
              <div className="failed-reason-label">Lý do không đạt:</div>
              <div className="failed-reason-text">{selectedFailedReason}</div>
            </div>
          )}

          {selectedAudit ? (
            selectedImages.length > 0 ? (
              <div className="images-grid">
                {selectedImages.map((image, index) => {
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
            ) : (
              <div className="no-audits">
                <p>
                  Chưa có hình ảnh cho ngày{" "}
                  {formatAuditDateTime(selectedAudit.AuditDate)}
                </p>
              </div>
            )
          ) : (
            <div className="no-audits">
              <p>Chưa có lịch sử audit và hình ảnh cho cửa hàng này</p>
            </div>
          )}
        </div>
      </div>

      {/* Image Modal with Zoom and Download */}
      {selectedImage && (
        <div
          className="image-modal-overlay"
          onClick={() => {
            setSelectedImage(null);
            setImageZoom(100);
            setImagePosition({ x: 0, y: 0 });
          }}
          onMouseUp={handleMouseUp}
        >
          <div
            className="image-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Bar */}
            <div className="image-modal-topbar">
              <button
                className="image-modal-close"
                onClick={() => {
                  setSelectedImage(null);
                  setImageZoom(100);
                  setImagePosition({ x: 0, y: 0 });
                }}
              >
                ×
              </button>
              <div className="image-modal-controls">
                <button
                  className="image-modal-control-btn"
                  onClick={handleZoomIn}
                  disabled={imageZoom >= 300}
                  title="Phóng to"
                >
                  +
                </button>
                <button
                  className="image-modal-control-btn"
                  onClick={handleZoomOut}
                  disabled={imageZoom <= 50}
                  title="Thu nhỏ"
                >
                  −
                </button>
                <button
                  className="image-modal-control-btn"
                  onClick={handleResetZoom}
                  title="Làm mới / Reset"
                >
                  <HiArrowPath />
                </button>
              </div>
            </div>

            {/* Image Container with Wheel Zoom and Drag */}
            <div
              className="image-modal-image-container"
              ref={imageContainerRef}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{
                cursor:
                  imageZoom > 100
                    ? isDragging
                      ? "grabbing"
                      : "grab"
                    : "default",
              }}
            >
              <div
                className="image-modal-image-wrapper"
                style={{
                  transform: `translate(${imagePosition.x}px, ${
                    imagePosition.y
                  }px) scale(${imageZoom / 100})`,
                  transformOrigin: "center center",
                }}
              >
                <img
                  src={selectedImage.url}
                  alt="Full size"
                  className="image-modal-image"
                  draggable={false}
                />
              </div>
            </div>

            {/* Bottom Toolbar */}
            <div className="image-modal-bottombar">
              <span className="zoom-level">{imageZoom}%</span>
              <button
                className="image-modal-btn"
                onClick={handleDownloadImage}
                disabled={downloadingImage}
              >
                {downloadingImage ? (
                  "Đang tải..."
                ) : (
                  <>
                    <HiDownload /> Tải về
                  </>
                )}
              </button>
              {selectedImage.lat && selectedImage.lon && (
                <button
                  className="image-modal-btn"
                  onClick={() =>
                    handleViewOnGoogleMaps(selectedImage.lat, selectedImage.lon)
                  }
                >
                  Xem trên Google Maps
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status Update Confirmation Modal */}
      {statusUpdateModal.isOpen && (
        <div
          className="modal-overlay"
          onClick={() =>
            setStatusUpdateModal({
              isOpen: false,
              newStatus: null,
              failedReason: "",
              auditId: null,
            })
          }
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Xác nhận cập nhật trạng thái</h3>
            <p>
              Bạn có chắc chắn muốn đánh dấu cửa hàng{" "}
              <strong>{store.StoreName}</strong> là{" "}
              <strong>
                {statusUpdateModal.newStatus === "passed" ? "Đạt" : "Không đạt"}
              </strong>
              ?
            </p>
            {statusUpdateModal.newStatus === "failed" && (
              <div className="modal-failed-reason-input">
                <label htmlFor="failedReason">
                  Lý do không đạt <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <textarea
                  id="failedReason"
                  value={statusUpdateModal.failedReason}
                  onChange={(e) =>
                    setStatusUpdateModal({
                      ...statusUpdateModal,
                      failedReason: e.target.value,
                    })
                  }
                  placeholder="Nhập lý do không đạt..."
                  rows={4}
                  className="failed-reason-textarea"
                />
              </div>
            )}
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() =>
                  setStatusUpdateModal({
                    isOpen: false,
                    newStatus: null,
                    failedReason: "",
                    auditId: null,
                  })
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

      {resetModalOpen && (
        <div className="modal-overlay" onClick={() => setResetModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Làm lại cửa hàng</h3>
            <p>
              Hành động này sẽ xóa dữ liệu audit ngày{" "}
              <strong>
                {selectedAudit
                  ? formatAuditDateTime(selectedAudit.AuditDate)
                  : ""}
              </strong>{" "}
              (bao gồm toàn bộ hình ảnh và kết quả chấm). Bạn có chắc chắn muốn
              làm lại?
            </p>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setResetModalOpen(false)}
              >
                Hủy
              </button>
              <button className="btn-primary" onClick={handleResetStoreConfirm}>
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

      <LoadingModal
        isOpen={resetLoading}
        message="Đang làm mới dữ liệu cửa hàng..."
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

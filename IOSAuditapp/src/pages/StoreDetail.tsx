import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
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
  Rank: number;
  TaxCode: string;
  PartnerName: string;
  TerritoryName: string;
  UserFullName: string;
  UserCode: string;
  Latitude: number | null;
  Longitude: number | null;
  FailedReason?: string | null;
}

interface CapturedImage {
  dataUrl: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  timezoneOffset: number;
}

interface StoreImage {
  Id: number;
  ImageUrl: string;
  CapturedAt: string;
  Latitude: number;
  Longitude: number;
}

interface AuditHistory {
  AuditId: number;
  Result: string;
  FailedReason: string | null;
  Notes: string;
  AuditDate: string;
  AuditCreatedAt: string;
  UserId?: number;
  userId?: number;
  Images: StoreImage[];
}

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    not_audited: "Chưa thực hiện",
    audited: "Đã thực hiện",
    passed: "Đạt",
    failed: "Không đạt",
  };
  return labels[status] || status;
};

const getStatusColor = (status: string) => {
  const colorMap: Record<string, string> = {
    not_audited: "#FF9800",
    audited: "#2196F3",
    passed: "#4CAF50",
    failed: "#F44336",
  };
  return colorMap[status] || "#999";
};

const getRankLabel = (rank: number | null) => {
  if (rank === 1) return "Đơn vị, tổ chức";
  if (rank === 2) return "Cá nhân";
  return "-";
};

const formatDateKey = (value: string | Date) => {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
};

const isSameDay = (dateStr: string, compare: Date) => {
  const targetKey = formatDateKey(dateStr);
  const compareKey = formatDateKey(compare);
  return targetKey === compareKey;
};

const getAuditStatusLabel = (result: string) => {
  switch (result) {
    case "fail":
      return "Không đạt";
    case "pass":
      return "Đạt";
    default:
      return "Đã thực hiện";
  }
};

const getAuditStatusStyle = (result: string) => {
  switch (result) {
    case "fail":
      return { backgroundColor: "#fee2e2", color: "#991b1b" };
    case "pass":
      return { backgroundColor: "#d1fae5", color: "#065f46" };
    default:
      return { backgroundColor: "#dbeafe", color: "#1e40af" };
  }
};

export default function StoreDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { colors } = useTheme();

  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [capturedImages, setCapturedImages] = useState<
    (CapturedImage | undefined)[]
  >([undefined, undefined, undefined]);
  const [audits, setAudits] = useState<AuditHistory[]>([]);
  const [allowNewAudit, setAllowNewAudit] = useState(false);
  const [showNewAuditModal, setShowNewAuditModal] = useState(false);
  const promptedDateRef = useRef<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const [currentCameraIndex, setCurrentCameraIndex] = useState<number | null>(
    null
  );
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment"
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Filter audits by current user ID
  const userAudits = audits.filter((audit) => {
    // Check if audit has UserId field (from backend) or match with current user
    return audit.UserId === user?.id || audit.userId === user?.id;
  });

  const sortedAudits = [...userAudits].sort(
    (a, b) => new Date(b.AuditDate).getTime() - new Date(a.AuditDate).getTime()
  );
  const showCameraSection = allowNewAudit || sortedAudits.length === 0;

  const fetchStore = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/stores/${id}`);
      const storeData = response.data;
      setStore(storeData);
      const auditData = storeData.audits || storeData.Audits || [];
      setAudits(auditData);
      // Filter audits by current user to check if user has any audits
      const userAuditData = auditData.filter((audit: AuditHistory) => {
        return audit.UserId === user?.id || audit.userId === user?.id;
      });
      setAllowNewAudit(userAuditData.length === 0);
    } catch (error) {
      console.error("Error fetching store:", error);
      alert("Không thể tải thông tin cửa hàng");
    } finally {
      setLoading(false);
    }
  }, [id, user?.id]);

  useEffect(() => {
    fetchStore();
  }, [fetchStore]);

  useEffect(() => {
    promptedDateRef.current = null;
  }, [id]);

  useEffect(() => {
    if (loading || !user?.id) {
      return;
    }
    // Filter audits by current user
    const userAudits = audits.filter((audit) => {
      return audit.UserId === user.id || audit.userId === user.id;
    });
    const sortedUserAudits = [...userAudits].sort(
      (a, b) =>
        new Date(b.AuditDate).getTime() - new Date(a.AuditDate).getTime()
    );
    const hasUserTodayAudit = sortedUserAudits.some((audit) =>
      isSameDay(audit.AuditDate, new Date())
    );

    if (sortedUserAudits.length === 0) {
      setShowNewAuditModal(false);
      setAllowNewAudit(true);
      return;
    }
    if (hasUserTodayAudit) {
      setShowNewAuditModal(false);
      promptedDateRef.current = formatDateKey(new Date());
      setAllowNewAudit(false);
      return;
    }
    if (!allowNewAudit) {
      const todayKey = formatDateKey(new Date());
      if (promptedDateRef.current !== todayKey) {
        setShowNewAuditModal(true);
        promptedDateRef.current = todayKey;
      }
    }
  }, [audits, user?.id, allowNewAudit, loading]);

  const handleOpenMap = () => {
    if (store?.Latitude && store?.Longitude) {
      const url = `https://www.google.com/maps?q=${store.Latitude},${store.Longitude}`;
      window.open(url, "_blank");
    }
  };

  const getCurrentLocation = (): Promise<{
    latitude: number;
    longitude: number;
  }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          reject(error);
        },
        { timeout: 10000, maximumAge: 60000 }
      );
    });
  };

  const openCamera = async (index: number) => {
    try {
      // Reset to rear camera (environment) when opening camera
      setFacingMode("environment");
      // Use rear camera (environment) instead of front camera (user)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Use rear camera
        },
      });
      streamRef.current = stream;
      setCurrentCameraIndex(index);
      setCameraModalVisible(true);

      // Wait for video element to be ready and set stream
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Ensure video plays and loads metadata
          videoRef.current.play().catch((err) => {
            console.warn("Video play error:", err);
          });
        }
      }, 100);
    } catch (error) {
      console.error("Error accessing camera:", error);
      alert(
        "Không thể truy cập camera. Vui lòng cho phép quyền truy cập camera."
      );
    }
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraModalVisible(false);
    setCurrentCameraIndex(null);
    setFacingMode("environment"); // Reset to rear camera when closing
  };

  const switchCamera = async () => {
    if (!videoRef.current || currentCameraIndex === null) return;

    try {
      // Stop current stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      // Switch facing mode
      const newFacingMode =
        facingMode === "environment" ? "user" : "environment";
      setFacingMode(newFacingMode);

      // Get new stream with switched camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: newFacingMode,
        },
      });
      streamRef.current = stream;

      // Update video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Ensure video plays
        videoRef.current.play().catch((err) => {
          console.warn("Video play error:", err);
        });
      }
    } catch (error) {
      console.error("Error switching camera:", error);
      alert("Không thể chuyển đổi camera. Vui lòng thử lại.");
    }
  };

  const captureWithHiddenVideo = async (
    stream: MediaStream,
    width: number,
    height: number
  ): Promise<string> => {
    // Create a hidden video element with exact dimensions to avoid CSS scaling issues
    const hiddenVideo = document.createElement("video");
    hiddenVideo.style.position = "absolute";
    hiddenVideo.style.top = "0";
    hiddenVideo.style.left = "0";
    hiddenVideo.style.width = `${width}px`;
    hiddenVideo.style.height = `${height}px`;
    hiddenVideo.style.objectFit = "fill"; // Use fill instead of none to ensure full frame
    hiddenVideo.style.opacity = "0";
    hiddenVideo.style.pointerEvents = "none";
    hiddenVideo.style.zIndex = "-1";
    hiddenVideo.autoplay = true;
    hiddenVideo.playsInline = true;
    hiddenVideo.muted = true;
    hiddenVideo.setAttribute("width", width.toString());
    hiddenVideo.setAttribute("height", height.toString());
    hiddenVideo.srcObject = stream;

    document.body.appendChild(hiddenVideo);

    try {
      // Wait for hidden video to be ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Hidden video timeout"));
        }, 5000);

        const onLoadedMetadata = () => {
          hiddenVideo.removeEventListener("loadedmetadata", onLoadedMetadata);
          clearTimeout(timeout);
          resolve();
        };

        hiddenVideo.addEventListener("loadedmetadata", onLoadedMetadata);
        hiddenVideo.play().catch(reject);
      });

      // Wait for video to have current frame
      await new Promise<void>((resolve) => {
        if (hiddenVideo.readyState >= 2) {
          resolve();
        } else {
          const onCanPlay = () => {
            hiddenVideo.removeEventListener("canplay", onCanPlay);
            resolve();
          };
          hiddenVideo.addEventListener("canplay", onCanPlay);
          setTimeout(resolve, 500); // Fallback timeout
        }
      });

      // Additional wait to ensure frame is fully rendered on iOS
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Create canvas with exact dimensions
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: false });
      if (!ctx) {
        throw new Error("Cannot get canvas context");
      }

      // Draw from hidden video - use natural dimensions
      // On iOS, we need to ensure we're drawing the full frame
      const videoWidth = hiddenVideo.videoWidth || width;
      const videoHeight = hiddenVideo.videoHeight || height;

      // Clear canvas first
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);

      // Draw the full video frame
      ctx.drawImage(
        hiddenVideo,
        0,
        0,
        videoWidth,
        videoHeight,
        0,
        0,
        width,
        height
      );

      return canvas.toDataURL("image/jpeg", 0.8);
    } finally {
      // Clean up hidden video element
      if (hiddenVideo.srcObject) {
        (hiddenVideo.srcObject as MediaStream)
          .getTracks()
          .forEach((track) => track.stop());
      }
      hiddenVideo.srcObject = null;
      if (document.body.contains(hiddenVideo)) {
        document.body.removeChild(hiddenVideo);
      }
    }
  };

  const waitForVideoReady = async (video: HTMLVideoElement): Promise<void> => {
    // Wait for video to have metadata and data
    if (video.readyState < 2) {
      await new Promise<void>((resolve) => {
        const onLoadedMetadata = () => {
          video.removeEventListener("loadedmetadata", onLoadedMetadata);
          resolve();
        };
        video.addEventListener("loadedmetadata", onLoadedMetadata);
        // Timeout after 3 seconds
        setTimeout(() => {
          video.removeEventListener("loadedmetadata", onLoadedMetadata);
          resolve();
        }, 3000);
      });
    }

    // Wait for video to have current data
    if (video.readyState < 2) {
      await new Promise<void>((resolve) => {
        const onLoadedData = () => {
          video.removeEventListener("loadeddata", onLoadedData);
          resolve();
        };
        video.addEventListener("loadeddata", onLoadedData);
        // Timeout after 2 seconds
        setTimeout(() => {
          video.removeEventListener("loadeddata", onLoadedData);
          resolve();
        }, 2000);
      });
    }

    // Small delay to ensure video frame is fully rendered
    await new Promise((resolve) => setTimeout(resolve, 100));
  };

  const capturePhoto = async () => {
    if (!videoRef.current || currentCameraIndex === null || !streamRef.current)
      return;

    try {
      const video = videoRef.current;
      const stream = streamRef.current;

      // Wait for video to be fully ready
      await waitForVideoReady(video);

      // Get video track from stream
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        alert("Không tìm thấy video track từ camera.");
        return;
      }

      // Get actual video dimensions from video track settings
      const settings = videoTrack.getSettings();
      const actualWidth = settings.width || video.videoWidth;
      const actualHeight = settings.height || video.videoHeight;

      // Fallback to video element dimensions if settings don't have width/height
      const width = actualWidth > 0 ? actualWidth : video.videoWidth;
      const height = actualHeight > 0 ? actualHeight : video.videoHeight;

      // Ensure video has valid dimensions
      if (width === 0 || height === 0) {
        alert("Camera chưa sẵn sàng. Vui lòng đợi một chút và thử lại.");
        return;
      }

      let dataUrl: string;

      // Try ImageCapture API first (if available)
      if (typeof ImageCapture !== "undefined") {
        try {
          const imageCapture = new ImageCapture(videoTrack);
          const blob = await imageCapture.takePhoto();
          const reader = new FileReader();
          dataUrl = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (imageCaptureError) {
          console.warn(
            "ImageCapture API failed, falling back to canvas method:",
            imageCaptureError
          );
          // Fall through to canvas method
          dataUrl = await captureWithHiddenVideo(stream, width, height);
        }
      } else {
        // Use hidden video element method
        dataUrl = await captureWithHiddenVideo(stream, width, height);
      }

      // Get location
      let latitude = 0;
      let longitude = 0;
      try {
        const location = await getCurrentLocation();
        latitude = location.latitude;
        longitude = location.longitude;
      } catch (error) {
        console.warn("Could not get location:", error);
      }

      const now = new Date();
      const capturedImage: CapturedImage = {
        dataUrl,
        latitude,
        longitude,
        timestamp: now.toISOString(),
        timezoneOffset: now.getTimezoneOffset(),
      };

      const newImages = [...capturedImages];
      newImages[currentCameraIndex] = capturedImage;
      setCapturedImages(newImages);

      closeCamera();
    } catch (error) {
      console.error("Error capturing photo:", error);
      alert("Lỗi khi chụp ảnh");
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...capturedImages];
    newImages[index] = undefined;
    setCapturedImages(newImages);
  };

  const handleComplete = () => {
    const allImagesCaptured = [0, 1, 2].every((index) => capturedImages[index]);
    if (!allImagesCaptured) {
      alert("Vui lòng chụp đủ 3 ảnh");
      return;
    }
    setNotesModalVisible(true);
  };

  const handleConfirmUpload = async () => {
    if (!user || !store) return;

    setUploading(true);
    setNotesModalVisible(false);

    try {
      // Create audit first
      const auditResponse = await api.post("/audits", {
        userId: user.id,
        storeId: store.Id,
        notes: notes.trim() || null,
        auditDate: new Date().toISOString(),
      });

      const auditId = auditResponse.data.Id;

      // Upload 3 images
      const imagesToUpload = capturedImages.filter(
        (img): img is CapturedImage => img !== undefined
      );

      const uploadPromises = imagesToUpload.map(async (img, index) => {
        // Convert data URL to blob
        const response = await fetch(img.dataUrl);
        const blob = await response.blob();

        const formData = new FormData();
        formData.append("image", blob, `image_${index + 1}.jpg`);
        formData.append("auditId", auditId.toString());
        formData.append("latitude", img.latitude.toString());
        formData.append("longitude", img.longitude.toString());
        formData.append("timestamp", img.timestamp);
        formData.append("timezoneOffset", img.timezoneOffset.toString());

        return api.post("/images/upload", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      });

      await Promise.all(uploadPromises);

      // Update store latitude/longitude from first image
      if (imagesToUpload[0]) {
        await api.put(`/stores/${store.Id}`, {
          latitude: imagesToUpload[0].latitude,
          longitude: imagesToUpload[0].longitude,
        });
      }

      setAllowNewAudit(false);

      alert("Đã hoàn thành audit cửa hàng");
      setCapturedImages([undefined, undefined, undefined]);
      setNotes("");
      fetchStore();
    } catch (error: unknown) {
      console.error("Error uploading images:", error);
      const errorMessage =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Upload ảnh thất bại";
      alert(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div
        className="store-detail-container"
        style={{ backgroundColor: colors.background }}
      >
        <div className="store-detail-header">
          <button
            className="store-detail-back-button"
            onClick={() => navigate(-1)}
            style={{ color: colors.text }}
          >
            ← Quay lại
          </button>
          <h1
            className="store-detail-header-title"
            style={{ color: colors.text }}
          >
            Chi tiết cửa hàng
          </h1>
        </div>
        <div className="store-detail-loading">
          <div
            className="store-detail-spinner"
            style={{ borderTopColor: colors.primary }}
          />
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div
        className="store-detail-container"
        style={{ backgroundColor: colors.background }}
      >
        <div className="store-detail-header">
          <button
            className="store-detail-back-button"
            onClick={() => navigate(-1)}
            style={{ color: colors.text }}
          >
            ← Quay lại
          </button>
          <h1
            className="store-detail-header-title"
            style={{ color: colors.text }}
          >
            Chi tiết cửa hàng
          </h1>
        </div>
        <div className="store-detail-empty">
          <p style={{ color: colors.text }}>Không tìm thấy cửa hàng</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="store-detail-container"
      style={{ backgroundColor: colors.background }}
    >
      {/* Header */}
      <div
        className="store-detail-header"
        style={{ borderBottomColor: colors.icon + "20" }}
      >
        <button
          className="store-detail-back-button"
          onClick={() => navigate(-1)}
          style={{ color: colors.text }}
        >
          ← Quay lại
        </button>
        <h1
          className="store-detail-header-title"
          style={{ color: colors.text }}
        >
          Chi tiết cửa hàng
        </h1>
        {store.Latitude && store.Longitude ? (
          <button
            className="store-detail-map-button"
            onClick={handleOpenMap}
            style={{ color: colors.primary }}
          >
            Xem bản đồ
          </button>
        ) : (
          <div style={{ width: "80px" }} />
        )}
      </div>

      <div className="store-detail-content">
        {/* Store Info Section */}
        <div
          className="store-detail-info-section"
          style={{ backgroundColor: colors.background }}
        >
          <div className="store-detail-info-grid">
            <div className="store-detail-info-column">
              <div className="store-detail-info-row">
                <span
                  className="store-detail-info-label"
                  style={{ color: colors.icon }}
                >
                  Mã cửa hàng:
                </span>
                <span
                  className="store-detail-info-value"
                  style={{ color: colors.text }}
                >
                  {store.StoreCode}
                </span>
              </div>
              <div className="store-detail-info-row">
                <span
                  className="store-detail-info-label"
                  style={{ color: colors.icon }}
                >
                  Tên cửa hàng:
                </span>
                <span
                  className="store-detail-info-value"
                  style={{ color: colors.text }}
                >
                  {store.StoreName}
                </span>
              </div>
              <div className="store-detail-info-row">
                <span
                  className="store-detail-info-label"
                  style={{ color: colors.icon }}
                >
                  Loại đối tượng:
                </span>
                <span
                  className="store-detail-info-value"
                  style={{ color: colors.text }}
                >
                  {getRankLabel(store.Rank)}
                </span>
              </div>
              <div className="store-detail-info-row">
                <span
                  className="store-detail-info-label"
                  style={{ color: colors.icon }}
                >
                  Địa chỉ cửa hàng:
                </span>
                <span
                  className="store-detail-info-value"
                  style={{ color: colors.text }}
                >
                  {store.Address || "-"}
                </span>
              </div>
            </div>

            <div className="store-detail-info-column">
              <div className="store-detail-info-row">
                <span
                  className="store-detail-info-label"
                  style={{ color: colors.icon }}
                >
                  Địa bàn phụ trách:
                </span>
                <span
                  className="store-detail-info-value"
                  style={{ color: colors.text }}
                >
                  {store.TerritoryName || "-"}
                </span>
              </div>
              <div className="store-detail-info-row">
                <span
                  className="store-detail-info-label"
                  style={{ color: colors.icon }}
                >
                  Tên đối tác:
                </span>
                <span
                  className="store-detail-info-value"
                  style={{ color: colors.text }}
                >
                  {store.PartnerName || "-"}
                </span>
              </div>
              <div className="store-detail-info-row">
                <span
                  className="store-detail-info-label"
                  style={{ color: colors.icon }}
                >
                  Thông tin liên hệ:
                </span>
                <span
                  className="store-detail-info-value"
                  style={{ color: colors.text }}
                >
                  {store.Phone || "-"}
                </span>
              </div>
              <div className="store-detail-info-row">
                <span
                  className="store-detail-info-label"
                  style={{ color: colors.icon }}
                >
                  Nhân viên Phụ trách:
                </span>
                <span
                  className="store-detail-info-value"
                  style={{ color: colors.text }}
                >
                  {store.UserFullName || "-"}{" "}
                  {store.UserCode ? `(${store.UserCode})` : ""}
                </span>
              </div>
              <div className="store-detail-info-row">
                <span
                  className="store-detail-info-label"
                  style={{ color: colors.icon }}
                >
                  Trạng thái:
                </span>
                <span
                  className="store-detail-status-badge"
                  style={{ backgroundColor: getStatusColor(store.Status) }}
                >
                  {getStatusLabel(store.Status)}
                </span>
              </div>
              {store.Status === "failed" && store.FailedReason && (
                <div className="store-detail-info-row">
                  <span
                    className="store-detail-info-label"
                    style={{ color: colors.icon }}
                  >
                    Lý do không đạt:
                  </span>
                  <div className="store-detail-failed-reason-box">
                    <span style={{ color: colors.text }}>
                      {store.FailedReason}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* New Audit Modal */}
        {showNewAuditModal && (
          <div className="store-detail-modal-overlay">
            <div className="store-detail-modal-content">
              <h2 className="store-detail-modal-title">Thực thi ngày mới</h2>
              <p className="store-detail-modal-message">
                Bạn có muốn thực thi cho ngày hôm nay không?
              </p>
              <div className="store-detail-modal-buttons">
                <button
                  className="store-detail-modal-button store-detail-modal-button-cancel"
                  onClick={() => {
                    setShowNewAuditModal(false);
                    setAllowNewAudit(false);
                  }}
                >
                  Để sau
                </button>
                <button
                  className="store-detail-modal-button store-detail-modal-button-confirm"
                  onClick={() => {
                    setShowNewAuditModal(false);
                    setAllowNewAudit(true);
                  }}
                  style={{ backgroundColor: colors.primary, color: "#fff" }}
                >
                  Bắt đầu
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Camera Section */}
        {showCameraSection && (
          <div
            className="store-detail-camera-section"
            style={{ backgroundColor: colors.background }}
          >
            <h2
              className="store-detail-section-title"
              style={{ color: colors.text }}
            >
              Chụp ảnh {sortedAudits.length > 0 ? "ngày hôm nay" : ""}
            </h2>
            <div className="store-detail-camera-grid">
              {[0, 1, 2].map((index) => {
                const image = capturedImages[index];
                return (
                  <div key={index} className="store-detail-camera-item">
                    {image ? (
                      <div className="store-detail-captured-image-container">
                        <img
                          src={image.dataUrl}
                          alt={`Captured ${index + 1}`}
                          className="store-detail-captured-image"
                        />
                        <button
                          className="store-detail-remove-button"
                          onClick={() => removeImage(index)}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        className="store-detail-camera-button"
                        onClick={() => openCamera(index)}
                        style={{ borderColor: colors.icon + "40" }}
                      >
                        📷
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              className="store-detail-complete-button"
              onClick={handleComplete}
              disabled={
                !capturedImages.every((img) => img !== undefined) || uploading
              }
              style={{
                backgroundColor:
                  capturedImages.every((img) => img !== undefined) && !uploading
                    ? colors.primary
                    : colors.icon + "40",
                color: "#fff",
              }}
            >
              {uploading ? "Đang tải..." : "Hoàn thành"}
            </button>
          </div>
        )}

        {/* Audit History */}
        {sortedAudits.length > 0 && (
          <div
            className="store-detail-history-section"
            style={{ backgroundColor: colors.background }}
          >
            <h2
              className="store-detail-section-title"
              style={{ color: colors.text }}
            >
              Lịch sử các ngày trước
            </h2>
            {sortedAudits.map((audit) => {
              const badgeStyle = getAuditStatusStyle(audit.Result);
              return (
                <div key={audit.AuditId} className="store-detail-history-card">
                  <div className="store-detail-history-header">
                    <div>
                      <p
                        className="store-detail-history-date"
                        style={{ color: colors.text }}
                      >
                        {new Date(audit.AuditDate).toLocaleString("vi-VN", {
                          hour12: false,
                        })}
                      </p>
                      {audit.Notes && (
                        <p
                          className="store-detail-history-notes"
                          style={{ color: colors.icon }}
                        >
                          {audit.Notes}
                        </p>
                      )}
                    </div>
                    <span
                      className="store-detail-history-status-badge"
                      style={{
                        backgroundColor: badgeStyle.backgroundColor,
                        color: badgeStyle.color,
                      }}
                    >
                      {getAuditStatusLabel(audit.Result)}
                    </span>
                  </div>
                  {audit.FailedReason && (
                    <div className="store-detail-history-failed-reason">
                      <span style={{ color: colors.text }}>
                        Lý do: {audit.FailedReason}
                      </span>
                    </div>
                  )}
                  <div className="store-detail-history-images">
                    {audit.Images.map((img) => (
                      <div
                        key={img.Id}
                        className="store-detail-history-image-wrapper"
                      >
                        <img
                          src={img.ImageUrl}
                          alt="Audit"
                          className="store-detail-history-image"
                          onClick={() => {
                            setSelectedImage(img.ImageUrl);
                            setImageModalVisible(true);
                          }}
                        />
                        <p
                          className="store-detail-history-image-time"
                          style={{ color: colors.icon }}
                        >
                          {new Date(img.CapturedAt).toLocaleString("vi-VN", {
                            hour12: false,
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Camera Modal */}
      {cameraModalVisible && (
        <div className="store-detail-camera-modal-overlay">
          <div className="store-detail-camera-modal-content">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="store-detail-camera-video"
            />
            <div className="store-detail-camera-modal-buttons">
              <button
                className="store-detail-camera-modal-button"
                onClick={closeCamera}
              >
                Hủy
              </button>
              <button
                className="store-detail-camera-modal-button store-detail-camera-modal-button-switch"
                onClick={switchCamera}
                title={
                  facingMode === "environment"
                    ? "Chuyển sang camera trước"
                    : "Chuyển sang camera sau"
                }
              >
                <span className="camera-switch-icon">
                  {facingMode === "environment" ? "⇄" : "⇄"}
                </span>
              </button>
              <button
                className="store-detail-camera-modal-button store-detail-camera-modal-button-capture"
                onClick={capturePhoto}
                style={{ backgroundColor: colors.primary, color: "#fff" }}
              >
                Chụp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {notesModalVisible && (
        <div className="store-detail-modal-overlay">
          <div className="store-detail-modal-content">
            <h2 className="store-detail-modal-title">Ghi chú</h2>
            <textarea
              className="store-detail-notes-textarea"
              placeholder="Nhập ghi chú (tùy chọn)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
            <div className="store-detail-modal-buttons">
              <button
                className="store-detail-modal-button store-detail-modal-button-cancel"
                onClick={() => setNotesModalVisible(false)}
              >
                Hủy
              </button>
              <button
                className="store-detail-modal-button store-detail-modal-button-confirm"
                onClick={handleConfirmUpload}
                disabled={uploading}
                style={{ backgroundColor: colors.primary, color: "#fff" }}
              >
                {uploading ? "Đang tải..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Modal */}
      {imageModalVisible && selectedImage && (
        <div
          className="store-detail-modal-overlay"
          onClick={() => setImageModalVisible(false)}
        >
          <div
            className="store-detail-image-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedImage}
              alt="Full size"
              className="store-detail-image-modal-image"
            />
            <button
              className="store-detail-image-modal-close"
              onClick={() => setImageModalVisible(false)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

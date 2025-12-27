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

// Helper function to compress image using canvas
const compressImage = (
  dataUrl: string,
  maxWidth: number,
  quality: number
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Calculate new dimensions
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      // Create canvas and draw resized image
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Cannot get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob with compression
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to compress image"));
          }
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
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
  const [uploadProgress, setUploadProgress] = useState({
    current: 0,
    total: 0,
    message: "",
  });
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
      
      // Replace audits completely (don't merge) to prevent showing previous store's audits
      const sortedAudits = auditData.sort(
        (a: AuditHistory, b: AuditHistory) =>
          new Date(b.AuditDate).getTime() - new Date(a.AuditDate).getTime()
      );
      setAudits(sortedAudits);
      
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

  // Refresh when navigating back from survey page
  useEffect(() => {
    const handleFocus = () => {
      fetchStore();
    };
    // Listen for page visibility change (when user navigates back)
    document.addEventListener("visibilitychange", handleFocus);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleFocus);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchStore]);

  useEffect(() => {
    // Clear all state when store ID changes (navigating to different store)
    promptedDateRef.current = null;
    setCapturedImages([undefined, undefined, undefined]);
    setNotes("");
    setAudits([]); // Clear audits to prevent showing previous store's audits
    setStore(null); // Clear store data
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
      // Clear captured images if user has completed audit today (navigated back from survey)
      setCapturedImages([undefined, undefined, undefined]);
      setNotes("");
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

  // Direct capture from visible video element - more reliable for iOS
  const captureDirectFromVideo = async (
    video: HTMLVideoElement,
    width: number,
    height: number
  ): Promise<string> => {
    // Wait a bit more to ensure current frame is fully rendered
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Get the actual video dimensions (source resolution) - this is the true video size
    // These are the native dimensions of the video stream, not the CSS-scaled element
    const videoWidth = video.videoWidth || width;
    const videoHeight = video.videoHeight || height;

    // Ensure we have valid dimensions
    if (videoWidth === 0 || videoHeight === 0) {
      throw new Error("Invalid video dimensions");
    }

    // Create canvas with exact dimensions matching video source (no extra space)
    // This ensures no white background padding
    const canvas = document.createElement("canvas");
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    const ctx = canvas.getContext("2d", {
      willReadFrequently: false,
      alpha: false, // No alpha for JPEG
    });

    if (!ctx) {
      throw new Error("Cannot get canvas context");
    }

    // Fill canvas with black background first (will be covered by video)
    // Using black instead of white to avoid white artifacts if video doesn't fill
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, videoWidth, videoHeight);

    // Draw the video frame directly - this will fill the entire canvas
    // Using the simplest form of drawImage to ensure full frame capture
    // This draws the entire video frame to fill the entire canvas
    ctx.drawImage(video, 0, 0, videoWidth, videoHeight);

    // Convert to JPEG
    // The video should fill the entire canvas, so no white/black background should be visible
    return canvas.toDataURL("image/jpeg", 0.9);
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

      // Get actual video dimensions from video track settings (this is the source resolution)
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

      // For iOS Safari, we need a more reliable method
      // Try ImageCapture API first (if available and working)
      if (typeof ImageCapture !== "undefined") {
        try {
          const imageCapture = new ImageCapture(videoTrack);
          const blob = await imageCapture.takePhoto();

          // Convert blob to image to verify dimensions and ensure no padding
          const img = new Image();
          const objectUrl = URL.createObjectURL(blob);

          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              URL.revokeObjectURL(objectUrl);
              resolve();
            };
            img.onerror = reject;
            img.src = objectUrl;
          });

          // Create canvas with exact image dimensions (no extra space)
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            throw new Error("Cannot get canvas context");
          }

          // Draw image to canvas - this ensures no padding/background
          ctx.drawImage(img, 0, 0);

          // Convert to data URL
          dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        } catch (imageCaptureError) {
          console.warn(
            "ImageCapture API failed, using direct canvas capture:",
            imageCaptureError
          );
          // Fall through to direct canvas capture from visible video
          dataUrl = await captureDirectFromVideo(video, width, height);
        }
      } else {
        // Use direct canvas capture from visible video element
        dataUrl = await captureDirectFromVideo(video, width, height);
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
    // Navigate to survey page instead of opening notes modal
    navigate(`/stores/${store?.Id}/survey`, {
      state: {
        storeId: store?.Id,
        capturedImages: capturedImages.filter((img) => img !== undefined),
        notes: notes,
      },
    });
  };

  // Helper function to upload single image with retry
  const uploadImageWithRetry = async (
    img: CapturedImage,
    auditId: number,
    index: number,
    maxRetries = 2
  ): Promise<void> => {
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Update progress: processing image (only if not in batch mode)
        if (index >= 2) {
          setUploadProgress({
            current: index,
            total: 3,
            message:
              attempt > 0
                ? `Đang xử lý ảnh ${index + 1}/3 (thử lại lần ${
                    attempt + 1
                  })...`
              : `Đang xử lý ảnh ${index + 1}/3...`,
          });
        }

        // Resize and compress image for faster upload
        const compressedBlob = await compressImage(img.dataUrl, 800, 0.5);

        // Update progress: uploading image (only if not in batch mode)
        if (index >= 2) {
          setUploadProgress({
            current: index,
            total: 3,
            message: `Đang tải ảnh ${index + 1}/3...`,
          });
        }

        const formData = new FormData();
        formData.append("image", compressedBlob, `image_${index + 1}.jpg`);
        formData.append("auditId", auditId.toString());
        formData.append("latitude", img.latitude.toString());
        formData.append("longitude", img.longitude.toString());
        formData.append("timestamp", img.timestamp);
        formData.append("timezoneOffset", img.timezoneOffset.toString());

        await api.post("/images/upload", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        // Success - update progress (only if not in batch mode)
        if (index >= 2) {
          setUploadProgress({
            current: index + 1,
            total: 3,
            message: `Đã tải xong ảnh ${index + 1}/3`,
          });
        }

        return; // Success, exit retry loop
      } catch (error: unknown) {
        lastError = error;
        console.error(
          `Upload attempt ${attempt + 1} failed for image ${index + 1}:`,
          error
        );
        
        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * (attempt + 1))
          );
        }
      }
    }

    // All retries failed
    throw (
      lastError ||
      new Error(
        `Failed to upload image ${index + 1} after ${maxRetries + 1} attempts`
      )
    );
  };

  const handleConfirmUpload = async () => {
    if (!user || !store) return;

    setUploading(true);
    setNotesModalVisible(false);
    setUploadProgress({ current: 0, total: 3, message: "Đang tạo audit..." });

    try {
      // Create audit first
      setUploadProgress({ current: 0, total: 3, message: "Đang tạo audit..." });
      const auditResponse = await api.post("/audits", {
        userId: user.id,
        storeId: store.Id,
        notes: notes.trim() || null,
        auditDate: new Date().toISOString(),
      });

      const auditId = auditResponse.data.Id;

      // Filter out undefined images
      const imagesToUpload = capturedImages.filter(
        (img): img is CapturedImage => img !== undefined
      );

      if (imagesToUpload.length !== 3) {
        throw new Error("Vui lòng chụp đầy đủ 3 ảnh");
      }

      // Upload images in parallel batches: 2 images at once for speed
      // Upload first 2 images in parallel
      setUploadProgress({
        current: 0,
        total: 3,
        message: "Đang tải ảnh 1 và 2...",
      });

      // Track completed uploads
      let completedCount = 0;
      const updateBatchProgress = () => {
        completedCount++;
        setUploadProgress({
          current: completedCount,
          total: 3,
          message:
            completedCount === 2
            ? "Đã tải xong ảnh 1 và 2, đang tải ảnh 3..."
            : `Đang tải ảnh 1 và 2... (${completedCount}/2)`,
        });
      };

      const [upload1Result, upload2Result] = await Promise.allSettled([
        uploadImageWithRetry(imagesToUpload[0], auditId, 0).then(() => {
          updateBatchProgress();
        }),
        uploadImageWithRetry(imagesToUpload[1], auditId, 1).then(() => {
          updateBatchProgress();
        }),
      ]);

      // Check if any upload failed
      if (upload1Result.status === "rejected") {
        throw upload1Result.reason;
      }
      if (upload2Result.status === "rejected") {
        throw upload2Result.reason;
      }

      // Upload third image
      await uploadImageWithRetry(imagesToUpload[2], auditId, 2);

      // Update store latitude/longitude from first image
      setUploadProgress({
        current: 3,
        total: 3,
        message: "Đang cập nhật thông tin cửa hàng...",
      });

      if (imagesToUpload[0]) {
        await api.put(`/stores/${store.Id}`, {
          latitude: imagesToUpload[0].latitude,
          longitude: imagesToUpload[0].longitude,
        });
      }

      // Optimistic update: Update UI immediately without full reload
      setAllowNewAudit(false);
      setCapturedImages([undefined, undefined, undefined]);
      setNotes("");

      // Create optimistic audit entry for immediate UI update
      const optimisticAudit: AuditHistory = {
        AuditId: auditId,
        Result: "audited",
        FailedReason: null,
        Notes: notes.trim() || "",
        AuditDate: new Date().toISOString(),
        AuditCreatedAt: new Date().toISOString(),
        UserId: user.id,
        userId: user.id,
        Images: imagesToUpload.map((img) => ({
          Id: 0, // Temporary ID
          ImageUrl: img.dataUrl, // Use local dataUrl temporarily
          CapturedAt: img.timestamp,
          Latitude: img.latitude,
          Longitude: img.longitude,
        })),
      };

      // Add to audits list optimistically
      setAudits((prev) => [optimisticAudit, ...prev]);

      // Debounce fetchStore: reload after 2 seconds in background
      setTimeout(() => {
        fetchStore().catch((error) => {
          console.error("Background fetch error:", error);
          // Silent fail - optimistic update already shown
        });
      }, 2000);

      alert("Đã hoàn thành audit cửa hàng");
    } catch (error: unknown) {
      console.error("Error uploading images:", error);
      const errorMessage =
        (
          error as {
            response?: { data?: { error?: string }; message?: string };
          }
        )?.response?.data?.error ||
        (error as Error)?.message ||
        "Upload ảnh thất bại";
      alert(errorMessage);
    } finally {
      setUploading(false);
      setUploadProgress({ current: 0, total: 0, message: "" });
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
            onClick={() => {
              // Check if we can go back, otherwise navigate to stores list
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate("/stores");
              }
            }}
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
            onClick={() => {
              // Check if we can go back, otherwise navigate to stores list
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate("/stores");
              }
            }}
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
              {uploading ? "Đang tải..." : "Tiếp tục"}
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

      {/* Upload Progress Modal */}
      {uploading && (
        <div className="store-detail-modal-overlay">
          <div className="store-detail-modal-content">
            <div style={{ textAlign: "center" }}>
              <div
                className="store-detail-spinner"
                style={{
                  width: "40px",
                  height: "40px",
                  border: `4px solid ${colors.icon}20`,
                  borderTop: `4px solid ${colors.primary}`,
                  borderRadius: "50%",
                  margin: "0 auto 16px",
                }}
              />
              <h2
                className="store-detail-modal-title"
                style={{ color: colors.text, marginBottom: "8px" }}
              >
                {uploadProgress.message || "Đang xử lý..."}
              </h2>
              {uploadProgress.total > 0 && (
                <div style={{ marginTop: "16px" }}>
                  <div
                    style={{
                      width: "100%",
                      height: "8px",
                      backgroundColor: colors.icon + "20",
                      borderRadius: "4px",
                      overflow: "hidden",
                      marginBottom: "8px",
                    }}
                  >
                    <div
                      style={{
                        width: `${
                          (uploadProgress.current / uploadProgress.total) * 100
                        }%`,
                        height: "100%",
                        backgroundColor: colors.primary,
                        borderRadius: "4px",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                  <p
                    style={{ color: colors.icon, fontSize: "14px", margin: 0 }}
                  >
                    {uploadProgress.current}/{uploadProgress.total} ảnh
                  </p>
                </div>
              )}
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

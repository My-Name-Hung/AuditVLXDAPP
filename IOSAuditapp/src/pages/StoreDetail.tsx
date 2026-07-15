import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import api from "../services/api";
import {
  clearPendingUploadsForStore,
  getPendingUploadForStore,
  removePendingUpload,
  savePendingUpload,
} from "../utils/pendingUploads";
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
  // Optimized URLs (mới từ backend)
  optimizedUrl?: string;
  optimizedUrls?: {
    thumbnail: string;
    small: string;
    medium: string;
    large: string;
    original: string;
  };
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
    "0",
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
  quality: number,
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
        quality,
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
  const previousStoreIdRef = useRef<number | null>(null);
  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const [currentCameraIndex, setCurrentCameraIndex] = useState<number | null>(
    null,
  );
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment",
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Track các auditId đã upload để tránh duplicate
  const uploadedAuditIdsRef = useRef<Set<number>>(new Set());

  // Filter audits by current user ID
  const userAudits = audits.filter((audit) => {
    // Check if audit has UserId field (from backend) or match with current user
    return audit.UserId === user?.id || audit.userId === user?.id;
  });

  const sortedAudits = [...userAudits].sort(
    (a, b) => new Date(b.AuditDate).getTime() - new Date(a.AuditDate).getTime(),
  );
  const showCameraSection = allowNewAudit || sortedAudits.length === 0;

  const fetchStore = useCallback(async () => {
    // Capture id tại thời điểm fetch được gọi
    const fetchStoreId = id;
    if (!fetchStoreId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await api.get(`/stores/${fetchStoreId}`);

      // Kiểm tra lại id hiện tại sau khi fetch xong
      if (id !== fetchStoreId) {
        console.log("Store ID changed during fetch, ignoring response");
        return;
      }

      const storeData = response.data;

      // Kiểm tra lại id một lần nữa trước khi set state
      if (id !== fetchStoreId) {
        console.log("Store ID changed before setting state, ignoring response");
        return;
      }

      setStore(storeData);
      const auditData = storeData.audits || storeData.Audits || [];

      // Replace audits completely (don't merge) to prevent showing previous store's audits
      const sortedAudits = auditData.sort(
        (a: AuditHistory, b: AuditHistory) =>
          new Date(b.AuditDate).getTime() - new Date(a.AuditDate).getTime(),
      );

      // Kiểm tra lại id một lần nữa trước khi set audits
      if (id !== fetchStoreId) {
        console.log(
          "Store ID changed before setting audits, ignoring response",
        );
        return;
      }

      setAudits(sortedAudits);

      // Filter audits by current user to check if user has any audits
      const userAuditData = auditData.filter((audit: AuditHistory) => {
        return audit.UserId === user?.id || audit.userId === user?.id;
      });

      // Kiểm tra lại id một lần nữa trước khi set allowNewAudit
      if (id !== fetchStoreId) {
        console.log(
          "Store ID changed before setting allowNewAudit, ignoring response",
        );
        return;
      }

      setAllowNewAudit(userAuditData.length === 0);
    } catch (error) {
      // Chỉ hiển thị lỗi nếu id vẫn khớp
      if (id === fetchStoreId) {
        console.error("Error fetching store:", error);
        alert("Không thể tải thông tin cửa hàng");
      }
    } finally {
      // Chỉ set loading false nếu id vẫn khớp
      if (id === fetchStoreId) {
        setLoading(false);
      }
    }
  }, [id, user?.id]);

  useEffect(() => {
    fetchStore();
  }, [fetchStore]);

  // Clear capturedImages và notes khi component mount lần đầu (tránh restore từ locationState)
  useEffect(() => {
    setCapturedImages([undefined, undefined, undefined]);
    setNotes("");
  }, []); // Chỉ chạy một lần khi mount

  // QUAN TRỌNG: Force clear capturedImages mỗi khi id thay đổi
  // Effect này phải chạy TRƯỚC tất cả các effects khác
  useEffect(() => {
    console.log("[StoreDetail] Force clearing capturedImages for store:", id);
    setCapturedImages([undefined, undefined, undefined]);
    setNotes("");
  }, [id]);

  // Load pending uploads từ localStorage khi mount và tự động upload
  // QUAN TRỌNG: Effect này phải chạy SAU effect clear state (dựa vào dependency order)
  useEffect(() => {
    if (!id || !user?.id) return;

    // Capture storeId tại thời điểm effect được tạo
    const currentStoreId = parseInt(id, 10);
    if (isNaN(currentStoreId)) return;

    // QUAN TRỌNG: Clear capturedImages NGAY LẬP TỨC khi mount (tránh hiển thị ảnh của store khác)
    // Phải clear trước khi load pending uploads
    console.log(
      "[StoreDetail] Loading pending uploads for store:",
      currentStoreId,
    );
    setCapturedImages([undefined, undefined, undefined]);
    setNotes("");

    // QUAN TRỌNG: Đảm bảo pending uploads của store cũ đã được xóa
    // Kiểm tra lại một lần nữa để chắc chắn
    if (
      previousStoreIdRef.current !== null &&
      previousStoreIdRef.current !== currentStoreId
    ) {
      console.log(
        "[StoreDetail] Defensive clear pending uploads for old store:",
        previousStoreIdRef.current,
      );
      // Xóa lại một lần nữa để đảm bảo (defensive)
      clearPendingUploadsForStore(previousStoreIdRef.current);
    }

    // Cleanup function để cancel pending operations
    let isCancelled = false;
    let uploadTimeout: ReturnType<typeof setTimeout> | null = null;

    const loadAndUploadPending = async () => {
      try {
        // Kiểm tra lại storeId hiện tại
        const checkStoreId = parseInt(id || "0", 10);
        if (
          checkStoreId !== currentStoreId ||
          isNaN(checkStoreId) ||
          isCancelled
        ) {
          // Đảm bảo capturedImages được clear nếu storeId không khớp
          setCapturedImages([undefined, undefined, undefined]);
          setNotes("");
          return; // Store ID changed or cancelled, don't load
        }

        // Đảm bảo capturedImages vẫn được clear trước khi load pending
        setCapturedImages([undefined, undefined, undefined]);
        setNotes("");

        const pending = getPendingUploadForStore(currentStoreId);

        // Kiểm tra lại storeId một lần nữa sau sync operation
        const finalCheckStoreId = parseInt(id || "0", 10);
        if (finalCheckStoreId !== currentStoreId || isCancelled) {
          // Đảm bảo clear nếu storeId không khớp
          setCapturedImages([undefined, undefined, undefined]);
          setNotes("");
          return; // Store ID changed or cancelled
        }

        // QUAN TRỌNG: Kiểm tra lại storeId của pending upload có khớp với store hiện tại không
        // Phải match CHÍNH XÁC với currentStoreId
        // QUAN TRỌNG: KHÔNG BAO GIỜ set capturedImages từ pending uploads
        // Chỉ thêm vào audits để hiển thị trong lịch sử
        if (
          pending &&
          pending.storeId === currentStoreId &&
          pending.storeId === finalCheckStoreId &&
          pending.images.length > 0
        ) {
          console.log(
            "[StoreDetail] Adding optimistic audit for pending upload, storeId:",
            pending.storeId,
          );
          // QUAN TRỌNG: Đảm bảo capturedImages vẫn được clear (defensive)
          setCapturedImages([undefined, undefined, undefined]);
          setNotes("");

          // Kiểm tra xem audit này đã được upload chưa
          if (uploadedAuditIdsRef.current.has(pending.auditId)) {
            console.log("Audit already uploaded, skipping");
            // Xóa pending upload vì đã upload rồi
            removePendingUpload(currentStoreId, pending.auditId);
            return;
          }

          // Kiểm tra lại storeId một lần nữa trước khi thêm
          const addCheckStoreId = parseInt(id || "0", 10);
          if (
            addCheckStoreId !== currentStoreId ||
            addCheckStoreId !== pending.storeId ||
            addCheckStoreId !== finalCheckStoreId ||
            isCancelled
          ) {
            // Đảm bảo clear nếu storeId không khớp
            setCapturedImages([undefined, undefined, undefined]);
            setNotes("");
            return; // Store ID changed or cancelled, don't add
          }

          // Tạo optimistic audit entry với ảnh local (đã có watermark từ dataUrl)
          const optimisticAudit: AuditHistory = {
            AuditId: pending.auditId,
            Result: "audited",
            FailedReason: null,
            Notes: pending.notes || "",
            AuditDate: new Date(pending.timestamp).toISOString(),
            AuditCreatedAt: new Date(pending.timestamp).toISOString(),
            UserId: user.id,
            userId: user.id,
            Images: pending.images.map((img, idx) => ({
              Id: -(idx + 1), // Use negative ID to avoid conflicts
              ImageUrl: img.dataUrl, // Sử dụng ảnh local với watermark ngay lập tức
              CapturedAt: img.timestamp,
              Latitude: img.latitude,
              Longitude: img.longitude,
            })),
          };

          // Thêm vào danh sách audits ngay lập tức (ảnh local)
          setAudits((prev) => {
            // Kiểm tra lại storeId một lần nữa trước khi thêm
            const checkStoreId = parseInt(id || "0", 10);
            if (
              checkStoreId !== currentStoreId ||
              checkStoreId !== pending.storeId ||
              isCancelled
            ) {
              return prev; // Store ID changed or cancelled, don't add
            }

            // Check if audit already exists to avoid duplicates
            const exists = prev.some((a) => a.AuditId === pending.auditId);
            if (exists) {
              return prev; // Don't add if already exists
            }
            return [optimisticAudit, ...prev];
          });

          // Tự động upload ảnh ở background sau khi hiển thị (delay 500ms)
          uploadTimeout = setTimeout(() => {
            (async () => {
              try {
                // Kiểm tra lại storeId trước khi upload
                const checkStoreId = parseInt(id || "0", 10);
                if (
                  checkStoreId !== currentStoreId ||
                  checkStoreId !== pending.storeId ||
                  isCancelled
                ) {
                  console.log("Store ID changed or cancelled, skipping upload");
                  return; // Don't upload if store changed or cancelled
                }

                // Kiểm tra lại xem đã upload chưa (double check)
                if (uploadedAuditIdsRef.current.has(pending.auditId)) {
                  console.log(
                    "Audit already uploaded (double check), skipping",
                  );
                  removePendingUpload(currentStoreId, pending.auditId);
                  return;
                }

                // Đánh dấu đang upload để tránh duplicate
                uploadedAuditIdsRef.current.add(pending.auditId);

                const uploadImage = async (
                  img: {
                    dataUrl: string;
                    latitude: number;
                    longitude: number;
                    timestamp: string;
                    timezoneOffset: number;
                  },
                  index: number,
                ) => {
                  const formData = new FormData();
                  const blob = await fetch(img.dataUrl).then((r) => r.blob());
                  formData.append("image", blob, `image_${index + 1}.jpg`);
                  formData.append("auditId", pending.auditId.toString());
                  formData.append("latitude", img.latitude.toString());
                  formData.append("longitude", img.longitude.toString());
                  formData.append("timestamp", img.timestamp);
                  formData.append(
                    "timezoneOffset",
                    img.timezoneOffset.toString(),
                  );

                  return api.post("/images/upload", formData, {
                    headers: {
                      "Content-Type": "multipart/form-data",
                    },
                  });
                };

                // Upload tất cả ảnh pending ở background (parallel, dynamic)
                const uploadResults = await Promise.allSettled(
                  pending.images.map((image, index) =>
                    uploadImage(image, index),
                  ),
                );

                const successCount = uploadResults.filter(
                  (result) => result.status === "fulfilled",
                ).length;
                const failedCount = uploadResults.filter(
                  (result) => result.status === "rejected",
                ).length;
                const allSuccess = failedCount === 0;

                if (failedCount > 0) {
                  console.warn(
                    `Pending upload web: ${successCount} images uploaded successfully, ${failedCount} images failed`,
                  );
                }

                // Kiểm tra lại storeId trước khi cập nhật
                const finalStoreId = parseInt(id || "0", 10);
                if (
                  finalStoreId === currentStoreId &&
                  finalStoreId === pending.storeId &&
                  !isCancelled
                ) {
                  // Cập nhật tọa độ cửa hàng sau khi upload xong
                  if (pending.images[0]) {
                    await api.put(`/stores/${currentStoreId}`, {
                      latitude: pending.images[0].latitude,
                      longitude: pending.images[0].longitude,
                    });
                  }

                  // Chỉ xóa pending upload khi tất cả ảnh trong pending đã thành công
                  if (allSuccess) {
                    removePendingUpload(currentStoreId, pending.auditId);

                    // XÓA BLOB URLs TRONG BỘ NHỚ sau khi upload thành công
                    // (Để giải phóng memory và tránh sticky images)
                    try {
                      for (const img of pending.images) {
                        if (img.dataUrl && img.dataUrl.startsWith("blob:")) {
                          try {
                            URL.revokeObjectURL(img.dataUrl);
                            console.log("Revoked blob URL:", img.dataUrl);
                          } catch (revokeError) {
                            console.warn(
                              "Error revoking blob URL:",
                              img.dataUrl,
                              revokeError,
                            );
                            // Không throw, chỉ log warning
                          }
                        }
                      }
                    } catch (cleanupError) {
                      console.warn(
                        "Error cleaning up blob URLs:",
                        cleanupError,
                      );
                      // Không throw, chỉ log warning
                    }
                  } else {
                    console.warn(
                      "Keeping pending upload due to failed image(s)",
                    );
                  }

                  // Refresh để cập nhật ảnh từ server (chỉ nếu storeId vẫn khớp)
                  const refreshCheckStoreId = parseInt(id || "0", 10);
                  if (refreshCheckStoreId === currentStoreId && !isCancelled) {
                    fetchStore().catch((error) => {
                      console.error("Error refreshing after upload:", error);
                    });
                  }
                } else {
                  // Nếu upload không thành công, xóa khỏi Set để có thể thử lại
                  uploadedAuditIdsRef.current.delete(pending.auditId);
                }
              } catch (error) {
                console.error("Background upload error:", error);
                // Xóa khỏi Set để có thể thử lại sau
                uploadedAuditIdsRef.current.delete(pending.auditId);
                // Giữ lại pending upload để thử lại sau
              }
            })();
          }, 500);
        }
      } catch (error) {
        console.error("Error loading pending upload:", error);
      }
    };

    loadAndUploadPending();

    // Cleanup function
    return () => {
      isCancelled = true;
      if (uploadTimeout) {
        clearTimeout(uploadTimeout);
      }
    };
  }, [id, user?.id, fetchStore]);

  // Refresh when navigating back from survey page
  useEffect(() => {
    // Normal refresh handlers
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
    // Clear state IMMEDIATELY when store ID changes (synchronous)
    // Phải clear audits trước để tránh hiển thị ảnh của store khác
    const currentStoreId = id ? parseInt(id, 10) : null;

    // QUAN TRỌNG: Clear capturedImages NGAY LẬP TỨC khi id thay đổi (synchronous)
    // Phải clear ngay lập tức để tránh hiển thị ảnh của store khác
    console.log(
      "[StoreDetail] Clearing state for store:",
      currentStoreId,
      "Previous:",
      previousStoreIdRef.current,
    );
    promptedDateRef.current = null;
    setCapturedImages([undefined, undefined, undefined]);
    setNotes("");
    setAudits([]); // Clear audits IMMEDIATELY to prevent showing previous store's audits
    setStore(null); // Clear store data
    // Clear uploaded audit IDs khi chuyển store
    uploadedAuditIdsRef.current.clear();

    // QUAN TRỌNG: Xóa pending uploads của store cũ NGAY LẬP TỨC (synchronous)
    // Phải xóa TRƯỚC khi load pending uploads của store mới
    if (
      previousStoreIdRef.current !== null &&
      previousStoreIdRef.current !== currentStoreId
    ) {
      console.log(
        "[StoreDetail] Clearing pending uploads for old store:",
        previousStoreIdRef.current,
      );
      // Xóa pending uploads khỏi storage (synchronous)
      clearPendingUploadsForStore(previousStoreIdRef.current);

      // Revoke blob URLs của store cũ
      try {
        const oldPending = getPendingUploadForStore(previousStoreIdRef.current);
        if (oldPending) {
          console.log(
            "[StoreDetail] Found old pending upload, revoking blob URLs",
          );
          for (const img of oldPending.images) {
            if (img.dataUrl && img.dataUrl.startsWith("blob:")) {
              try {
                URL.revokeObjectURL(img.dataUrl);
                console.log("[StoreDetail] Revoked blob URL:", img.dataUrl);
              } catch (e) {
                console.warn("[StoreDetail] Error revoking blob URL:", e);
              }
            }
          }
        } else {
          console.log("[StoreDetail] No old pending upload found");
        }
      } catch (e) {
        console.warn("[StoreDetail] Error getting old pending upload:", e);
      }
    }

    // Cập nhật previousStoreIdRef
    previousStoreIdRef.current = currentStoreId;
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
        new Date(b.AuditDate).getTime() - new Date(a.AuditDate).getTime(),
    );
    const hasUserTodayAudit = sortedUserAudits.some((audit) =>
      isSameDay(audit.AuditDate, new Date()),
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
        { timeout: 10000, maximumAge: 60000 },
      );
    });
  };

  // // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // const _openCamera = async (index: number) => {
  //   try {
  //     // Reset to rear camera (environment) when opening camera
  //     setFacingMode("environment");
  //     // Use rear camera (environment) instead of front camera (user)
  //     const stream = await navigator.mediaDevices.getUserMedia({
  //       video: {
  //         facingMode: "environment", // Use rear camera
  //       },
  //     });
  //     streamRef.current = stream;
  //     setCurrentCameraIndex(index);
  //     setCameraModalVisible(true);

  //     // Wait for video element to be ready and set stream
  //     setTimeout(() => {
  //       if (videoRef.current) {
  //         videoRef.current.srcObject = stream;
  //         // Ensure video plays and loads metadata
  //         videoRef.current.play().catch((err) => {
  //           console.warn("Video play error:", err);
  //         });
  //       }
  //     }, 100);
  //   } catch (error) {
  //     console.error("Error accessing camera:", error);
  //     alert(
  //       "Không thể truy cập camera. Vui lòng cho phép quyền truy cập camera."
  //     );
  //   }
  // };

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
    height: number,
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
            imageCaptureError,
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

  // // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // const _removeImage = (index: number) => {
  //   const newImages = [...capturedImages];
  //   newImages[index] = undefined;
  //   setCapturedImages(newImages);
  // };

  // const _handleComplete = () => {
  //   const allImagesCaptured = [0, 1, 2].every((index) => capturedImages[index]);
  //   if (!allImagesCaptured) {
  //     alert("Vui lòng chụp đủ 3 ảnh");
  //     return;
  //   }
  //   // Navigate to survey page instead of opening notes modal
  //   navigate(`/stores/${store?.Id}/survey`, {
  //     state: {
  //       storeId: store?.Id,
  //       capturedImages: capturedImages.filter((img) => img !== undefined),
  //       notes: notes,
  //     },
  //   });
  // };

  // Helper function to upload single image with retry (chạy ở background)
  const uploadImageWithRetry = async (
    img: CapturedImage,
    auditId: number,
    index: number,
    maxRetries = 2,
  ): Promise<boolean> => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Resize and compress image for faster upload
        const compressedBlob = await compressImage(img.dataUrl, 800, 0.5);

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
          timeout: 25000,
        });

        return true; // Success, exit retry loop
      } catch (error: unknown) {
        console.error(
          `Background upload attempt ${attempt + 1} failed for image ${
            index + 1
          }:`,
          error,
        );

        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff + jitter)
          const baseDelay = 1000 * (attempt + 1);
          const jitter = Math.floor(Math.random() * 400);
          await new Promise((resolve) =>
            setTimeout(resolve, baseDelay + jitter),
          );
        }
      }
    }

    // All retries failed
    console.error(
      `Background upload failed for image ${index + 1} after ${
        maxRetries + 1
      } attempts`,
    );
    return false;
  };

  const handleConfirmUpload = async () => {
    if (!user || !store) return;

    // Filter out undefined images
    const imagesToUpload = capturedImages.filter(
      (img): img is CapturedImage => img !== undefined,
    );

    if (imagesToUpload.length !== 3) {
      alert("Vui lòng chụp đầy đủ 3 ảnh");
      return;
    }

    // Đóng modal ngay lập tức - không block UI
    setNotesModalVisible(false);

    // Tạo audit ngay lập tức (không chờ upload ảnh)
    let auditId: number;
    try {
      const auditResponse = await api.post("/audits", {
        userId: user.id,
        storeId: store.Id,
        notes: notes.trim() || null,
        auditDate: new Date().toISOString(),
      });
      auditId = auditResponse.data.Id;
    } catch (error) {
      console.error("Error creating audit:", error);
      alert("Không thể tạo audit. Vui lòng thử lại.");
      return;
    }

    // OPTIMISTIC UPDATE: Hiển thị ảnh local ngay lập tức trong UI
    setAllowNewAudit(false);
    setCapturedImages([undefined, undefined, undefined]);
    setNotes("");

    // Tạo optimistic audit entry với ảnh local (dataUrl)
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
        ImageUrl: img.dataUrl, // Sử dụng ảnh local ngay lập tức
        CapturedAt: img.timestamp,
        Latitude: img.latitude,
        Longitude: img.longitude,
      })),
    };

    // Thêm vào danh sách audits ngay lập tức (ảnh local)
    setAudits((prev) => [optimisticAudit, ...prev]);

    // UPLOAD ẢNH Ở BACKGROUND - không block UI
    // Upload không await, chạy ở background
    (async () => {
      try {
        // Upload with limited concurrency = 2 for better stability on weak networks
        const uploadResults: boolean[] = [];
        for (let i = 0; i < imagesToUpload.length; i += 2) {
          const batch = imagesToUpload.slice(i, i + 2);
          const batchResults = await Promise.all(
            batch.map((img, batchIdx) =>
              uploadImageWithRetry(img, auditId, i + batchIdx),
            ),
          );
          uploadResults.push(...batchResults);
          console.log(
            `[Upload Progress Web] ${uploadResults.filter(Boolean).length}/${imagesToUpload.length} ảnh đã upload thành công`,
          );
        }

        const successCount = uploadResults.filter(Boolean).length;
        const failedCount = uploadResults.length - successCount;

        // Nếu còn ảnh lỗi, lưu lại pending để retry lần sau
        if (failedCount > 0) {
          const failedImages = imagesToUpload.filter(
            (_, idx) => !uploadResults[idx],
          );

          savePendingUpload(
            store.Id,
            auditId,
            failedImages.map((img) => ({
              dataUrl: img.dataUrl,
              latitude: img.latitude,
              longitude: img.longitude,
              timestamp: img.timestamp,
              timezoneOffset: img.timezoneOffset,
            })),
            notes.trim() || "",
          );

          console.warn(
            `Web upload incomplete: ${successCount}/${imagesToUpload.length} uploaded, ${failedCount} pending retry`,
          );
        } else {
          // Thành công toàn bộ thì dọn pending cùng auditId
          removePendingUpload(store.Id, auditId);
        }

        // Cập nhật tọa độ cửa hàng sau khi upload xong (nếu có ít nhất 1 ảnh thành công)
        if (successCount > 0 && imagesToUpload[0]) {
          await api.put(`/stores/${store.Id}`, {
            latitude: imagesToUpload[0].latitude,
            longitude: imagesToUpload[0].longitude,
          });
        }

        // Sau khi upload xong, fetch lại data để cập nhật URL từ local sang server
        setTimeout(() => {
          fetchStore().catch((error) => {
            console.error("Background fetch error:", error);
          });
        }, 1000);
      } catch (error) {
        console.error("Background upload error:", error);
        // Không hiển thị lỗi cho user vì ảnh local đã hiển thị
        // Có thể thử lại sau hoặc để user biết qua notification nhẹ
      }
    })();

    // Hiển thị thông báo thành công ngay (không chờ upload)
    alert("Đã lưu audit cửa hàng. Ảnh đang được tải lên ở chế độ nền.");
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

        {/* Start Survey Section */}
        {showCameraSection && (
          <div
            className="store-detail-camera-section"
            style={{ backgroundColor: colors.background }}
          >
            <button
              className="store-detail-complete-button"
              onClick={() => {
                // Navigate directly to survey page
                navigate(`/stores/${store?.Id}/survey`);
              }}
              style={{
                backgroundColor: colors.primary,
                color: "#fff",
                width: "100%",
                padding: "14px",
                fontSize: "16px",
                fontWeight: 600,
              }}
            >
              Bắt đầu khảo sát
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
                    {audit.Images.map((img) => {
                      // Helper function để lấy URL tối ưu cho ảnh
                      const getOptimizedImageUrl = (
                        image: StoreImage,
                        size:
                          | "thumbnail"
                          | "small"
                          | "medium"
                          | "large"
                          | "original" = "medium",
                      ) => {
                        // Ưu tiên dùng optimizedUrls nếu có
                        if (image.optimizedUrls) {
                          return (
                            image.optimizedUrls[size] ||
                            image.optimizedUrls.medium ||
                            image.optimizedUrl ||
                            image.ImageUrl
                          );
                        }
                        // Fallback về optimizedUrl nếu có
                        if (image.optimizedUrl) {
                          return image.optimizedUrl;
                        }
                        // Cuối cùng dùng ImageUrl gốc (backward compatibility)
                        return image.ImageUrl;
                      };

                      const optimizedUrl = getOptimizedImageUrl(img, "medium");
                      const fullSizeUrl = getOptimizedImageUrl(img, "large");

                      return (
                        <div
                          key={img.Id}
                          className="store-detail-history-image-wrapper"
                        >
                          <img
                            src={optimizedUrl}
                            alt="Audit"
                            className="store-detail-history-image"
                            loading="lazy"
                            onClick={() => {
                              setSelectedImage(fullSizeUrl);
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
                      );
                    })}
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
                style={{ backgroundColor: colors.primary, color: "#fff" }}
              >
                Xác nhận
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

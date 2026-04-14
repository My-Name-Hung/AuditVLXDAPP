import BoardingTour from "@/src/components/BoardingTour";
import { useAuth } from "@/src/contexts/AuthContext";
import { useSurvey } from "@/src/contexts/SurveyContext";
import { useTheme } from "@/src/contexts/ThemeContext";
import api from "@/src/services/api";
import {
  clearPendingUploadsForStore,
  getPendingUploadForStore,
  removePendingUpload,
  savePendingUpload,
} from "@/src/utils/pendingUploads";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
  uri: string;
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

export default function StoreDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const {
    setCapturedImages: setSurveyImages,
    setNotes: setSurveyNotes,
    clearSurveyData,
  } = useSurvey();

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
  const [locationLoadingModalVisible, setLocationLoadingModalVisible] =
    useState(false);
  const [cachedLocation, setCachedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [confirmBackModalVisible, setConfirmBackModalVisible] = useState(false);
  const storeDetailTourSteps = [
    {
      title: "Tổng quan cửa hàng",
      description:
        "Kiểm tra trạng thái, thông tin liên hệ và người phụ trách để đảm bảo đúng đối tượng audit.",
    },
    {
      title: "Định vị và liên hệ",
      description:
        "Nhấn biểu tượng bản đồ để mở Google Maps hoặc gọi điện/email trực tiếp cho cửa hàng.",
    },
    {
      title: "Chụp 3 ảnh chuẩn",
      description:
        "Sử dụng các nút chụp ảnh. Mỗi ảnh tự động ghim tọa độ, thời gian để đáp ứng yêu cầu kiểm tra.",
    },
    {
      title: "Ghi chú & hoàn tất",
      description:
        "Nhấn Hoàn thành > điền ghi chú. Hệ thống sẽ tạo audit, upload ảnh và cập nhật vị trí.",
    },
    {
      title: "Kho ảnh lịch sử",
      description:
        "Kéo xuống cuối trang để xem ảnh đã upload trước đó và tham chiếu khi tái audit.",
    },
  ];

  // Filter audits by current user ID
  const userAudits = audits.filter((audit) => {
    // Check if audit has UserId field (from backend) or match with current user
    return audit.UserId === user?.id || audit.userId === user?.id;
  });

  const sortedAudits = [...userAudits].sort(
    (a, b) => new Date(b.AuditDate).getTime() - new Date(a.AuditDate).getTime()
  );
  const hasTodayAudit = sortedAudits.some((audit) =>
    isSameDay(audit.AuditDate, new Date())
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
          new Date(b.AuditDate).getTime() - new Date(a.AuditDate).getTime()
      );

      // Kiểm tra lại id một lần nữa trước khi set audits
      if (id !== fetchStoreId) {
        console.log(
          "Store ID changed before setting audits, ignoring response"
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
          "Store ID changed before setting allowNewAudit, ignoring response"
        );
        return;
      }

      setAllowNewAudit(userAuditData.length === 0);
    } catch (error) {
      // Chỉ hiển thị lỗi nếu id vẫn khớp
      if (id === fetchStoreId) {
        console.error("Error fetching store:", error);
        Alert.alert("Lỗi", "Không thể tải thông tin cửa hàng");
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

  // Clear capturedImages và context khi component mount lần đầu (tránh restore từ context)
  useEffect(() => {
    setCapturedImages([undefined, undefined, undefined]);
    setNotes("");
    setCachedLocation(null);
    clearSurveyData(); // Clear context để tránh restore ảnh từ store trước
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Chỉ chạy một lần khi mount

  // QUAN TRỌNG: Force clear capturedImages mỗi khi id thay đổi
  // Effect này phải chạy TRƯỚC tất cả các effects khác
  useEffect(() => {
    console.log(
      "[StoreDetail Mobile] Force clearing capturedImages for store:",
      id
    );
    setCapturedImages([undefined, undefined, undefined]);
    setNotes("");
    setCachedLocation(null);
    clearSurveyData();
  }, [id, clearSurveyData]);

  // Clear all state when store ID changes (navigating to different store)
  // Phải chạy TRƯỚC useFocusEffect để clear audits trước khi load pending uploads
  useEffect(() => {
    // Clear state IMMEDIATELY when store ID changes (synchronous)
    // Phải clear audits trước để tránh hiển thị ảnh của store khác
    const currentStoreId = id ? parseInt(id, 10) : null;

    // QUAN TRỌNG: Clear capturedImages và context NGAY LẬP TỨC (synchronous)
    // Phải clear cả local state và context để tránh restore từ context
    console.log(
      "[StoreDetail Mobile] Clearing state for store:",
      currentStoreId,
      "Previous:",
      previousStoreIdRef.current
    );
    promptedDateRef.current = null;
    setCapturedImages([undefined, undefined, undefined]);
    setNotes("");
    setCachedLocation(null);
    clearSurveyData(); // Clear context để tránh restore ảnh từ store trước
    setAudits([]); // Clear audits IMMEDIATELY to prevent showing previous store's audits
    setStore(null); // Clear store data

    // Xóa pending uploads của store cũ nếu có (async, không block)
    if (
      previousStoreIdRef.current !== null &&
      previousStoreIdRef.current !== currentStoreId
    ) {
      // Xóa pending uploads khỏi storage
      clearPendingUploadsForStore(previousStoreIdRef.current).catch((error) => {
        console.error("Error clearing pending uploads for store:", error);
      });

      // QUAN TRỌNG: Xóa file ảnh cũ trong bộ nhớ của store cũ ngay khi chuyển cửa hàng
      // (Để tránh sticky images khi chuyển cửa hàng)
      console.log(
        "[StoreDetail Mobile] Clearing pending uploads for old store:",
        previousStoreIdRef.current
      );
      (async () => {
        try {
          const oldPending = await getPendingUploadForStore(
            previousStoreIdRef.current!
          );
          if (oldPending) {
            console.log(
              "[StoreDetail Mobile] Found old pending upload, deleting image files"
            );
            for (const img of oldPending.images) {
              if (img.uri && img.uri.startsWith("file://")) {
                try {
                  const fileInfo = await FileSystem.getInfoAsync(img.uri);
                  if (fileInfo.exists) {
                    await FileSystem.deleteAsync(img.uri, { idempotent: true });
                    console.log(
                      "[StoreDetail Mobile] Deleted old store image file:",
                      img.uri
                    );
                  }
                } catch (deleteError) {
                  console.warn(
                    "[StoreDetail Mobile] Error deleting old store image file:",
                    img.uri,
                    deleteError
                  );
                  // Không throw, chỉ log warning
                }
              }
            }
          } else {
            console.log("[StoreDetail Mobile] No old pending upload found");
          }
        } catch (cleanupError) {
          console.warn(
            "[StoreDetail Mobile] Error cleaning up old store images:",
            cleanupError
          );
          // Không throw, chỉ log warning
        }
      })();
    }

    // Cập nhật previousStoreIdRef
    previousStoreIdRef.current = currentStoreId;
  }, [id, clearSurveyData]);

  // Load pending uploads từ AsyncStorage khi focus và tự động upload
  useFocusEffect(
    React.useCallback(() => {
      // Capture storeId tại thời điểm callback được tạo
      const currentStoreId = id ? parseInt(id, 10) : null;

      // QUAN TRỌNG: Clear capturedImages và context NGAY LẬP TỨC khi focus (tránh hiển thị ảnh của store khác)
      // Phải clear cả local state và context để tránh restore từ context
      console.log(
        "[StoreDetail Mobile] Loading pending uploads for store:",
        currentStoreId
      );
      setCapturedImages([undefined, undefined, undefined]);
      setNotes("");
      setCachedLocation(null);
      clearSurveyData(); // Clear context để tránh restore ảnh từ store trước

      if (!id || !user?.id || !currentStoreId || isNaN(currentStoreId)) {
        // Normal refresh
        const timer = setTimeout(() => {
          fetchStore();
        }, 300);
        return () => clearTimeout(timer);
      }

      // Cleanup function để cancel pending operations
      let isCancelled = false;
      let uploadTimeout: ReturnType<typeof setTimeout> | null = null;

      const loadAndUploadPending = async () => {
        try {
          // Kiểm tra lại storeId hiện tại
          const checkStoreId = id ? parseInt(id, 10) : null;
          if (!checkStoreId || checkStoreId !== currentStoreId || isCancelled) {
            // Đảm bảo capturedImages được clear nếu storeId không khớp
            setCapturedImages([undefined, undefined, undefined]);
            setNotes("");
            setCachedLocation(null);
            return; // Store ID changed or cancelled, don't load
          }

          // Đảm bảo capturedImages vẫn được clear trước khi load pending
          setCapturedImages([undefined, undefined, undefined]);
          setNotes("");
          setCachedLocation(null);

          const pending = await getPendingUploadForStore(currentStoreId);
          console.log(
            "[StoreDetail Mobile] Pending upload for store:",
            currentStoreId,
            "Found:",
            !!pending,
            "Pending storeId:",
            pending?.storeId
          );

          // Kiểm tra lại storeId một lần nữa sau async operation
          const finalCheckStoreId = id ? parseInt(id, 10) : null;
          if (
            !finalCheckStoreId ||
            finalCheckStoreId !== currentStoreId ||
            isCancelled
          ) {
            // Đảm bảo clear nếu storeId không khớp
            setCapturedImages([undefined, undefined, undefined]);
            setNotes("");
            setCachedLocation(null);
            return; // Store ID changed or cancelled
          }

          // QUAN TRỌNG: Kiểm tra lại storeId của pending upload có khớp với store hiện tại không
          // Phải match CHÍNH XÁC với currentStoreId và finalCheckStoreId
          // QUAN TRỌNG: KHÔNG BAO GIỜ set capturedImages từ pending uploads
          // Chỉ thêm vào audits để hiển thị trong lịch sử, KHÔNG hiển thị trong phần chụp ảnh
          if (
            pending &&
            pending.storeId === currentStoreId &&
            pending.storeId === finalCheckStoreId &&
            pending.images.length > 0
          ) {
            console.log(
              "[StoreDetail Mobile] Adding optimistic audit for pending upload, storeId:",
              pending.storeId
            );
            // QUAN TRỌNG: Đảm bảo capturedImages vẫn được clear (defensive)
            setCapturedImages([undefined, undefined, undefined]);
            setNotes("");
            setCachedLocation(null);

            // Kiểm tra lại storeId một lần nữa trước khi thêm
            const addCheckStoreId = id ? parseInt(id, 10) : null;
            if (
              !addCheckStoreId ||
              addCheckStoreId !== currentStoreId ||
              addCheckStoreId !== pending.storeId ||
              addCheckStoreId !== finalCheckStoreId ||
              isCancelled
            ) {
              // Đảm bảo clear nếu storeId không khớp
              setCapturedImages([undefined, undefined, undefined]);
              setNotes("");
              setCachedLocation(null);
              return; // Store ID changed or cancelled, don't add
            }

            // Tạo optimistic audit entry với ảnh local (đã có watermark từ uri)
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
                ImageUrl: img.uri, // Sử dụng ảnh local với watermark ngay lập tức
                CapturedAt: img.timestamp,
                Latitude: img.latitude,
                Longitude: img.longitude,
              })),
            };

            // Thêm vào danh sách audits ngay lập tức (ảnh local)
            // QUAN TRỌNG: Chỉ thêm vào audits, KHÔNG set capturedImages
            setAudits((prev) => {
              // Kiểm tra lại storeId một lần nữa trước khi thêm
              const checkStoreId = id ? parseInt(id, 10) : null;
              if (
                !checkStoreId ||
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
              console.log(
                "[StoreDetail Mobile] Adding optimistic audit to audits list, NOT to capturedImages"
              );
              return [optimisticAudit, ...prev];
            });

            // QUAN TRỌNG: Đảm bảo capturedImages vẫn được clear sau khi thêm vào audits
            // KHÔNG BAO GIỜ set capturedImages từ pending uploads
            setCapturedImages([undefined, undefined, undefined]);
            setNotes("");
            setCachedLocation(null);

            // Tự động upload ảnh ở background sau khi hiển thị (delay 500ms)
            uploadTimeout = setTimeout(() => {
              (async () => {
                try {
                  // Kiểm tra lại storeId trước khi upload
                  const checkStoreId = id ? parseInt(id, 10) : null;
                  if (
                    !checkStoreId ||
                    checkStoreId !== currentStoreId ||
                    checkStoreId !== pending.storeId ||
                    isCancelled
                  ) {
                    console.log(
                      "Store ID changed or cancelled, skipping upload"
                    );
                    return; // Don't upload if store changed or cancelled
                  }

                  const uploadImage = async (
                    img: {
                      uri: string;
                      latitude: number;
                      longitude: number;
                      timestamp: string;
                      timezoneOffset: number;
                    },
                    index: number
                  ) => {
                    const formData = new FormData();
                    formData.append("image", {
                      uri: img.uri,
                      type: "image/jpeg",
                      name: `image_${index + 1}.jpg`,
                    } as any);
                    formData.append("auditId", pending.auditId.toString());
                    formData.append("latitude", img.latitude.toString());
                    formData.append("longitude", img.longitude.toString());
                    formData.append("timestamp", img.timestamp);
                    formData.append(
                      "timezoneOffset",
                      img.timezoneOffset.toString()
                    );

                    return api.post("/images/upload", formData, {
                      headers: {
                        "Content-Type": "multipart/form-data",
                      },
                      timeout: 25000,
                    });
                  };

                  // Upload tất cả ảnh pending ở background (parallel, dynamic)
                  // Sử dụng Promise.allSettled để xử lý từng ảnh riêng biệt
                  const uploadResults = await Promise.allSettled(
                    pending.images.map((image, index) => uploadImage(image, index))
                  );

                  // Kiểm tra kết quả upload
                  const successCount = uploadResults.filter(
                    (result) => result.status === "fulfilled"
                  ).length;
                  const failedCount = uploadResults.filter(
                    (result) => result.status === "rejected"
                  ).length;

                  // Log kết quả
                  if (failedCount > 0) {
                    console.warn(
                      `Pending upload: ${successCount} images uploaded successfully, ${failedCount} images failed`
                    );
                    uploadResults.forEach((result, index) => {
                      if (result.status === "rejected") {
                        console.error(
                          `Pending upload: Image ${index + 1} failed:`,
                          result.reason
                        );
                      }
                    });
                  }

                  // Chỉ xóa pending upload nếu tất cả ảnh trong pending đều upload thành công
                  // Nếu có ảnh thất bại, giữ lại pending upload để thử lại sau
                  const allSuccess = failedCount === 0;

                  // Kiểm tra lại storeId trước khi cập nhật
                  const finalStoreId = id ? parseInt(id, 10) : null;
                  if (
                    finalStoreId &&
                    finalStoreId === currentStoreId &&
                    finalStoreId === pending.storeId &&
                    !isCancelled
                  ) {
                    // Cập nhật tọa độ cửa hàng sau khi upload xong (nếu có ít nhất 1 ảnh thành công)
                    if (successCount > 0 && pending.images[0]) {
                      try {
                        await api.put(`/stores/${currentStoreId}`, {
                          latitude: pending.images[0].latitude,
                          longitude: pending.images[0].longitude,
                        });
                      } catch (error) {
                        console.error(
                          "Error updating store coordinates:",
                          error
                        );
                      }
                    }

                    // Chỉ xóa pending upload nếu tất cả ảnh đều upload thành công
                    if (allSuccess) {
                      await removePendingUpload(
                        currentStoreId,
                        pending.auditId
                      );
                    } else {
                      console.warn(
                        `Keeping pending upload due to ${failedCount} failed image(s)`
                      );
                    }

                    // Chỉ xóa file local khi tất cả ảnh trong pending upload thành công
                    if (allSuccess) {
                      try {
                        for (const img of pending.images) {
                          if (img.uri && img.uri.startsWith("file://")) {
                            try {
                              const fileInfo = await FileSystem.getInfoAsync(
                                img.uri
                              );
                              if (fileInfo.exists) {
                                await FileSystem.deleteAsync(img.uri, {
                                  idempotent: true,
                                });
                                console.log("Deleted image file:", img.uri);
                              }
                            } catch (deleteError) {
                              console.warn(
                                "Error deleting image file:",
                                img.uri,
                                deleteError
                              );
                              // Không throw, chỉ log warning
                            }
                          }
                        }
                      } catch (cleanupError) {
                        console.warn(
                          "Error cleaning up image files:",
                          cleanupError
                        );
                        // Không throw, chỉ log warning
                      }
                    }

                    // Refresh để cập nhật ảnh từ server (chỉ nếu storeId vẫn khớp)
                    const refreshCheckStoreId = id ? parseInt(id, 10) : null;
                    if (
                      refreshCheckStoreId === currentStoreId &&
                      !isCancelled
                    ) {
                      fetchStore().catch((error) => {
                        console.error("Error refreshing after upload:", error);
                      });
                    }
                  }
                } catch (error) {
                  console.error("Background upload error:", error);
                  // Giữ lại pending upload để thử lại sau
                }
              })();
            }, 500);
          } else {
            // Normal refresh nếu không có pending upload
            if (!isCancelled) {
              fetchStore();
            }
          }
        } catch (error) {
          console.error("Error loading pending upload:", error);
          // Normal refresh on error (chỉ nếu không bị cancel)
          if (!isCancelled) {
            fetchStore();
          }
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
    }, [id, user?.id, fetchStore, clearSurveyData])
  );

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
      setCachedLocation(null);
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
      Linking.openURL(url).catch((err) => {
        console.error("Error opening map:", err);
        Alert.alert("Lỗi", "Không thể mở bản đồ");
      });
    }
  };

  const requestCameraPermission = async () => {
    // Request camera permission through ImagePicker (which handles camera permissions)
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Quyền truy cập", "Cần quyền truy cập camera để chụp ảnh");
      return false;
    }
    return true;
  };

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Quyền truy cập",
        "Cần quyền truy cập vị trí để ghi nhận tọa độ"
      );
      return false;
    }
    return true;
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const captureImage = async (index: number) => {
    const cameraGranted = await requestCameraPermission();
    const locationGranted = await requestLocationPermission();

    if (!cameraGranted || !locationGranted) {
      return;
    }

    try {
      let latitude: number;
      let longitude: number;

      // Try to use cached location first (fast)
      if (cachedLocation) {
        latitude = cachedLocation.latitude;
        longitude = cachedLocation.longitude;
      } else {
        // Show loading modal while getting location
        setLocationLoadingModalVisible(true);

        // Try to get last known position first (very fast)
        let location = await Location.getLastKnownPositionAsync({
          maxAge: 60000, // Use location if it's less than 1 minute old
        });

        // If no cached location or it's too old, get fresh location with timeout
        if (!location) {
          location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced, // Balanced accuracy for faster response
          });
        }

        latitude = location.coords.latitude;
        longitude = location.coords.longitude;

        // Cache the location for next captures
        setCachedLocation({ latitude, longitude });

        // Hide loading modal before opening camera
        setLocationLoadingModalVisible(false);
      }

      // Launch camera immediately
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // Disable crop/edit mode - this should auto-accept on iOS
        quality: 0.8,
        base64: false, // Don't include base64 for faster processing
        exif: false, // Don't include EXIF data for faster processing
      });

      // Save image immediately after capture (iOS will show preview but auto-accepts with allowsEditing: false)
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const now = new Date();
        const newImage: CapturedImage = {
          uri: asset.uri,
          latitude,
          longitude,
          timestamp: now.toISOString(),
          timezoneOffset: now.getTimezoneOffset(),
        };

        // Update state immediately
        const updatedImages = [...capturedImages];
        updatedImages[index] = newImage;
        setCapturedImages(updatedImages);
      }
    } catch (error) {
      console.error("Error capturing image:", error);
      setLocationLoadingModalVisible(false);
      Alert.alert("Lỗi", "Không thể chụp ảnh");
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const removeImage = (index: number) => {
    const updatedImages = [...capturedImages];
    updatedImages[index] = undefined;
    setCapturedImages(updatedImages);
  };

  // Check if there are any captured images
  const hasCapturedImages = capturedImages.some((img) => img !== undefined);

  // Handle back navigation with confirmation if images are captured
  const handleBack = () => {
    if (hasCapturedImages) {
      // Show confirmation modal if there are captured images
      setConfirmBackModalVisible(true);
    } else {
      // Check if we can go back, otherwise navigate to stores list
      if (router.canGoBack()) {
        router.back();
      } else {
        router.push("/(tabs)/stores");
      }
    }
  };

  // Confirm and go back, clearing all images
  const handleConfirmBack = () => {
    // Clear all captured images
    setCapturedImages([undefined, undefined, undefined]);
    setNotes("");
    setCachedLocation(null);
    // Close modal and go back
    setConfirmBackModalVisible(false);
    // Check if we can go back, otherwise navigate to stores list
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push("/(tabs)/stores");
    }
  };

  // Cancel going back
  const handleCancelBack = () => {
    setConfirmBackModalVisible(false);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleComplete = () => {
    if (capturedImages.length < 3) {
      Alert.alert("Lỗi", "Vui lòng chụp đầy đủ 3 ảnh");
      return;
    }
    const hasAllImages = [0, 1, 2].every((index) => capturedImages[index]);
    if (!hasAllImages) {
      Alert.alert("Lỗi", "Vui lòng chụp đầy đủ 3 ảnh");
      return;
    }
    // Save captured images and notes to context
    setSurveyImages(capturedImages);
    setSurveyNotes(notes);
    // Navigate to survey page
    router.push({
      pathname: "/(tabs)/store-survey/[id]",
      params: {
        id: id || "",
      },
    });
  };

  // Helper function to upload single image with retry (chạy ở background)
  // Returns true if successful, false if all retries failed
  const uploadImageWithRetry = async (
    img: CapturedImage,
    auditId: number,
    index: number,
    maxRetries = 2
  ): Promise<boolean> => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Resize and compress image - optimized for faster upload
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          img.uri,
          [{ resize: { width: 800 } }], // Reduced from 1280px to 800px for faster upload
          {
            compress: 0.5, // Reduced from 0.7 to 0.5 for smaller file size
            format: ImageManipulator.SaveFormat.JPEG,
          }
        );

        const formData = new FormData();
        formData.append("image", {
          uri: manipulatedImage.uri,
          type: "image/jpeg",
          name: `image_${index + 1}.jpg`,
        } as any);
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

        console.log(`Image ${index + 1} uploaded successfully`);
        return true; // Success, exit retry loop
      } catch (error: any) {
        console.error(
          `Background upload attempt ${attempt + 1} failed for image ${
            index + 1
          }:`,
          error
        );

        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff + jitter)
          const baseDelay = 1000 * (attempt + 1);
          const jitter = Math.floor(Math.random() * 400);
          await new Promise((resolve) =>
            setTimeout(resolve, baseDelay + jitter)
          );
        }
      }
    }

    // All retries failed
    console.error(
      `Background upload failed for image ${index + 1} after ${
        maxRetries + 1
      } attempts`
    );
    return false; // Return false to indicate failure
  };

  const handleConfirmUpload = async () => {
    if (!user || !store) return;

    // Filter out undefined images
    const imagesToUpload = capturedImages.filter(
      (img): img is CapturedImage => img !== undefined
    );

    if (imagesToUpload.length !== 3) {
      Alert.alert("Lỗi", "Vui lòng chụp đầy đủ 3 ảnh");
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
    } catch (error: any) {
      console.error("Error creating audit:", error);
      Alert.alert(
        "Lỗi",
        error.response?.data?.error || "Không thể tạo audit. Vui lòng thử lại."
      );
      return;
    }

    // OPTIMISTIC UPDATE: Hiển thị ảnh local ngay lập tức trong UI
    setAllowNewAudit(false);
    setCapturedImages([undefined, undefined, undefined]);
    setNotes("");

    // Tạo optimistic audit entry với ảnh local (uri)
    const optimisticAudit: AuditHistory = {
      AuditId: auditId,
      Result: "audited",
      FailedReason: null,
      Notes: notes.trim() || "",
      AuditDate: new Date().toISOString(),
      AuditCreatedAt: new Date().toISOString(),
      UserId: user.id,
      userId: user.id,
      Images: imagesToUpload.map((img, idx) => ({
        Id: -(idx + 1), // Use negative ID to avoid conflicts with real IDs
        ImageUrl: img.uri, // Sử dụng ảnh local ngay lập tức
        CapturedAt: img.timestamp,
        Latitude: img.latitude,
        Longitude: img.longitude,
      })),
    };

    // Thêm vào danh sách audits ngay lập tức (ảnh local)
    setAudits((prev) => {
      // Check if audit already exists to avoid duplicates
      const exists = prev.some((a) => a.AuditId === auditId);
      if (exists) {
        return prev; // Don't add if already exists
      }
      return [optimisticAudit, ...prev];
    });

    // Hiển thị thông báo thành công ngay (không chờ upload)
    Alert.alert(
      "Thành công",
      "Đã lưu audit cửa hàng. Ảnh đang được tải lên ở chế độ nền.",
      [
        {
          text: "OK",
          onPress: () => {
            // Already cleared images and notes above
          },
        },
      ]
    );

    // UPLOAD ẢNH Ở BACKGROUND - không block UI
    // Upload không await, chạy ở background
    (async () => {
      try {
        // Upload ảnh ở background (không block UI)
        // Upload with limited concurrency = 2 for better stability on weak networks
        const uploadResults: boolean[] = [];
        for (let i = 0; i < imagesToUpload.length; i += 2) {
          const batch = imagesToUpload.slice(i, i + 2);
          const batchResults = await Promise.all(
            batch.map((img, batchIdx) =>
              uploadImageWithRetry(img, auditId, i + batchIdx)
            )
          );
          uploadResults.push(...batchResults);
          console.log(
            `[Upload Progress] ${uploadResults.filter(Boolean).length}/${imagesToUpload.length} ảnh đã upload thành công`
          );
        }

        // Kiểm tra kết quả upload
        const successCount = uploadResults.filter(
          (result) => result === true
        ).length;
        const failedCount = uploadResults.filter(
          (result) => result === false
        ).length;

        if (failedCount > 0) {
          console.warn(
            `Upload warning: ${successCount} images uploaded successfully, ${failedCount} images failed`
          );
          // Log chi tiết ảnh nào thất bại
          uploadResults.forEach((result, index) => {
            if (!result) {
              console.error(`Image ${index + 1} upload failed`);
            }
          });

          // Lưu lại các ảnh thất bại vào pending upload để tự upload lại sau
          try {
            const failedImages = imagesToUpload
              .map((img, index) => ({
                img,
                index,
                ok: uploadResults[index] === true,
              }))
              .filter((x) => !x.ok)
              .map(({ img }) => ({
                uri: img.uri,
                latitude: img.latitude,
                longitude: img.longitude,
                timestamp: img.timestamp,
                timezoneOffset: img.timezoneOffset,
              }));

            if (failedImages.length > 0 && store?.Id) {
              await savePendingUpload(
                store.Id,
                auditId,
                failedImages,
                notes.trim() || ""
              );
            }
          } catch (pendingError) {
            console.error(
              "Error saving failed images to pending uploads:",
              pendingError
            );
          }

          // Thông báo rõ ràng cho người dùng
          Alert.alert(
            "Cảnh báo",
            `Ảnh tải lên chưa đầy đủ. Đã tải thành công ${successCount}/3 ảnh. ` +
              "Các ảnh còn lại sẽ được hệ thống thử tải lại khi bạn mở lại cửa hàng này."
          );
        }

        // Chỉ cập nhật tọa độ nếu có ít nhất 1 ảnh upload thành công
        if (successCount > 0 && imagesToUpload[0]) {
          try {
            await api.put(`/stores/${store.Id}`, {
              latitude: imagesToUpload[0].latitude,
              longitude: imagesToUpload[0].longitude,
            });
          } catch (error) {
            console.error("Error updating store coordinates:", error);
          }
        }

        // Sau khi upload xong, fetch lại data để cập nhật URL từ local sang server
        // (nhưng không cần thiết vì ảnh local đã hiển thị tốt)
        setTimeout(() => {
          fetchStore().catch((error) => {
            console.error("Background fetch error:", error);
            // Silent fail - ảnh local đã hiển thị tốt
          });
        }, 1000);
      } catch (error) {
        console.error("Background upload error:", error);
        // Không hiển thị lỗi cho user vì ảnh local đã hiển thị
        // Có thể thử lại sau hoặc để user biết qua notification nhẹ
      }
    })();
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.push("/(tabs)/stores");
              }
            }}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Chi tiết cửa hàng
          </Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!store) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.push("/(tabs)/stores");
              }
            }}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Chi tiết cửa hàng
          </Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.text }]}>
            Không tìm thấy cửa hàng
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleImagePress = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setImageModalVisible(true);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.icon + "20" }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Chi tiết cửa hàng
        </Text>
        {store.Latitude && store.Longitude ? (
          <TouchableOpacity onPress={handleOpenMap} style={styles.mapButton}>
            <Text style={[styles.mapButtonText, { color: colors.primary }]}>
              Xem bản đồ
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerRight} />
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Store Info Section */}
        <View
          style={[styles.infoSection, { backgroundColor: colors.background }]}
        >
          <View style={styles.infoGrid}>
            <View style={styles.infoColumn}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.icon }]}>
                  Mã cửa hàng:
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {store.StoreCode}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.icon }]}>
                  Tên cửa hàng:
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {store.StoreName}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.icon }]}>
                  Loại đối tượng:
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {getRankLabel(store.Rank)}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.icon }]}>
                  Địa chỉ cửa hàng:
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {store.Address || "-"}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.icon }]}>
                  Mã số thuế:
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {store.TaxCode || "-"}
                </Text>
              </View>
            </View>

            <View style={styles.infoColumn}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.icon }]}>
                  Địa bàn phụ trách:
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {store.TerritoryName || "-"}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.icon }]}>
                  Tên đối tác:
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {store.PartnerName || "-"}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.icon }]}>
                  Thông tin liên hệ:
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {store.Phone || "-"}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.icon }]}>
                  Nhân viên Phụ trách:
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {store.UserFullName || "-"}{" "}
                  {store.UserCode ? `(${store.UserCode})` : ""}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.icon }]}>
                  Trạng thái:
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(store.Status) },
                  ]}
                >
                  <Text style={styles.statusText}>
                    {getStatusLabel(store.Status)}
                  </Text>
                </View>
              </View>

              {/* Failed Reason - show directly under status when store is failed */}
              {store.Status === "failed" && !!store.FailedReason && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.icon }]}>
                    Lý do không đạt:
                  </Text>
                  <View style={styles.failedReasonBox}>
                    <Text
                      style={[styles.failedReasonText, { color: colors.text }]}
                    >
                      {store.FailedReason}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>

        {showCameraSection && (
          <View
            style={[
              styles.cameraSection,
              { backgroundColor: colors.background },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.completeButton,
                {
                  backgroundColor: colors.primary,
                },
              ]}
              onPress={() => {
                // Navigate directly to survey page
                router.push({
                  pathname: "/(tabs)/store-survey/[id]",
                  params: {
                    id: id || "",
                  },
                });
              }}
            >
              <Text style={styles.completeButtonText}>Bắt đầu khảo sát</Text>
            </TouchableOpacity>

            {!hasTodayAudit && !allowNewAudit && (
              <TouchableOpacity
                style={styles.startTodayBtn}
                onPress={() => setShowNewAuditModal(true)}
              >
                <Text style={styles.startTodayText}>
                  Bắt đầu thực thi cho hôm nay
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {sortedAudits.length > 0 ? (
          <View
            style={[
              styles.historySection,
              { backgroundColor: colors.background },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Lịch sử các ngày trước
            </Text>
            {sortedAudits.map((audit, auditIdx) => {
              const badgeStyle = getAuditStatusStyle(audit.Result);
              return (
                <View
                  key={`audit-${audit.AuditId}-${auditIdx}`}
                  style={styles.historyCard}
                >
                  <View style={styles.historyHeader}>
                    <View>
                      <Text
                        style={[styles.historyDate, { color: colors.text }]}
                      >
                        {new Date(audit.AuditDate).toLocaleString("vi-VN", {
                          hour12: false,
                        })}
                      </Text>
                      {audit.Notes ? (
                        <Text style={styles.historyNotes}>{audit.Notes}</Text>
                      ) : null}
                    </View>
                    <View
                      style={[
                        styles.historyStatusBadge,
                        { backgroundColor: badgeStyle.backgroundColor },
                      ]}
                    >
                      <Text
                        style={[
                          styles.historyStatusText,
                          { color: badgeStyle.color },
                        ]}
                      >
                        {getAuditStatusLabel(audit.Result)}
                      </Text>
                    </View>
                  </View>
                  {audit.Result === "fail" && audit.FailedReason ? (
                    <Text style={styles.historyFailedReason}>
                      Lý do: {audit.FailedReason}
                    </Text>
                  ) : null}
                  {audit.Images && audit.Images.length > 0 ? (
                    <View style={styles.imagesGrid}>
                      {audit.Images.map((img, imgIdx) => (
                        <View
                          key={`${audit.AuditId}-${img.Id || imgIdx}`}
                          style={styles.imageItem}
                        >
                          <TouchableOpacity
                            style={styles.imageContainer}
                            onPress={() => handleImagePress(img.ImageUrl)}
                          >
                            <Image
                              source={{ uri: img.ImageUrl }}
                              style={styles.image}
                            />
                          </TouchableOpacity>
                          <Text
                            style={[styles.imageTime, { color: colors.icon }]}
                          >
                            {new Date(img.CapturedAt).toLocaleString("vi-VN")}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={[styles.emptyText, { color: colors.icon }]}>
                      Chưa có ảnh cho ngày này
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          <View
            style={[
              styles.imagesSection,
              { backgroundColor: colors.background },
            ]}
          >
            <Text style={[styles.emptyText, { color: colors.icon }]}>
              Chưa có lịch sử audit cho cửa hàng này
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showNewAuditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNewAuditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.background },
            ]}
          >
            <Ionicons
              name="calendar-outline"
              size={48}
              color={colors.primary}
            />
            <Text
              style={[styles.modalTitle, { color: colors.text, marginTop: 16 }]}
            >
              Audit ngày mới
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.icon }]}>
              Hôm nay cửa hàng chưa được thực thi. Bạn có muốn bắt đầu chụp ảnh
              cho ngày hôm nay?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setAllowNewAudit(true);
                  setShowNewAuditModal(false);
                }}
              >
                <Text style={styles.modalButtonText}>Để sau</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={() => {
                  setAllowNewAudit(true);
                  setShowNewAuditModal(false);
                }}
              >
                <Text style={styles.modalButtonTextConfirm}>Bắt đầu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Zoom Modal */}
      <Modal
        visible={imageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setImageModalVisible(false);
          setSelectedImage(null);
        }}
      >
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity
            style={styles.imageModalCloseButton}
            onPress={() => {
              setImageModalVisible(false);
              setSelectedImage(null);
            }}
          >
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>
          {selectedImage && (
            <ScrollView
              style={styles.imageModalScrollView}
              contentContainerStyle={styles.imageModalContent}
              maximumZoomScale={5}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              bouncesZoom={true}
              centerContent={true}
            >
              <Image
                source={{ uri: selectedImage }}
                style={styles.imageModalImage}
                resizeMode="contain"
              />
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Notes Modal */}
      <Modal
        visible={notesModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNotesModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setNotesModalVisible(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={{ width: "100%", alignItems: "center" }}
            >
              <View
                style={[
                  styles.modalContent,
                  { backgroundColor: colors.background },
                ]}
              >
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Ghi chú
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.icon }]}>
                  Ghi chú tình trạng cửa hàng (có thể để trống)
                </Text>
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  style={styles.notesScrollView}
                  contentContainerStyle={styles.notesScrollContent}
                >
                  <TextInput
                    style={[
                      styles.notesInput,
                      {
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderColor: colors.icon + "40",
                      },
                    ]}
                    placeholder="Nhập ghi chú..."
                    placeholderTextColor={colors.icon}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </ScrollView>
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.modalButtonCancel,
                      { backgroundColor: colors.icon + "20" },
                    ]}
                    onPress={() => {
                      setNotesModalVisible(false);
                      setNotes("");
                    }}
                  >
                    <Text
                      style={[styles.modalButtonText, { color: colors.text }]}
                    >
                      Hủy
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.modalButtonConfirm,
                      { backgroundColor: colors.primary },
                    ]}
                    onPress={handleConfirmUpload}
                  >
                    <Text style={styles.modalButtonTextConfirm}>Xác nhận</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Location Loading Modal */}
      <Modal
        visible={locationLoadingModalVisible}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.background },
            ]}
          >
            <ActivityIndicator size="large" color={colors.primary} />
            <Text
              style={[styles.modalTitle, { color: colors.text, marginTop: 16 }]}
            >
              Đang lấy thông tin vị trí...
            </Text>
          </View>
        </View>
      </Modal>

      {/* Confirm Back Modal */}
      <Modal
        visible={confirmBackModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancelBack}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.background },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Xác nhận quay lại
            </Text>
            <Text
              style={[
                styles.modalSubtitle,
                { color: colors.icon, marginTop: 8 },
              ]}
            >
              Bạn có ảnh đã chụp chưa được lưu. Quay lại sẽ xóa tất cả ảnh đã
              chụp. Bạn có chắc muốn quay lại?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalButtonCancel,
                  { backgroundColor: colors.icon + "20" },
                ]}
                onPress={handleCancelBack}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>
                  Hủy
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalButtonConfirm,
                  { backgroundColor: colors.primary },
                ]}
                onPress={handleConfirmBack}
              >
                <Text style={styles.modalButtonTextConfirm}>Quay lại</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <BoardingTour storageKey="store-detail" steps={storeDetailTourSteps} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  headerRight: {
    width: 80,
  },
  mapButton: {
    padding: 4,
  },
  mapButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
  },
  infoSection: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  infoGrid: {
    flexDirection: "row",
    gap: 16,
  },
  infoColumn: {
    flex: 1,
    gap: 12,
  },
  infoRow: {
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 4,
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  statusText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  failedReasonBox: {
    flex: 1,
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  failedReasonText: {
    fontSize: 13,
    lineHeight: 18,
  },
  cameraSection: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  imagesSection: {
    borderRadius: 12,
    padding: 16,
    minHeight: 200,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  cameraGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  cameraItem: {
    flex: 1,
    aspectRatio: 1,
  },
  cameraButton: {
    flex: 1,
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  capturedImageContainer: {
    flex: 1,
    position: "relative",
  },
  capturedImage: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  removeButton: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  completeButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  completeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  imagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  imageItem: {
    width: "30%",
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  imageTime: {
    fontSize: 10,
    marginTop: 4,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "85%",
    maxWidth: 400,
    maxHeight: "80%",
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  notesScrollView: {
    maxHeight: 200,
    marginBottom: 16,
  },
  notesScrollContent: {
    flexGrow: 1,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: "top",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalButtonCancel: {
    backgroundColor: "#f1f5f9",
  },
  modalButtonConfirm: {
    backgroundColor: "#1d4ed8",
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  modalButtonTextConfirm: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  historySection: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginTop: 16,
  },
  historyCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  historyDate: {
    fontSize: 15,
    fontWeight: "600",
  },
  historyNotes: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
  },
  historyStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  historyStatusText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  historyFailedReason: {
    fontSize: 13,
    color: "#991b1b",
    marginBottom: 6,
  },
  startTodayBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#1d4ed8",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  startTodayText: {
    color: "#1d4ed8",
    fontWeight: "600",
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageModalCloseButton: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 20,
    padding: 8,
  },
  imageModalScrollView: {
    flex: 1,
    width: Dimensions.get("window").width,
  },
  imageModalContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    minWidth: Dimensions.get("window").width,
    minHeight: Dimensions.get("window").height,
  },
  imageModalImage: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
    resizeMode: "contain",
  },
  progressContainer: {
    width: "100%",
    marginTop: 16,
  },
  progressBar: {
    width: "100%",
    height: 8,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    textAlign: "center",
  },
});

import BoardingTour from "@/src/components/BoardingTour";
import { useAuth } from "@/src/contexts/AuthContext";
import { useTheme } from "@/src/contexts/ThemeContext";
import api from "@/src/services/api";
import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
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

  const sortedAudits = [...audits].sort(
    (a, b) =>
      new Date(b.AuditDate).getTime() - new Date(a.AuditDate).getTime()
  );
  const hasTodayAudit = sortedAudits.some((audit) =>
    isSameDay(audit.AuditDate, new Date())
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
      setAllowNewAudit(auditData.length === 0);
    } catch (error) {
      console.error("Error fetching store:", error);
      Alert.alert("Lỗi", "Không thể tải thông tin cửa hàng");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchStore();
  }, [fetchStore]);

  useEffect(() => {
    promptedDateRef.current = null;
  }, [id]);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (sortedAudits.length === 0) {
      setShowNewAuditModal(false);
      return;
    }
    if (hasTodayAudit) {
      setShowNewAuditModal(false);
      promptedDateRef.current = formatDateKey(new Date());
      return;
    }
    if (!allowNewAudit) {
      const todayKey = formatDateKey(new Date());
      if (promptedDateRef.current !== todayKey) {
        setShowNewAuditModal(true);
        promptedDateRef.current = todayKey;
      }
    }
  }, [sortedAudits, hasTodayAudit, allowNewAudit, loading]);

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
      // Go back immediately if no images
      router.back();
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
    router.back();
  };

  // Cancel going back
  const handleCancelBack = () => {
    setConfirmBackModalVisible(false);
  };

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
      const firstImage = capturedImages[0];

      // Upload 3 images (filter out undefined)
      const imagesToUpload = capturedImages.filter(
        (img): img is CapturedImage => img !== undefined
      );
      const uploadPromises = imagesToUpload.map(async (img, index) => {
        // Resize and compress image before upload for faster upload speed
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          img.uri,
          [{ resize: { width: 1280 } }], // Resize to max width 1280px (maintains aspect ratio)
          {
            compress: 0.7, // Compress to 70% quality (good balance between quality and size)
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

        return api.post("/images/upload", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      });

      await Promise.all(uploadPromises);

      // Update store latitude/longitude from first image
      if (firstImage) {
        await api.put(`/stores/${store.Id}`, {
          latitude: firstImage.latitude,
          longitude: firstImage.longitude,
        });
      }

    setAllowNewAudit(false);

      Alert.alert("Thành công", "Đã hoàn thành audit cửa hàng", [
        {
          text: "OK",
          onPress: () => {
            setCapturedImages([undefined, undefined, undefined]);
            setNotes("");
            fetchStore();
          },
        },
      ]);
    } catch (error: any) {
      console.error("Error uploading images:", error);
      Alert.alert("Lỗi", error.response?.data?.error || "Upload ảnh thất bại");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
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
            onPress={() => router.back()}
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
                  User Phụ trách:
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
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Chụp ảnh {sortedAudits.length > 0 ? "ngày hôm nay" : ""}
            </Text>
            <View style={styles.cameraGrid}>
              {[0, 1, 2].map((index) => {
                const image = capturedImages[index];
                return (
                  <View key={index} style={styles.cameraItem}>
                    {image ? (
                      <View style={styles.capturedImageContainer}>
                        <Image
                          source={{ uri: image.uri }}
                          style={styles.capturedImage}
                        />
                        <TouchableOpacity
                          style={styles.removeButton}
                          onPress={() => removeImage(index)}
                        >
                          <Ionicons
                            name="close-circle"
                            size={24}
                            color="#F44336"
                          />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[
                          styles.cameraButton,
                          { borderColor: colors.icon + "40" },
                        ]}
                        onPress={() => captureImage(index)}
                      >
                        <Ionicons name="camera" size={32} color={colors.icon} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>

            <TouchableOpacity
              style={[
                styles.completeButton,
                {
                  backgroundColor:
                    capturedImages.length === 3 &&
                    [0, 1, 2].every((index) => capturedImages[index])
                      ? colors.primary
                      : colors.icon + "40",
                },
              ]}
              onPress={handleComplete}
              disabled={
                capturedImages.length < 3 ||
                ![0, 1, 2].every((index) => capturedImages[index]) ||
                uploading
              }
            >
              {uploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.completeButtonText}>Hoàn thành</Text>
              )}
            </TouchableOpacity>

            {!hasTodayAudit && !allowNewAudit && (
              <TouchableOpacity
                style={styles.startTodayBtn}
                onPress={() => setShowNewAuditModal(true)}
              >
                <Text style={styles.startTodayText}>
                  Bắt đầu audit cho hôm nay
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
            {sortedAudits.map((audit) => {
              const badgeStyle = getAuditStatusStyle(audit.Result);
              return (
                <View key={audit.AuditId} style={styles.historyCard}>
                  <View style={styles.historyHeader}>
                    <View>
                      <Text style={[styles.historyDate, { color: colors.text }]}>
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
                  {audit.Images.map((img) => (
                    <View key={img.Id} style={styles.imageItem}>
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
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <Ionicons
              name="calendar-outline"
              size={48}
              color={colors.primary}
            />
            <Text style={[styles.modalTitle, { color: colors.text, marginTop: 16 }]}>
              Audit ngày mới
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.icon }]}>
              Hôm nay cửa hàng chưa được audit. Bạn có muốn bắt đầu chụp ảnh cho ngày hôm nay?
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
        <View style={styles.modalOverlay}>
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
            />
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
                onPress={handleConfirmUpload}
              >
                <Text style={styles.modalButtonTextConfirm}>Xác nhận</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: "top",
    marginBottom: 24,
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
});

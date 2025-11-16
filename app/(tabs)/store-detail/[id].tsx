import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Camera from 'expo-camera';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/src/contexts/AuthContext';
import { Colors } from '@/src/constants/theme';
import { useColorScheme } from '@/src/hooks/use-color-scheme';
import api from '@/src/services/api';

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
}

interface CapturedImage {
  uri: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

interface StoreImage {
  Id: number;
  ImageUrl: string;
  CapturedAt: string;
  Latitude: number;
  Longitude: number;
}

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    not_audited: 'Chưa thực hiện',
    audited: 'Đã thực hiện',
    passed: 'Đạt',
    failed: 'Không đạt',
  };
  return labels[status] || status;
};

const getStatusColor = (status: string) => {
  const colorMap: Record<string, string> = {
    not_audited: '#FF9800',
    audited: '#2196F3',
    passed: '#4CAF50',
    failed: '#F44336',
  };
  return colorMap[status] || '#999';
};

const getRankLabel = (rank: number | null) => {
  if (rank === 1) return 'Đơn vị, tổ chức';
  if (rank === 2) return 'Cá nhân';
  return '-';
};

export default function StoreDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [capturedImages, setCapturedImages] = useState<(CapturedImage | undefined)[]>([undefined, undefined, undefined]);
  const [storeImages, setStoreImages] = useState<StoreImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const [notes, setNotes] = useState('');

  const isAudited = store?.Status === 'audited' || store?.Status === 'passed' || store?.Status === 'failed';

  useEffect(() => {
    fetchStore();
  }, [id]);

  const fetchStore = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/stores/${id}`);
      const storeData = response.data;
      setStore(storeData);

      // If store is audited, get images from audits
      if (storeData.Status === 'audited' || storeData.Status === 'passed' || storeData.Status === 'failed') {
        // getStoreById returns audits with images in storeData.audits or storeData.Audits
        const audits = storeData.audits || storeData.Audits || [];
        if (audits.length > 0) {
          const latestAudit = audits[0];
          const images = latestAudit.Images || latestAudit.images || [];
          if (images.length > 0) {
            setStoreImages(images);
          }
        } else {
          // Fallback: fetch audits separately
          await fetchStoreImages();
        }
      }
    } catch (error) {
      console.error('Error fetching store:', error);
      Alert.alert('Lỗi', 'Không thể tải thông tin cửa hàng');
    } finally {
      setLoading(false);
    }
  };

  const fetchStoreImages = async () => {
    try {
      const response = await api.get(`/audits?storeId=${id}`);
      if (response.data && response.data.length > 0) {
        const auditId = response.data[0].Id;
        const imagesResponse = await api.get(`/images/audit/${auditId}`);
        setStoreImages(imagesResponse.data || []);
      }
    } catch (error) {
      console.error('Error fetching store images:', error);
    }
  };

  const handleOpenMap = () => {
    if (store?.Latitude && store?.Longitude) {
      const url = `https://www.google.com/maps?q=${store.Latitude},${store.Longitude}`;
      Linking.openURL(url).catch((err) => {
        console.error('Error opening map:', err);
        Alert.alert('Lỗi', 'Không thể mở bản đồ');
      });
    }
  };

  const requestCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Quyền truy cập', 'Cần quyền truy cập camera để chụp ảnh');
      return false;
    }
    return true;
  };

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Quyền truy cập', 'Cần quyền truy cập vị trí để ghi nhận tọa độ');
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
      // Get current location
      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const newImage: CapturedImage = {
          uri: result.assets[0].uri,
          latitude,
          longitude,
          timestamp: new Date().toISOString(),
        };

        const updatedImages = [...capturedImages];
        updatedImages[index] = newImage;
        setCapturedImages(updatedImages);
      }
    } catch (error) {
      console.error('Error capturing image:', error);
      Alert.alert('Lỗi', 'Không thể chụp ảnh');
    }
  };

  const removeImage = (index: number) => {
    const updatedImages = [...capturedImages];
    updatedImages[index] = undefined;
    setCapturedImages(updatedImages);
  };

  const handleComplete = () => {
    if (capturedImages.length < 3) {
      Alert.alert('Lỗi', 'Vui lòng chụp đầy đủ 3 ảnh');
      return;
    }
    const hasAllImages = [0, 1, 2].every((index) => capturedImages[index]);
    if (!hasAllImages) {
      Alert.alert('Lỗi', 'Vui lòng chụp đầy đủ 3 ảnh');
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
      const auditResponse = await api.post('/audits', {
        userId: user.id,
        storeId: store.Id,
        notes: notes.trim() || null,
        auditDate: new Date().toISOString(),
        skipStatusUpdate: true, // Don't update status yet, will be updated when images are uploaded
      });

      const auditId = auditResponse.data.Id;
      const firstImage = capturedImages[0];

      // Upload 3 images (filter out undefined)
      const imagesToUpload = capturedImages.filter((img): img is CapturedImage => img !== undefined);
      const uploadPromises = imagesToUpload.map(async (img, index) => {
        const formData = new FormData();
        formData.append('image', {
          uri: img.uri,
          type: 'image/jpeg',
          name: `image_${index + 1}.jpg`,
        } as any);
        formData.append('auditId', auditId.toString());
        formData.append('latitude', img.latitude.toString());
        formData.append('longitude', img.longitude.toString());

        return api.post('/images/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
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

      Alert.alert('Thành công', 'Đã hoàn thành audit cửa hàng', [
        {
          text: 'OK',
          onPress: () => {
            setCapturedImages([undefined, undefined, undefined]);
            setNotes('');
            fetchStore();
          },
        },
      ]);
    } catch (error: any) {
      console.error('Error uploading images:', error);
      Alert.alert('Lỗi', error.response?.data?.error || 'Upload ảnh thất bại');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Chi tiết cửa hàng</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      </View>
    );
  }

  if (!store) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Chi tiết cửa hàng</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.text }]}>Không tìm thấy cửa hàng</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.icon + '20' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Chi tiết cửa hàng</Text>
        {store.Latitude && store.Longitude ? (
          <TouchableOpacity onPress={handleOpenMap} style={styles.mapButton}>
            <Text style={[styles.mapButtonText, { color: Colors.light.primary }]}>Xem bản đồ</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerRight} />
        )}
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Store Info Section */}
        <View style={[styles.infoSection, { backgroundColor: colors.background }]}>
          <View style={styles.infoGrid}>
            <View style={styles.infoColumn}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.icon }]}>Mã cửa hàng:</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{store.StoreCode}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.icon }]}>Tên cửa hàng:</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{store.StoreName}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.icon }]}>Loại đối tượng:</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{getRankLabel(store.Rank)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.icon }]}>Địa chỉ cửa hàng:</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{store.Address || '-'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.icon }]}>Mã số thuế:</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{store.TaxCode || '-'}</Text>
              </View>
            </View>

            <View style={styles.infoColumn}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.icon }]}>Địa bàn phụ trách:</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{store.TerritoryName || '-'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.icon }]}>Tên đối tác:</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{store.PartnerName || '-'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.icon }]}>Thông tin liên hệ:</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{store.Phone || '-'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.icon }]}>User Phụ trách:</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {store.UserFullName || '-'} {store.UserCode ? `(${store.UserCode})` : ''}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.icon }]}>Trạng thái:</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(store.Status) },
                  ]}
                >
                  <Text style={styles.statusText}>{getStatusLabel(store.Status)}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Camera Section or Images Display */}
        {isAudited ? (
          <View style={[styles.imagesSection, { backgroundColor: colors.background }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Ảnh đã chụp</Text>
            {storeImages.length > 0 ? (
              <View style={styles.imagesGrid}>
                {storeImages.map((img, index) => (
                  <View key={img.Id} style={styles.imageContainer}>
                    <Image source={{ uri: img.ImageUrl }} style={styles.image} />
                    <Text style={[styles.imageTime, { color: colors.icon }]}>
                      {new Date(img.CapturedAt).toLocaleString('vi-VN')}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.emptyText, { color: colors.icon }]}>Chưa có ảnh</Text>
            )}
          </View>
        ) : (
          <View style={[styles.cameraSection, { backgroundColor: colors.background }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Chụp ảnh</Text>
            <View style={styles.cameraGrid}>
              {[0, 1, 2].map((index) => {
                const image = capturedImages[index];
                return (
                  <View key={index} style={styles.cameraItem}>
                    {image ? (
                      <View style={styles.capturedImageContainer}>
                        <Image source={{ uri: image.uri }} style={styles.capturedImage} />
                        <TouchableOpacity
                          style={styles.removeButton}
                          onPress={() => removeImage(index)}
                        >
                          <Ionicons name="close-circle" size={24} color="#F44336" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.cameraButton, { borderColor: colors.icon + '40' }]}
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
                    capturedImages.length === 3 && [0, 1, 2].every((index) => capturedImages[index])
                      ? Colors.light.primary
                      : colors.icon + '40',
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
          </View>
        )}
      </ScrollView>

      {/* Notes Modal */}
      <Modal
        visible={notesModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNotesModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Ghi chú</Text>
            <Text style={[styles.modalSubtitle, { color: colors.icon }]}>
              Ghi chú tình trạng cửa hàng (có thể để trống)
            </Text>
            <TextInput
              style={[styles.notesInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.icon + '40' }]}
              placeholder="Nhập ghi chú..."
              placeholderTextColor={colors.icon}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { backgroundColor: colors.icon + '20' }]}
                onPress={() => {
                  setNotesModalVisible(false);
                  setNotes('');
                }}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleConfirmUpload}
              >
                <Text style={styles.modalButtonTextConfirm}>Xác nhận</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 80,
  },
  mapButton: {
    padding: 4,
  },
  mapButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
  infoSection: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  infoGrid: {
    flexDirection: 'row',
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
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cameraSection: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  imagesSection: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  cameraGrid: {
    flexDirection: 'row',
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
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  capturedImageContainer: {
    flex: 1,
    position: 'relative',
  },
  capturedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  completeButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  imageContainer: {
    width: '30%',
    aspectRatio: 1,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  imageTime: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
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
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {},
  modalButtonConfirm: {
    backgroundColor: Colors.light.primary,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextConfirm: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

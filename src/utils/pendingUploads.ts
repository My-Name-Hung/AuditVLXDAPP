/**
 * Utility để quản lý pending image uploads (Mobile App)
 * Lưu ảnh vào AsyncStorage và tự động upload khi rời trang
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

interface PendingUpload {
  storeId: number;
  auditId: number;
  images: Array<{
    uri: string;
    latitude: number;
    longitude: number;
    timestamp: string;
    timezoneOffset: number;
  }>;
  notes?: string;
  timestamp: number; // Khi nào được tạo
}

const STORAGE_KEY = "pending_uploads";

/**
 * Lưu pending upload vào AsyncStorage
 */
export async function savePendingUpload(
  storeId: number,
  auditId: number,
  images: Array<{
    uri: string;
    latitude: number;
    longitude: number;
    timestamp: string;
    timezoneOffset: number;
  }>,
  notes?: string
): Promise<void> {
  try {
    const existing = await getPendingUploads();
    const newUpload: PendingUpload = {
      storeId,
      auditId,
      images,
      notes,
      timestamp: Date.now(),
    };

    // Kiểm tra xem đã có pending upload cho store này chưa
    const existingIndex = existing.findIndex(
      (u) => u.storeId === storeId && u.auditId === auditId
    );

    if (existingIndex >= 0) {
      // Update existing
      existing[existingIndex] = newUpload;
    } else {
      // Add new
      existing.push(newUpload);
    }

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch (error) {
    console.error("Error saving pending upload:", error);
  }
}

/**
 * Lấy pending upload cho một store cụ thể
 */
export async function getPendingUploadForStore(
  storeId: number
): Promise<PendingUpload | null> {
  try {
    const pending = await getPendingUploads();
    // Lấy upload mới nhất cho store này
    const storeUploads = pending
      .filter((u) => u.storeId === storeId)
      .sort((a, b) => b.timestamp - a.timestamp);

    return storeUploads.length > 0 ? storeUploads[0] : null;
  } catch (error) {
    console.error("Error getting pending upload:", error);
    return null;
  }
}

/**
 * Lấy tất cả pending uploads
 */
export async function getPendingUploads(): Promise<PendingUpload[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error("Error getting pending uploads:", error);
    return [];
  }
}

/**
 * Xóa pending upload sau khi upload thành công
 */
export async function removePendingUpload(
  storeId: number,
  auditId: number
): Promise<void> {
  try {
    const existing = await getPendingUploads();
    const filtered = existing.filter(
      (u) => !(u.storeId === storeId && u.auditId === auditId)
    );
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("Error removing pending upload:", error);
  }
}

/**
 * Xóa tất cả pending uploads của một store cụ thể
 */
export async function clearPendingUploadsForStore(
  storeId: number
): Promise<void> {
  try {
    const existing = await getPendingUploads();
    const filtered = existing.filter((u) => u.storeId !== storeId);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("Error clearing pending uploads for store:", error);
  }
}

/**
 * Xóa tất cả pending uploads (cleanup)
 */
export async function clearAllPendingUploads(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Error clearing pending uploads:", error);
  }
}


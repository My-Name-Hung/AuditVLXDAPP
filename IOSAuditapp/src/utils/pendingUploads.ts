/**
 * Utility để quản lý pending image uploads
 * Lưu ảnh vào localStorage và tự động upload khi rời trang
 */

interface PendingUpload {
  storeId: number;
  auditId: number;
  images: Array<{
    dataUrl: string;
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
 * Lưu pending upload vào localStorage
 */
export function savePendingUpload(
  storeId: number,
  auditId: number,
  images: Array<{
    dataUrl: string;
    latitude: number;
    longitude: number;
    timestamp: string;
    timezoneOffset: number;
  }>,
  notes?: string
): void {
  try {
    const existing = getPendingUploads();
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

    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch (error) {
    console.error("Error saving pending upload:", error);
  }
}

/**
 * Lấy pending upload cho một store cụ thể
 */
export function getPendingUploadForStore(
  storeId: number
): PendingUpload | null {
  try {
    const pending = getPendingUploads();
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
export function getPendingUploads(): PendingUpload[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
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
export function removePendingUpload(storeId: number, auditId: number): void {
  try {
    const existing = getPendingUploads();
    const filtered = existing.filter(
      (u) => !(u.storeId === storeId && u.auditId === auditId)
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("Error removing pending upload:", error);
  }
}

/**
 * Xóa tất cả pending uploads của một store cụ thể
 */
export function clearPendingUploadsForStore(storeId: number): void {
  try {
    const existing = getPendingUploads();
    const filtered = existing.filter((u) => u.storeId !== storeId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("Error clearing pending uploads for store:", error);
  }
}

/**
 * Xóa tất cả pending uploads (cleanup)
 */
export function clearAllPendingUploads(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Error clearing pending uploads:", error);
  }
}


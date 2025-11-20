import { useState, useEffect } from 'react';
import './PermissionModal.css';

interface PermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGrant: () => void;
  permissions: {
    camera: boolean;
    location: boolean;
  };
}

export default function PermissionModal({
  isOpen,
  onClose,
  onGrant,
  permissions,
}: PermissionModalProps) {
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      requestPermissions();
    }
  }, [isOpen]);

  const requestPermissions = async () => {
    setRequesting(true);
    try {
      // Request camera permission
      if (!permissions.camera) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach((track) => track.stop());
        } catch (error) {
          console.warn('Camera permission denied:', error);
        }
      }

      // Request location permission
      if (!permissions.location) {
        try {
          await navigator.geolocation.getCurrentPosition(
            () => {},
            () => {}
          );
        } catch (error) {
          console.warn('Location permission denied:', error);
        }
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
    } finally {
      setRequesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="permission-modal-overlay">
      <div className="permission-modal-content">
        <div className="permission-modal-icon">📷</div>
        <h2 className="permission-modal-title">Yêu cầu quyền truy cập</h2>
        <p className="permission-modal-message">
          Ứng dụng cần quyền truy cập camera và vị trí để chụp ảnh audit và ghi nhận thông tin địa
          điểm.
        </p>
        <div className="permission-modal-buttons">
          <button className="permission-modal-button permission-modal-button-cancel" onClick={onClose}>
            Hủy
          </button>
          <button
            className="permission-modal-button permission-modal-button-grant"
            onClick={onGrant}
            disabled={requesting}
          >
            {requesting ? 'Đang xử lý...' : 'Cho phép'}
          </button>
        </div>
      </div>
    </div>
  );
}


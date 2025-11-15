import { useEffect } from "react";
import { HiCheckCircle, HiXCircle } from "react-icons/hi";
import "./NotificationModal.css";

interface NotificationModalProps {
  isOpen: boolean;
  type: "success" | "error";
  message: string;
  onClose: () => void;
  duration?: number; // Auto close after duration (ms), 0 = no auto close
}

export default function NotificationModal({
  isOpen,
  type,
  message,
  onClose,
  duration = 3000,
}: NotificationModalProps) {
  useEffect(() => {
    if (isOpen && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isOpen, duration, onClose]);

  if (!isOpen) return null;

  return (
    <div className="notification-modal-overlay" onClick={onClose}>
      <div
        className={`notification-modal ${type}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="notification-icon">
          {type === "success" ? (
            <HiCheckCircle />
          ) : (
            <HiXCircle />
          )}
        </div>
        <div className="notification-content">
          <h3 className="notification-title">
            {type === "success" ? "Thành công" : "Thất bại"}
          </h3>
          <p className="notification-message">{message}</p>
        </div>
        <button className="notification-close" onClick={onClose}>
          ×
        </button>
      </div>
    </div>
  );
}


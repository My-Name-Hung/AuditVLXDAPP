import React from "react";
import "./LoadingModal.css";

interface LoadingModalProps {
  isOpen: boolean;
  message?: string;
  progress?: number; // 0-100
}

export default function LoadingModal({ isOpen, message = "Đang xử lý...", progress }: LoadingModalProps) {
  if (!isOpen) return null;

  return (
    <div className="loading-modal-overlay">
      <div className="loading-modal">
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
        <p className="loading-message">{message}</p>
        {progress !== undefined && (
          <div className="progress-container">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              ></div>
            </div>
            <span className="progress-text">{Math.round(progress)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}


import React from "react";
import { isIOSDevice } from "../utils/deviceDetection";
import "./DeviceCheck.css";

export default function DeviceCheck({
  children,
}: {
  children: React.ReactNode;
}) {
  const isIOS = isIOSDevice();

  if (!isIOS) {
    return (
      <div className="device-check-container">
        <div className="device-check-content">
          <div className="device-check-icon">📱</div>
          <h1 className="device-check-title">Web này chỉ phục vụ iOS</h1>
          <p className="device-check-message">
            Vui lòng truy cập từ thiết bị iPhone hoặc iPad để sử dụng ứng dụng.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

import { useState } from "react";
import { HiArrowLeft } from "react-icons/hi2";
import { useNavigate } from "react-router-dom";
import LoadingModal from "../components/LoadingModal";
import NotificationModal from "../components/NotificationModal";
import Select from "../components/Select";
import api from "../services/api";
import "./UserAdd.css";

export default function UserAdd() {
  const navigate = useNavigate();
  const [createLoading, setCreateLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [notification, setNotification] = useState<{
    isOpen: boolean;
    type: "success" | "error";
    message: string;
  }>({
    isOpen: false,
    type: "success",
    message: "",
  });

  const [formData, setFormData] = useState({
    username: "",
    fullName: "",
    email: "",
    phone: "",
    role: "sales" as "admin" | "sales",
  });

  const hasFormData = () => {
    return (
      formData.username.trim() !== "" ||
      formData.fullName.trim() !== "" ||
      formData.email.trim() !== "" ||
      formData.phone.trim() !== ""
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.username.trim()) {
      setNotification({
        isOpen: true,
        type: "error",
        message: "Vui lòng nhập tên đăng nhập.",
      });
      return;
    }

    if (!formData.fullName.trim()) {
      setNotification({
        isOpen: true,
        type: "error",
        message: "Vui lòng nhập tên nhân viên.",
      });
      return;
    }

    if (!formData.email.trim()) {
      setNotification({
        isOpen: true,
        type: "error",
        message: "Vui lòng nhập email.",
      });
      return;
    }

    if (!formData.phone.trim()) {
      setNotification({
        isOpen: true,
        type: "error",
        message: "Vui lòng nhập số điện thoại.",
      });
      return;
    }

    try {
      setCreateLoading(true);

      const payload = {
        username: formData.username.trim(),
        password: "123456", // Default password
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        role: formData.role,
      };

      await api.post("/users", payload);

      setCreateLoading(false);
      setNotification({
        isOpen: true,
        type: "success",
        message: `Đã tạo nhân viên "${formData.fullName}" thành công.`,
      });

      // Navigate to users list after a short delay
      setTimeout(() => {
        navigate("/users");
      }, 1500);
    } catch (error: any) {
      console.error("Error creating user:", error);
      setCreateLoading(false);
      setNotification({
        isOpen: true,
        type: "error",
        message:
          error.response?.data?.error ||
          "Lỗi khi tạo nhân viên. Vui lòng thử lại.",
      });
    }
  };

  const handleCancel = () => {
    if (hasFormData()) {
      setShowCancelModal(true);
    } else {
      navigate("/users");
    }
  };

  const roleOptions = [
    { id: "admin", name: "Admin" },
    { id: "sales", name: "Sales" },
  ];

  return (
    <div className="user-add-container">
      <div className="user-add-header">
        <button className="btn-back" onClick={handleCancel}>
          <HiArrowLeft /> Quay lại
        </button>
        <h1>Thêm nhân viên</h1>
      </div>

      <form onSubmit={handleSubmit} className="user-add-form">
        <div className="form-group">
          <label>
            Tên đăng nhập <span className="required">*</span>
          </label>
          <input
            type="text"
            value={formData.username}
            onChange={(e) =>
              setFormData({ ...formData, username: e.target.value })
            }
            placeholder="Nhập tên đăng nhập"
            required
          />
        </div>

        <div className="form-group">
          <label>Mật khẩu mặc định</label>
          <input
            type="text"
            value="123456"
            disabled
            className="form-input disabled"
          />
          <small style={{ color: "#666", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Mật khẩu mặc định cho nhân viên mới là "123456"
          </small>
        </div>

        <div className="form-group">
          <label>
            Tên nhân viên <span className="required">*</span>
          </label>
          <input
            type="text"
            value={formData.fullName}
            onChange={(e) =>
              setFormData({ ...formData, fullName: e.target.value })
            }
            placeholder="Nhập tên nhân viên"
            required
          />
        </div>

        <div className="form-group">
          <label>
            Email <span className="required">*</span>
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            placeholder="Nhập email"
            required
          />
        </div>

        <div className="form-group">
          <label>
            Số điện thoại <span className="required">*</span>
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
            placeholder="Nhập số điện thoại"
            required
          />
        </div>

        <div className="form-group">
          <label>
            Vai trò <span className="required">*</span>
          </label>
          <Select
            options={roleOptions}
            value={formData.role}
            onChange={(value) =>
              setFormData({ ...formData, role: value as "admin" | "sales" })
            }
            placeholder="Chọn vai trò"
            searchable={false}
          />
        </div>

        <div className="form-actions">
          <button type="button" className="btn-cancel" onClick={handleCancel}>
            Hủy
          </button>
          <button type="submit" className="btn-submit">
            Tạo nhân viên
          </button>
        </div>
      </form>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Xác nhận hủy</h3>
            <p>Bạn có chắc muốn hủy? Dữ liệu đã nhập sẽ bị mất.</p>
            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={() => setShowCancelModal(false)}
              >
                Không
              </button>
              <button
                className="btn-confirm"
                onClick={() => navigate("/users")}
              >
                Có, hủy
              </button>
            </div>
          </div>
        </div>
      )}

      <LoadingModal
        isOpen={createLoading}
        message="Đang tạo nhân viên..."
        progress={0}
      />

      <NotificationModal
        isOpen={notification.isOpen}
        type={notification.type}
        message={notification.message}
        onClose={() => setNotification({ ...notification, isOpen: false })}
      />
    </div>
  );
}


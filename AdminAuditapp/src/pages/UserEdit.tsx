import { useEffect, useState } from "react";
import { HiArrowLeft } from "react-icons/hi2";
import { useNavigate, useParams } from "react-router-dom";
import LoadingModal from "../components/LoadingModal";
import NotificationModal from "../components/NotificationModal";
import Select from "../components/Select";
import api from "../services/api";
import "./UserEdit.css";

interface User {
  Id: number;
  UserCode: string;
  Username: string;
  FullName: string;
  Email: string;
  Phone: string;
  Role: string;
}

export default function UserEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{
    isOpen: boolean;
    type: "success" | "error";
    message: string;
  }>({
    isOpen: false,
    type: "success",
    message: "",
  });
  const [updateLoading, setUpdateLoading] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    role: "sales" as "admin" | "sales",
    password: "",
  });

  useEffect(() => {
    if (id) {
      fetchUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/users/${id}`);
      const data = res.data;
      setUser(data);
      setFormData({
        fullName: data.FullName || "",
        email: data.Email || "",
        phone: data.Phone || "",
        role: data.Role || "sales",
        password: "",
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      setNotification({
        isOpen: true,
        type: "error",
        message: "Không thể tải thông tin nhân viên. Vui lòng thử lại.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    // Validate required fields
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
      setUpdateLoading(true);

      const payload: any = {
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        role: formData.role,
      };

      // Only include password if it's provided
      if (formData.password.trim()) {
        payload.password = formData.password;
      }

      await api.put(`/users/${id}`, payload);

      setUpdateLoading(false);
      setNotification({
        isOpen: true,
        type: "success",
        message: `Đã cập nhật nhân viên "${formData.fullName}" thành công.`,
      });

      // Navigate to users list after a short delay
      setTimeout(() => {
        navigate("/users");
      }, 1500);
    } catch (error: any) {
      console.error("Error updating user:", error);
      setUpdateLoading(false);
      setNotification({
        isOpen: true,
        type: "error",
        message:
          error.response?.data?.error ||
          "Lỗi khi cập nhật nhân viên. Vui lòng thử lại.",
      });
    }
  };

  const roleOptions = [
    { id: "admin", name: "Admin" },
    { id: "sales", name: "Sales" },
  ];

  if (loading) {
    return (
      <div className="user-edit-container">
        <div className="loading">Đang tải...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="user-edit-container">
        <div className="error">Không tìm thấy nhân viên.</div>
      </div>
    );
  }

  return (
    <div className="user-edit-container">
      <div className="user-edit-header">
        <button className="btn-back" onClick={() => navigate("/users")}>
          <HiArrowLeft /> Quay lại
        </button>
        <h1>Chỉnh sửa nhân viên</h1>
      </div>

      <form onSubmit={handleSubmit} className="user-edit-form">
        <div className="form-group">
          <label>Mã nhân viên</label>
          <input
            type="text"
            value={user.UserCode}
            disabled
            className="form-input disabled"
          />
        </div>

        <div className="form-group">
          <label>Tên đăng nhập</label>
          <input
            type="text"
            value={user.Username}
            disabled
            className="form-input disabled"
          />
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

        <div className="form-group">
          <label>Mật khẩu mới (để trống nếu không đổi)</label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
            placeholder="Nhập mật khẩu mới"
          />
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn-cancel"
            onClick={() => navigate("/users")}
          >
            Hủy
          </button>
          <button type="submit" className="btn-submit">
            Cập nhật
          </button>
        </div>
      </form>

      <LoadingModal
        isOpen={updateLoading}
        message="Đang cập nhật nhân viên..."
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


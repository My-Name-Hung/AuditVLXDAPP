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
  Position?: string | null;
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

  const DEFAULT_POSITIONS = ["Quản trị Viên", "Nhân viên Thị Trường"];
  const [positionOptions, setPositionOptions] = useState<string[]>(DEFAULT_POSITIONS);
  const [isAddingPosition, setIsAddingPosition] = useState(false);
  const [newPositionValue, setNewPositionValue] = useState("");

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    role: "sales" as "admin" | "sales",
    position: "",
    password: "",
  });

  useEffect(() => {
    fetchPositions();
  }, []);

  useEffect(() => {
    if (id) {
      fetchUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const mergePositionOptions = (current: string[], incoming: string[]) => {
    const normalized = [...current];
    incoming.forEach((item) => {
      const trimmed = item?.trim();
      if (trimmed && !normalized.includes(trimmed)) {
        normalized.push(trimmed);
      }
    });
    return normalized;
  };

  const fetchPositions = async () => {
    try {
      const res = await api.get<string[]>("/users/positions");
      if (Array.isArray(res.data)) {
        setPositionOptions((prev) => mergePositionOptions(prev, res.data));
      }
    } catch (error) {
      console.warn("Không thể tải danh sách chức vụ:", error);
    }
  };

  const ensurePositionOption = (value: string) => {
    if (!value) return;
    setPositionOptions((prev) =>
      prev.includes(value) ? prev : [...prev, value]
    );
  };

  const getDefaultPositionForRole = (role: string) => {
    const expected = role === "admin" ? "Quản trị Viên" : "Nhân viên Thị Trường";
    ensurePositionOption(expected);
    return expected;
  };

  const fetchUser = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/users/${id}`);
      const data = res.data;
      setUser(data);
      const resolvedPosition =
        (data.Position && data.Position.trim()) ||
        getDefaultPositionForRole(data.Role || "sales");
      ensurePositionOption(resolvedPosition);
      setFormData({
        fullName: data.FullName || "",
        email: data.Email || "",
        phone: data.Phone || "",
        role: data.Role || "sales",
        position: resolvedPosition,
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

    if (!formData.position.trim()) {
      setNotification({
        isOpen: true,
        type: "error",
        message: "Vui lòng chọn hoặc thêm chức vụ.",
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
        position: formData.position.trim(),
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

  const positionSelectOptions = positionOptions.map((pos) => ({
    id: pos,
    name: pos,
  }));

  const handleRoleChange = (value: string | number | null) => {
    if (!value || typeof value === "number") {
      return;
    }
    const role = value as "admin" | "sales";
    const prevDefault = getDefaultPositionForRole(formData.role);
    const nextDefault = getDefaultPositionForRole(role);
    const shouldReplace =
      !formData.position ||
      formData.position === prevDefault ||
      !positionOptions.includes(formData.position);
    const updatedPosition = shouldReplace ? nextDefault : formData.position;
    setFormData((prev) => ({
      ...prev,
      role,
      position: updatedPosition,
    }));
  };

  const handleAddPosition = () => {
    if (!newPositionValue.trim()) {
      setNotification({
        isOpen: true,
        type: "error",
        message: "Vui lòng nhập tên chức vụ.",
      });
      return;
    }
    const value = newPositionValue.trim();
    ensurePositionOption(value);
    setFormData((prev) => ({ ...prev, position: value }));
    setNewPositionValue("");
    setIsAddingPosition(false);
  };

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
          <label>Email</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            placeholder="Nhập email (có thể bỏ trống)"
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
            onChange={handleRoleChange}
            placeholder="Chọn vai trò"
            searchable={false}
          />
        </div>

        <div className="form-group">
          <label>
            Chức vụ <span className="required">*</span>
          </label>
          <div className="position-select-group">
            <div className="position-select">
              <Select
                options={positionSelectOptions}
                value={formData.position}
                onChange={(value) =>
                  setFormData({
                    ...formData,
                    position: value ? String(value) : "",
                  })
                }
                placeholder="Chọn chức vụ"
                searchable={true}
              />
            </div>
            <button
              type="button"
              className="btn-add-position"
              onClick={() => {
                setIsAddingPosition((prev) => !prev);
                setNewPositionValue("");
              }}
            >
              {isAddingPosition ? "Hủy" : "Thêm chức vụ"}
            </button>
          </div>
          {isAddingPosition && (
            <div className="position-add-inline">
              <input
                type="text"
                value={newPositionValue}
                onChange={(e) => setNewPositionValue(e.target.value)}
                placeholder="Nhập tên chức vụ mới"
              />
              <button
                type="button"
                className="btn-save-position"
                onClick={handleAddPosition}
              >
                Lưu
              </button>
            </div>
          )}
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


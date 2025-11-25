import { useEffect, useState } from "react";
import { HiArrowLeft } from "react-icons/hi2";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import LoadingModal from "../components/LoadingModal";
import MultiSelect from "../components/MultiSelect";
import NotificationModal from "../components/NotificationModal";
import Select from "../components/Select";
import api from "../services/api";
import "./UserEdit.css";

interface AssignedStore {
  StoreId: number;
  StoreName: string;
  StoreCode: string;
}

interface User {
  Id: number;
  UserCode: string;
  Username: string;
  FullName: string;
  Email: string;
  Phone: string;
  Role: string;
  Position?: string | null;
  AssignedStores?: AssignedStore[];
}

const DEFAULT_POSITIONS = ["Quản trị Viên", "Nhân viên Thị Trường"];

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

export default function UserEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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

  const location = useLocation();
  const preloadedUser =
    (location.state as { user?: User } | null)?.user || null;
  const initialRole = preloadedUser?.Role || "sales";
  const initialPosition =
    (preloadedUser?.Position && preloadedUser.Position.trim()) ||
    (initialRole === "admin" ? "Quản trị Viên" : "Nhân viên Thị Trường");

  const [positionOptions, setPositionOptions] = useState<string[]>(
    mergePositionOptions(DEFAULT_POSITIONS, [initialPosition])
  );
  const [isAddingPosition, setIsAddingPosition] = useState(false);
  const [newPositionValue, setNewPositionValue] = useState("");
  const initialStoreIds =
    preloadedUser?.AssignedStores?.map((store) => store.StoreId) || [];
  const [storeOptions, setStoreOptions] = useState<
    { id: number; name: string }[]
  >([]);
  const [storeOptionsLoading, setStoreOptionsLoading] = useState(false);
  const [storeAssignmentMode, setStoreAssignmentMode] = useState<
    "none" | "all" | "custom"
  >(initialStoreIds.length > 0 ? "custom" : "none");
  const [selectedStoreIds, setSelectedStoreIds] =
    useState<number[]>(initialStoreIds);
  const [storeAssignmentError, setStoreAssignmentError] = useState("");

  const [formData, setFormData] = useState({
    fullName: preloadedUser?.FullName || "",
    email: preloadedUser?.Email || "",
    phone: preloadedUser?.Phone || "",
    role: (initialRole as "admin" | "sales") || "sales",
    position: initialPosition,
    password: "",
  });
  const [user, setUser] = useState<User | null>(preloadedUser);
  const [loading, setLoading] = useState(!preloadedUser);

  useEffect(() => {
    fetchPositions();
  }, []);

  useEffect(() => {
    if (id) {
      fetchUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const fetchStoreOptions = async () => {
      try {
        setStoreOptionsLoading(true);
        const res = await api.get("/stores/options");
        const data = res.data?.data || res.data || [];
        if (Array.isArray(data)) {
          setStoreOptions(
            data.map((item: { Id: number; StoreName: string; StoreCode: string }) => ({
              id: item.Id,
              name: `${item.StoreName} (${item.StoreCode})`,
            }))
          );
        }
      } catch (error) {
        console.error("Không thể tải danh sách cửa hàng:", error);
        setStoreOptions([]);
      } finally {
        setStoreOptionsLoading(false);
      }
    };
    fetchStoreOptions();
  }, []);

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
    const expected =
      role === "admin" ? "Quản trị Viên" : "Nhân viên Thị Trường";
    ensurePositionOption(expected);
    return expected;
  };

  const fetchUser = async () => {
    try {
      if (!preloadedUser) {
        setLoading(true);
      }
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
      const assignedStoreIds =
        Array.isArray(data.AssignedStores) && data.AssignedStores.length > 0
          ? data.AssignedStores.map((store: AssignedStore) =>
              Number(store.StoreId)
            ).filter((value: number) => !Number.isNaN(value))
          : [];
      setSelectedStoreIds(assignedStoreIds);
      setStoreAssignmentMode(
        assignedStoreIds.length > 0 ? "custom" : "none"
      );
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

    if (storeAssignmentMode === "custom" && selectedStoreIds.length === 0) {
      setStoreAssignmentError("Vui lòng chọn ít nhất một cửa hàng.");
      return;
    }
    setStoreAssignmentError("");

    try {
      setUpdateLoading(true);

      const payload: {
        fullName: string;
        email: string | null;
        phone: string;
        role: string;
        position: string;
        password?: string;
        storeAssignment?: {
          mode: "none" | "all" | "custom";
          storeIds?: number[];
        };
      } = {
        fullName: formData.fullName.trim(),
        email: formData.email?.trim() || null,
        phone: formData.phone.trim(),
        role: formData.role,
        position: formData.position.trim(),
      };

      // Only include password if it's provided
      if (formData.password.trim()) {
        payload.password = formData.password;
      }

      if (storeAssignmentMode === "all") {
        payload.storeAssignment = { mode: "all" };
      } else if (storeAssignmentMode === "custom") {
        payload.storeAssignment = {
          mode: "custom",
          storeIds: selectedStoreIds,
        };
      } else if (storeAssignmentMode === "none") {
        payload.storeAssignment = { mode: "none" };
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
    } catch (error: unknown) {
      console.error("Error updating user:", error);
      setUpdateLoading(false);
      const errorMessage =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Lỗi khi cập nhật nhân viên. Vui lòng thử lại.";
      setNotification({
        isOpen: true,
        type: "error",
        message: errorMessage,
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
        <LoadingModal
          isOpen={true}
          message="Đang tải dữ liệu nhân viên..."
          progress={0}
        />
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
          <label>Phân công cửa hàng</label>
          <div className="store-assignment-options">
            <label className="store-assignment-option">
              <input
                type="radio"
                name="storeAssignmentMode"
                value="none"
                checked={storeAssignmentMode === "none"}
                onChange={() => {
                  setStoreAssignmentMode("none");
                  setSelectedStoreIds([]);
                  setStoreAssignmentError("");
                }}
              />
              <span>Chưa gán</span>
            </label>
            <label className="store-assignment-option">
              <input
                type="radio"
                name="storeAssignmentMode"
                value="all"
                checked={storeAssignmentMode === "all"}
                onChange={() => {
                  setStoreAssignmentMode("all");
                  setSelectedStoreIds([]);
                  setStoreAssignmentError("");
                }}
              />
              <span>Gán cho tất cả cửa hàng</span>
            </label>
            <label className="store-assignment-option">
              <input
                type="radio"
                name="storeAssignmentMode"
                value="custom"
                checked={storeAssignmentMode === "custom"}
                onChange={() => {
                  setStoreAssignmentMode("custom");
                  setStoreAssignmentError("");
                }}
              />
              <span>Chọn cửa hàng cụ thể</span>
            </label>
          </div>
          <small className="store-assignment-helper">
            Các cửa hàng được chọn tại đây sẽ hiển thị ngay khi nhân viên đăng
            nhập ứng dụng.
          </small>
          {storeAssignmentMode === "custom" && (
            <div className="store-assignment-selector">
              {storeOptionsLoading ? (
                <p className="store-assignment-helper">
                  Đang tải danh sách cửa hàng...
                </p>
              ) : (
                <MultiSelect
                  options={storeOptions}
                  selected={selectedStoreIds}
                  onChange={setSelectedStoreIds}
                  placeholder="Chọn cửa hàng cần phân công"
                  itemLabel="cửa hàng"
                  searchPlaceholder="Tìm cửa hàng theo mã hoặc tên..."
                  enableSelectAll
                  selectAllLabel="Chọn toàn bộ trong danh sách"
                />
              )}
              {selectedStoreIds.length > 0 && (
                <small className="store-assignment-helper">
                  Đã chọn {selectedStoreIds.length} cửa hàng.
                </small>
              )}
              {storeAssignmentError && (
                <small className="store-assignment-error">
                  {storeAssignmentError}
                </small>
              )}
            </div>
          )}
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

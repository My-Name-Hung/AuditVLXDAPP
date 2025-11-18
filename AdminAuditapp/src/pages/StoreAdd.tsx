import { useEffect, useState } from "react";
import { HiArrowLeft } from "react-icons/hi2";
import { useNavigate } from "react-router-dom";
import LoadingModal from "../components/LoadingModal";
import NotificationModal from "../components/NotificationModal";
import Select from "../components/Select";
import api from "../services/api";
import "./StoreAdd.css";

interface Territory {
  Id: number;
  TerritoryName: string;
}

interface User {
  Id: number;
  FullName: string;
  UserCode: string;
}

export default function StoreAdd() {
  const navigate = useNavigate();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [users, setUsers] = useState<User[]>([]);
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
    storeName: "",
    address: "",
    phone: "",
    email: "",
    territoryId: null as number | null,
    userId: null as number | null,
    rank: null as number | string | null,
    taxCode: "",
    partnerName: "",
    openDate: "",
  });

  useEffect(() => {
    fetchTerritories();
    fetchUsers();
  }, []);

  const fetchTerritories = async () => {
    try {
      const res = await api.get("/territories");
      setTerritories(res.data.data || []);
    } catch (error) {
      console.error("Error fetching territories:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get("/users");
      console.log("Users response:", res.data);
      // Handle both response formats: { data: [...] } or [...]
      const usersData = res.data.data || res.data || [];
      setUsers(usersData);
      console.log("Users loaded:", usersData.length);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.territoryId) {
      setNotification({
        isOpen: true,
        type: "error",
        message: "Vui lòng chọn địa bàn phụ trách.",
      });
      return;
    }

    if (!formData.userId) {
      setNotification({
        isOpen: true,
        type: "error",
        message: "Vui lòng chọn user phụ trách.",
      });
      return;
    }

    try {
      setCreateLoading(true);

      const payload = {
        storeName: formData.storeName,
        address: formData.address,
        phone: formData.phone || null,
        email: formData.email || null,
        territoryId: formData.territoryId,
        userId: formData.userId,
        rank: formData.rank ? parseInt(formData.rank.toString()) : null,
        taxCode: formData.taxCode || null,
        partnerName: formData.partnerName || null,
        // Latitude and Longitude will be null - auto updated when user takes photo
        latitude: null,
        longitude: null,
        openDate: formData.openDate || null,
      };

      await api.post("/stores", payload);
      
      setCreateLoading(false);
      setNotification({
        isOpen: true,
        type: "success",
        message: `Đã tạo cửa hàng "${formData.storeName}" thành công.`,
      });

      // Navigate back to stores list after 1.5 seconds
      // The stores list will automatically refresh when navigated to
      setTimeout(() => {
        navigate("/stores", { replace: true });
      }, 1500);
    } catch (error: unknown) {
      console.error("Error creating store:", error);
      setCreateLoading(false);
      const errorMessage =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Lỗi khi tạo cửa hàng. Vui lòng thử lại.";
      setNotification({
        isOpen: true,
        type: "error",
        message: errorMessage,
      });
    }
  };

  const handleCancel = () => {
    // Check if form has any data
    const hasData = 
      formData.storeName ||
      formData.address ||
      formData.phone ||
      formData.email ||
      formData.territoryId ||
      formData.userId ||
      formData.rank ||
      formData.taxCode ||
      formData.partnerName;

    if (hasData) {
      setShowCancelModal(true);
    } else {
      navigate("/stores");
    }
  };

  const handleCancelConfirm = () => {
    setShowCancelModal(false);
    navigate("/stores");
  };

  const rankOptions = [
    { id: null, name: "Chọn cấp..." },
    { id: 1, name: "Cấp 1" },
    { id: 2, name: "Cấp 2" },
  ];

  const territoryOptions = territories.map((t) => ({
    id: t.Id,
    name: t.TerritoryName,
  }));

  const userOptions = [
    { id: null, name: "Chọn user..." },
    ...users.map((u) => ({
      id: u.Id,
      name: `${u.FullName} (${u.UserCode})`,
    })),
  ];

  return (
    <div className="store-add">
      <div className="store-add-header">
        <button className="btn-back" onClick={handleCancel}>
          <HiArrowLeft /> Quay lại
        </button>
      </div>

      <div className="store-add-content">
        <h2>Thêm cửa hàng mới</h2>

        <form onSubmit={handleSubmit} className="store-form">
          <div className="form-section">
            <h3>Thông tin cơ bản</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>
                  Tên cửa hàng <span className="required">*</span>
                </label>
                <input
                  type="text"
                  value={formData.storeName}
                  onChange={(e) =>
                    setFormData({ ...formData, storeName: e.target.value })
                  }
                  className="form-input"
                  required
                />
              </div>
              <div className="form-group">
                <label>
                  Địa chỉ <span className="required">*</span>
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  className="form-input"
                  rows={3}
                  required
                />
              </div>
              <div className="form-group">
                <label>Số điện thoại</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="form-input"
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
                  className="form-input"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Thông tin bổ sung</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>
                  Ngày mở audit <span className="required">*</span>
                </label>
                <input
                  type="date"
                  value={formData.openDate}
                  onChange={(e) =>
                    setFormData({ ...formData, openDate: e.target.value })
                  }
                  className="form-input"
                  required
                />
              </div>
              <div className="form-group">
                <label>Cấp cửa hàng</label>
                <Select
                  options={rankOptions}
                  value={formData.rank}
                  onChange={(value) =>
                    setFormData({ ...formData, rank: value })
                  }
                  placeholder="Chọn cấp..."
                />
              </div>
              <div className="form-group">
                <label>Mã số thuế</label>
                <input
                  type="text"
                  value={formData.taxCode}
                  onChange={(e) =>
                    setFormData({ ...formData, taxCode: e.target.value })
                  }
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Tên đối tác</label>
                <input
                  type="text"
                  value={formData.partnerName}
                  onChange={(e) =>
                    setFormData({ ...formData, partnerName: e.target.value })
                  }
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>
                  Địa bàn phụ trách <span className="required">*</span>
                </label>
                <Select
                  options={territoryOptions}
                  value={formData.territoryId}
                  onChange={(value) =>
                    setFormData({
                      ...formData,
                      territoryId: value as number | null,
                    })
                  }
                  placeholder="Chọn địa bàn..."
                  searchable={true}
                />
              </div>
              <div className="form-group">
                <label>
                  User phụ trách <span className="required">*</span>
                </label>
                <Select
                  options={userOptions}
                  value={formData.userId}
                  onChange={(value) =>
                    setFormData({ ...formData, userId: value as number | null })
                  }
                  placeholder="Chọn user..."
                  searchable={true}
                />
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCancel}
            >
              Hủy
            </button>
            <button type="submit" className="btn-primary">
              Hoàn tất
            </button>
          </div>
        </form>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowCancelModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Xác nhận hủy</h3>
            <p>
              Bạn có chắc chắn muốn hủy? Tất cả thay đổi sẽ không được lưu.
            </p>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowCancelModal(false)}
              >
                Tiếp tục chỉnh sửa
              </button>
              <button className="btn-primary" onClick={handleCancelConfirm}>
                Hủy không lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Modal for Create */}
      <LoadingModal
        isOpen={createLoading}
        message="Đang tạo cửa hàng..."
        progress={0}
      />

      {/* Notification Modal */}
      <NotificationModal
        isOpen={notification.isOpen}
        type={notification.type}
        message={notification.message}
        onClose={() => setNotification({ ...notification, isOpen: false })}
        duration={3000}
      />
    </div>
  );
}


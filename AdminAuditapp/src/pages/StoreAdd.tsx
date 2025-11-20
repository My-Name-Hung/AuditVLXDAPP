import { useEffect, useState } from "react";
import { HiArrowLeft } from "react-icons/hi2";
import { useNavigate } from "react-router-dom";
import LoadingModal from "../components/LoadingModal";
import MultiSelect from "../components/MultiSelect";
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
    rank: null as number | string | null,
    taxCode: "",
    partnerName: "",
  });
  const [assignedUserIds, setAssignedUserIds] = useState<number[]>([]);
  const [addTerritoryModalOpen, setAddTerritoryModalOpen] = useState(false);
  const [newTerritoryName, setNewTerritoryName] = useState("");
  const [addTerritoryLoading, setAddTerritoryLoading] = useState(false);

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

    if (assignedUserIds.length === 0) {
      setNotification({
        isOpen: true,
        type: "error",
        message: "Vui lòng chọn ít nhất một nhân viên được gán để thực thi.",
      });
      return;
    }

    try {
      setCreateLoading(true);

      // Auto-set userId to first assigned user (for backward compatibility)
      const primaryUserId =
        assignedUserIds.length > 0 ? assignedUserIds[0] : null;

      const payload = {
        storeName: formData.storeName,
        address: formData.address,
        phone: formData.phone || null,
        email: formData.email || null,
        territoryId: formData.territoryId,
        userId: primaryUserId, // Auto-set from first assigned user
        rank: formData.rank ? parseInt(formData.rank.toString()) : null,
        taxCode: formData.taxCode || null,
        partnerName: formData.partnerName || null,
        // Latitude and Longitude will be null - auto updated when user takes photo
        latitude: null,
        longitude: null,
      };

      const res = await api.post("/stores", payload);
      const createdStore = res.data;

      // Assign users to store
      await api.put(`/stores/${createdStore.Id}/users`, {
        userIds: assignedUserIds,
      });

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
      assignedUserIds.length > 0 ||
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

  const handleAddTerritory = async () => {
    if (!newTerritoryName.trim()) {
      setNotification({
        isOpen: true,
        type: "error",
        message: "Vui lòng nhập tên địa bàn phụ trách.",
      });
      return;
    }

    try {
      setAddTerritoryLoading(true);
      const res = await api.post("/territories", {
        territoryName: newTerritoryName.trim(),
      });
      const newTerritory = res.data.data;
      setTerritories([...territories, newTerritory]);

      // Close modal and reset form
      setAddTerritoryModalOpen(false);
      setNewTerritoryName("");

      // Show success notification
      setNotification({
        isOpen: true,
        type: "success",
        message: `Đã thêm địa bàn "${newTerritory.TerritoryName}" thành công.`,
      });
    } catch (error: unknown) {
      console.error("Error adding territory:", error);
      const errorMessage =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Lỗi khi thêm địa bàn. Vui lòng thử lại.";
      setNotification({
        isOpen: true,
        type: "error",
        message: errorMessage,
      });
    } finally {
      setAddTerritoryLoading(false);
    }
  };

  const handleCancelAddTerritory = () => {
    setAddTerritoryModalOpen(false);
    setNewTerritoryName("");
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

  // No longer need userOptions for single select

  return (
    <div className="store-add">
      <div className="store-add-header">
        <button className="btn-back" onClick={handleCancel}>
          <HiArrowLeft /> Quay lại
        </button>
        <div>
          <p className="page-kicker">Thêm cửa hàng mới</p>
        </div>
        <button
          className="btn-add-territory"
          onClick={() => setAddTerritoryModalOpen(true)}
        >
          Thêm địa bàn phụ trách
        </button>
      </div>

      <div className="store-add-content">
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
                  Users được gán để audit (có thể chọn nhiều){" "}
                  <span className="required">*</span>
                </label>
                <MultiSelect
                  options={users.map((u) => ({
                    id: u.Id,
                    name: `${u.FullName} (${u.UserCode})`,
                  }))}
                  selected={assignedUserIds}
                  onChange={setAssignedUserIds}
                  placeholder="Chọn users được gán để audit..."
                />
                <small
                  style={{
                    color: "#666",
                    fontSize: "12px",
                    marginTop: "4px",
                    display: "block",
                  }}
                >
                  Chỉ các users được gán mới có quyền audit cửa hàng này. User
                  đầu tiên sẽ được đặt làm user phụ trách chính.
                </small>
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
            <p>Bạn có chắc chắn muốn hủy? Tất cả thay đổi sẽ không được lưu.</p>
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

      {/* Add Territory Modal */}
      {addTerritoryModalOpen && (
        <div className="modal-overlay" onClick={handleCancelAddTerritory}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Thêm địa bàn phụ trách</h3>
            <div className="form-group" style={{ marginTop: "20px" }}>
              <label>
                Tên địa bàn phụ trách <span className="required">*</span>
              </label>
              <input
                type="text"
                value={newTerritoryName}
                onChange={(e) => setNewTerritoryName(e.target.value)}
                className="form-input"
                placeholder="Nhập tên địa bàn phụ trách"
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={handleCancelAddTerritory}
                disabled={addTerritoryLoading}
              >
                Hủy
              </button>
              <button
                className="btn-primary"
                onClick={handleAddTerritory}
                disabled={addTerritoryLoading}
              >
                {addTerritoryLoading ? "Đang thêm..." : "Thêm"}
              </button>
            </div>
          </div>
        </div>
      )}

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

import { useEffect, useState } from "react";
import { HiArrowLeft } from "react-icons/hi2";
import { useNavigate, useParams } from "react-router-dom";
import LoadingModal from "../components/LoadingModal";
import NotificationModal from "../components/NotificationModal";
import Select from "../components/Select";
import api from "../services/api";
import "./StoreEdit.css";

interface Store {
  Id: number;
  StoreCode: string;
  StoreName: string;
  Address: string;
  Phone: string;
  Email: string;
  Status: string;
  Rank: number | null;
  TaxCode: string | null;
  PartnerName: string | null;
  TerritoryId: number | null;
  UserId: number | null;
  Latitude: number | null;
  Longitude: number | null;
  OpenDate?: string | null;
}

interface Territory {
  Id: number;
  TerritoryName: string;
}

interface User {
  Id: number;
  FullName: string;
}

export default function StoreEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [users, setUsers] = useState<User[]>([]);
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
  const [addTerritoryModalOpen, setAddTerritoryModalOpen] = useState(false);
  const [newTerritoryName, setNewTerritoryName] = useState("");
  const [addTerritoryLoading, setAddTerritoryLoading] = useState(false);
  const [cancelConfirmModalOpen, setCancelConfirmModalOpen] = useState(false);

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
    latitude: "",
    longitude: "",
    openDate: "",
  });

  useEffect(() => {
    if (id) {
      fetchStore();
      fetchTerritories();
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchStore = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/stores/${id}`);
      const data = res.data;
      setStore(data);
      setFormData({
        storeName: data.StoreName || "",
        address: data.Address || "",
        phone: data.Phone || "",
        email: data.Email || "",
        territoryId: data.TerritoryId,
        userId: data.UserId,
        rank: data.Rank,
        taxCode: data.TaxCode || "",
        partnerName: data.PartnerName || "",
        latitude: data.Latitude?.toString() || "",
        longitude: data.Longitude?.toString() || "",
        openDate: data.OpenDate
          ? new Date(data.OpenDate).toISOString().split("T")[0]
          : "",
      });
    } catch (error) {
      console.error("Error fetching store:", error);
      setNotification({
        isOpen: true,
        type: "error",
        message: "Không thể tải thông tin cửa hàng. Vui lòng thử lại.",
      });
    } finally {
      setLoading(false);
    }
  };

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
      // API returns { data: users[], pagination: {...} }
      const usersData = res.data.data || res.data;
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (error) {
      console.error("Error fetching users:", error);
      setUsers([]);
    }
  };

  const handleAddTerritory = async () => {
    if (!newTerritoryName.trim()) {
      setNotification({
        isOpen: true,
        type: "error",
        message: "Vui lòng nhập tên địa bàn",
      });
      return;
    }

    try {
      setAddTerritoryLoading(true);
      const res = await api.post("/territories", {
        territoryName: newTerritoryName.trim(),
      });

      if (res.data.success) {
        // Add new territory to the list
        const newTerritory = res.data.data;
        setTerritories([...territories, newTerritory]);
        
        // Close modal and reset form
        setAddTerritoryModalOpen(false);
        setNewTerritoryName("");
        
        // Show success notification
        setNotification({
          isOpen: true,
          type: "success",
          message: res.data.message || "Đã thêm địa bàn thành công",
        });
      }
    } catch (error: any) {
      console.error("Error adding territory:", error);
      setNotification({
        isOpen: true,
        type: "error",
        message:
          error.response?.data?.error ||
          "Lỗi khi thêm địa bàn. Vui lòng thử lại.",
      });
    } finally {
      setAddTerritoryLoading(false);
    }
  };

  const handleCancelAddTerritory = () => {
    if (newTerritoryName.trim()) {
      setCancelConfirmModalOpen(true);
    } else {
      setAddTerritoryModalOpen(false);
      setNewTerritoryName("");
    }
  };

  const confirmCancel = () => {
    setCancelConfirmModalOpen(false);
    setAddTerritoryModalOpen(false);
    setNewTerritoryName("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    try {
      setUpdateLoading(true);

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
        // Latitude and Longitude are not editable, keep existing values
        latitude: store?.Latitude || null,
        longitude: store?.Longitude || null,
        openDate: formData.openDate || null,
      };

      await api.put(`/stores/${id}`, payload);

      setUpdateLoading(false);
      setNotification({
        isOpen: true,
        type: "success",
        message: `Đã cập nhật thông tin cửa hàng "${formData.storeName}" thành công.`,
      });

      // Navigate back after 1.5 seconds
      setTimeout(() => {
        navigate("/stores");
      }, 1500);
    } catch (error: unknown) {
      console.error("Error updating store:", error);
      setUpdateLoading(false);
      const errorMessage =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Lỗi khi cập nhật cửa hàng. Vui lòng thử lại.";
      setNotification({
        isOpen: true,
        type: "error",
        message: errorMessage,
      });
    }
  };

  if (loading) {
    return <div className="loading">Đang tải dữ liệu...</div>;
  }

  if (!store) {
    return <div className="error">Không tìm thấy cửa hàng</div>;
  }

  const territoryOptions = [
    { id: null, name: "Chọn địa bàn..." },
    ...territories.map((t) => ({
      id: t.Id,
      name: t.TerritoryName,
    })),
  ];

  const userOptions = [
    { id: null, name: "Chọn user..." },
    ...users.map((u) => ({
      id: u.Id,
      name: u.FullName,
    })),
  ];

  const rankOptions = [
    { id: null, name: "Chọn cấp..." },
    { id: 1, name: "Cấp 1 - Đơn vị, tổ chức" },
    { id: 2, name: "Cấp 2 - Cá nhân" },
  ];

  return (
    <div className="store-edit">
      <div className="store-edit-header">
        <button className="btn-back" onClick={() => navigate("/stores")}>
          <HiArrowLeft /> Quay lại
        </button>
        <div>
          <p className="page-kicker">Chỉnh sửa cửa hàng</p>
          <h2>{store.StoreName}</h2>
        </div>
        <button
          className="btn-add-territory"
          onClick={() => setAddTerritoryModalOpen(true)}
        >
          Thêm địa bàn phụ trách
        </button>
      </div>

      <form onSubmit={handleSubmit} className="store-edit-form">
        <div className="form-section">
          <h3>Thông tin cơ bản</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Mã cửa hàng</label>
              <input
                type="text"
                value={store.StoreCode}
                disabled
                className="form-input disabled"
              />
            </div>
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
                <label>Ngày mở audit</label>
                <input
                  type="date"
                  value={formData.openDate}
                  onChange={(e) =>
                    setFormData({ ...formData, openDate: e.target.value })
                  }
                  className="form-input"
                />
              </div>
              <div className="form-group">
              <label>Cấp cửa hàng</label>
              <Select
                options={rankOptions}
                value={formData.rank}
                onChange={(value) => setFormData({ ...formData, rank: value })}
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
              <label>Địa bàn phụ trách</label>
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
              <label>User phụ trách</label>
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
            onClick={() => navigate("/stores")}
          >
            Hủy
          </button>
          <button type="submit" className="btn-primary">
            Lưu thay đổi
          </button>
        </div>
      </form>

      {/* Loading Modal for Update */}
      <LoadingModal
        isOpen={updateLoading}
        message="Đang cập nhật thông tin cửa hàng..."
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

      {/* Add Territory Modal */}
      {addTerritoryModalOpen && (
        <div
          className="modal-overlay"
          onClick={handleCancelAddTerritory}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Thêm địa bàn phụ trách</h3>
            <div className="form-group" style={{ marginTop: "20px" }}>
              <label>Tên địa bàn</label>
              <input
                type="text"
                value={newTerritoryName}
                onChange={(e) => setNewTerritoryName(e.target.value)}
                placeholder="Nhập tên địa bàn"
                className="form-input"
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={handleCancelAddTerritory}
                disabled={addTerritoryLoading}
              >
                Hủy
              </button>
              <button
                className="btn-confirm"
                onClick={handleAddTerritory}
                disabled={addTerritoryLoading || !newTerritoryName.trim()}
              >
                {addTerritoryLoading ? "Đang xử lý..." : "Hoàn thành"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirm Modal */}
      {cancelConfirmModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Xác nhận hủy</h3>
            <p>Bạn có chắc muốn hủy? Thông tin đã nhập sẽ không được lưu.</p>
            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={() => setCancelConfirmModalOpen(false)}
              >
                Không
              </button>
              <button className="btn-confirm" onClick={confirmCancel}>
                Có, hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Modal for Add Territory */}
      <LoadingModal
        isOpen={addTerritoryLoading}
        message="Đang thêm địa bàn..."
        progress={0}
      />
    </div>
  );
}

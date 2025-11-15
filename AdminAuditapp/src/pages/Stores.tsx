import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { HiEye, HiPencil, HiTrash } from "react-icons/hi";
import { HiPlus, HiArrowDownTray } from "react-icons/hi2";
import api from "../services/api";
import Select from "../components/Select";
import MultiSelect from "../components/MultiSelect";
import "./Stores.css";

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
  TerritoryName: string | null;
  UserId: number | null;
  UserFullName: string | null;
}

interface Territory {
  Id: number;
  TerritoryName: string;
}

interface User {
  Id: number;
  FullName: string;
}

type StatusFilter = "all" | "not_audited" | "audited" | "passed" | "failed";

export default function Stores() {
  const navigate = useNavigate();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [storeNameFilter, setStoreNameFilter] = useState("");
  const [selectedTerritory, setSelectedTerritory] = useState<number | null>(null);
  const [selectedRank, setSelectedRank] = useState<number | string | null>(null);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<Store | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const storeNameInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchTerritories();
    fetchUsers();
    fetchStores();
  }, []);

  useEffect(() => {
    setPage(1); // Reset to first page when filters change
    fetchStores();
  }, [statusFilter, selectedTerritory, selectedRank, selectedUser]);

  useEffect(() => {
    fetchStores();
  }, [page, pageSize]);

  // Debounce store name filter
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchStores();
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [storeNameFilter]);

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
      setUsers(res.data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchStores = async () => {
    try {
      setLoading(true);
      const params: any = {
        page,
        pageSize,
      };

      if (statusFilter !== "all") {
        params.status = statusFilter;
      }
      if (selectedTerritory) {
        params.territoryId = selectedTerritory;
      }
      if (selectedRank !== null && selectedRank !== "") {
        params.rank = selectedRank;
      }
      if (selectedUser) {
        params.userId = selectedUser;
      }
      if (storeNameFilter.trim()) {
        params.storeName = storeNameFilter.trim();
      }

      const res = await api.get("/stores", { params });
      setStores(res.data.data || []);
      if (res.data.pagination) {
        setTotal(res.data.pagination.total);
        setTotalPages(res.data.pagination.totalPages);
      }
    } catch (error) {
      console.error("Error fetching stores:", error);
    } finally {
      setLoading(false);
    }
  };

  const hasActiveFilters = () => {
    return (
      statusFilter !== "all" ||
      storeNameFilter.trim() !== "" ||
      selectedTerritory !== null ||
      selectedRank !== null ||
      selectedUser !== null
    );
  };

  const handleClearFilters = () => {
    setStatusFilter("all");
    setStoreNameFilter("");
    setSelectedTerritory(null);
    setSelectedRank(null);
    setSelectedUser(null);
    setPage(1);
  };

  const handleDeleteClick = (store: Store) => {
    setStoreToDelete(store);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!storeToDelete) return;

    try {
      await api.delete(`/stores/${storeToDelete.Id}`);
      setDeleteModalOpen(false);
      setStoreToDelete(null);
      fetchStores();
    } catch (error) {
      console.error("Error deleting store:", error);
      alert("Lỗi khi xóa cửa hàng");
    }
  };

  const handleViewStore = (storeId: number) => {
    navigate(`/stores/${storeId}`);
  };

  const handleEditStore = (storeId: number) => {
    navigate(`/stores/${storeId}/edit`);
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      not_audited: "Chưa audit",
      audited: "Đã audit",
      passed: "Đạt",
      failed: "Không đạt",
    };
    return labels[status] || status;
  };

  const getRankLabel = (rank: number | null) => {
    if (rank === 1) return "Đơn vị, tổ chức";
    if (rank === 2) return "Cá nhân";
    return "-";
  };

  const rankOptions = [
    { id: "", name: "Tất cả" },
    { id: 1, name: "Cấp 1" },
    { id: 2, name: "Cấp 2" },
  ];

  const territoryOptions = territories.map((t) => ({
    id: t.Id,
    name: t.TerritoryName,
  }));

  const userOptions = [
    { id: null, name: "Tất cả" },
    ...users.map((u) => ({
      id: u.Id,
      name: u.FullName,
    })),
  ];

  if (loading && stores.length === 0) {
    return <div className="loading">Đang tải dữ liệu...</div>;
  }

  return (
    <div className="stores-page">
      {/* Status Filter Tabs and Action Buttons */}
      <div className="status-filter-header">
        <div className="status-filter-tabs">
          <button
            className={`status-tab ${statusFilter === "all" ? "active" : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            Tất cả
          </button>
          <button
            className={`status-tab ${statusFilter === "not_audited" ? "active" : ""}`}
            onClick={() => setStatusFilter("not_audited")}
          >
            Chưa audit
          </button>
          <button
            className={`status-tab ${statusFilter === "audited" ? "active" : ""}`}
            onClick={() => setStatusFilter("audited")}
          >
            Đã audit
          </button>
          <button
            className={`status-tab ${statusFilter === "passed" ? "active" : ""}`}
            onClick={() => setStatusFilter("passed")}
          >
            Đạt
          </button>
          <button
            className={`status-tab ${statusFilter === "failed" ? "active" : ""}`}
            onClick={() => setStatusFilter("failed")}
          >
            Không đạt
          </button>
        </div>
        <div className="stores-actions">
          <button className="btn-add" onClick={() => navigate("/stores/new")}>
            <HiPlus /> Thêm cửa hàng
          </button>
          <button className="btn-download" onClick={() => {}}>
            <HiArrowDownTray /> Xuất Excel
          </button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="stores-filters">
        <div className="filter-group">
          <label>Tên cửa hàng</label>
          <input
            ref={storeNameInputRef}
            type="text"
            placeholder="Tìm kiếm theo mã hoặc tên"
            value={storeNameFilter}
            onChange={(e) => setStoreNameFilter(e.target.value)}
            className="filter-input"
          />
        </div>

        <div className="filter-group">
          <label>Địa bàn phụ trách</label>
          <Select
            options={[
              { id: null, name: "Tất cả" },
              ...territoryOptions,
            ]}
            value={selectedTerritory}
            onChange={(value) => setSelectedTerritory(value as number | null)}
            placeholder="Chọn địa bàn phụ trách"
            searchable={true}
          />
        </div>

        <div className="filter-group">
          <label>Cấp cửa hàng</label>
          <Select
            options={rankOptions}
            value={selectedRank}
            onChange={(value) => setSelectedRank(value)}
            placeholder="Tất cả"
          />
        </div>

        <div className="filter-group">
          <label>Tên user phụ trách</label>
          <Select
            options={userOptions}
            value={selectedUser}
            onChange={(value) => setSelectedUser(value as number | null)}
            placeholder="Chọn user phụ trách"
            searchable={true}
          />
        </div>

        {hasActiveFilters() && (
          <div className="filter-group filter-clear">
            <label>&nbsp;</label>
            <button className="btn-clear-filters" onClick={handleClearFilters}>
              Xóa lọc
            </button>
          </div>
        )}
      </div>

      {/* Stores Table */}
      <div className="table-container">
        <table className="stores-table">
          <thead>
            <tr>
              <th>Mã cửa hàng</th>
              <th>Tên cửa hàng</th>
              <th>Loại đối tượng</th>
              <th>Địa chỉ</th>
              <th>Mã số thuế</th>
              <th>Tên đối tác</th>
              <th>Số điện thoại</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {stores.length === 0 ? (
              <tr>
                <td colSpan={8} className="no-data-cell">
                  Không có dữ liệu
                </td>
              </tr>
            ) : (
              stores.map((store) => (
                <tr key={store.Id}>
                  <td>{store.StoreCode}</td>
                  <td>{store.StoreName}</td>
                  <td>{getRankLabel(store.Rank)}</td>
                  <td>{store.Address || "-"}</td>
                  <td>{store.TaxCode || "-"}</td>
                  <td>{store.PartnerName || "-"}</td>
                  <td>{store.Phone || "-"}</td>
                  <td>
                    <div className="action-buttons">
                      {store.Status !== "not_audited" && (
                        <button
                          className="btn-action btn-view"
                          onClick={() => handleViewStore(store.Id)}
                          title="Xem chi tiết"
                        >
                          <HiEye />
                        </button>
                      )}
                      <button
                        className="btn-action btn-edit"
                        onClick={() => handleEditStore(store.Id)}
                        title="Chỉnh sửa"
                      >
                        <HiPencil />
                      </button>
                      <button
                        className="btn-action btn-delete"
                        onClick={() => handleDeleteClick(store)}
                        title="Xóa"
                      >
                        <HiTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && storeToDelete && (
        <div className="modal-overlay" onClick={() => setDeleteModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Xác nhận xóa cửa hàng</h3>
            <p>
              Bạn có chắc chắn muốn xóa cửa hàng <strong>{storeToDelete.StoreName}</strong> (Mã: {storeToDelete.StoreCode})?
            </p>
            <p className="modal-warning">Hành động này không thể hoàn tác!</p>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setStoreToDelete(null);
                }}
              >
                Hủy
              </button>
              <button className="btn-danger" onClick={handleDeleteConfirm}>
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

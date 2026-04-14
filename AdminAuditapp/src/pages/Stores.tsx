import React, { useCallback, useEffect, useRef, useState } from "react";
import { HiEye, HiPencil, HiTrash } from "react-icons/hi";
import { HiArrowDownTray, HiPlus } from "react-icons/hi2";
import { useLocation, useNavigate } from "react-router-dom";
import LoadingModal from "../components/LoadingModal";
import NotificationModal from "../components/NotificationModal";
import Select from "../components/Select";
import { StoreSkeletonList } from "../components/StoreSkeleton";
import api from "../services/api";
import "./Stores.css";

interface UserStatus {
  UserId: number;
  UserFullName: string;
  UserCode: string;
  Status: string;
}

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
  UserCode: string | null;
  Latitude: number | null;
  Longitude: number | null;
  userStatuses?: UserStatus[]; // Status for each assigned user
}

const STATUS_SORT_ORDER: Record<string, number> = {
  not_audited: 0,
  audited: 1,
  passed: 2,
  failed: 3,
};

const sortStoresByStatus = (storeList: Store[]) => {
  return [...storeList].sort((a, b) => {
    const orderA = STATUS_SORT_ORDER[a.Status] ?? 99;
    const orderB = STATUS_SORT_ORDER[b.Status] ?? 99;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a.StoreCode.localeCompare(b.StoreCode);
  });
};

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
  const location = useLocation();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [storeNameFilter, setStoreNameFilter] = useState("");
  const [selectedTerritory, setSelectedTerritory] = useState<number | null>(
    null
  );
  const [selectedRank, setSelectedRank] = useState<number | string | null>(
    null
  );
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<Store | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [notification, setNotification] = useState<{
    isOpen: boolean;
    type: "success" | "error";
    message: string;
  }>({
    isOpen: false,
    type: "success",
    message: "",
  });
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [statusCounts, setStatusCounts] = useState<
    Record<StatusFilter, number>
  >({
    all: 0,
    not_audited: 0,
    audited: 0,
    passed: 0,
    failed: 0,
  });
  const storeNameInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFilterChangingRef = useRef(false);
  const previousStoreNameFilterRef = useRef<string>("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasFetchedRef = useRef(false);

  const resetFilterChangingFlag = useCallback(() => {
    setTimeout(() => {
      if (isFilterChangingRef.current) {
        isFilterChangingRef.current = false;
      }
    }, 100);
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
      // Handle both response formats: { data: [...] } or [...]
      const usersData = res.data.data || res.data || [];
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (error) {
      console.error("Error fetching users:", error);
      setUsers([]);
    }
  };

  const statusSummaryParams = useCallback(() => {
    const params: Record<string, string | number> = {};
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
    return params;
  }, [selectedTerritory, selectedRank, selectedUser, storeNameFilter]);

  const fetchStatusCounts = useCallback(async () => {
    try {
      const res = await api.get("/stores/status-summary", {
        params: statusSummaryParams(),
      });
      const data =
        (res.data &&
          (res.data.data as Partial<Record<StatusFilter, number>>)) ||
        {};
      setStatusCounts({
        all: data.all ?? 0,
        not_audited: data.not_audited ?? 0,
        audited: data.audited ?? 0,
        passed: data.passed ?? 0,
        failed: data.failed ?? 0,
      });
    } catch (error) {
      console.error("Error fetching status counts:", error);
    }
  }, [statusSummaryParams]);

  const activeRequestIdRef = useRef(0);

  const fetchStores = useCallback(
    async (options?: { clearExisting?: boolean }) => {
      const preserveData = hasFetchedRef.current;
      const requestId = activeRequestIdRef.current + 1;
      activeRequestIdRef.current = requestId;

      if (options?.clearExisting) {
        setStores([]);
        setIsFiltering(true);
      } else if (preserveData) {
        setIsFiltering(true);
      } else {
        setLoading(true);
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const params: Record<string, string | number> = {
          page,
          pageSize,
          _t: Date.now(), // bust cache
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

        const res = await api.get("/stores", {
          params,
          signal: controller.signal,
        });
        const fetchedStores: Store[] = res.data.data || [];
        let processedStores = fetchedStores;

        if (statusFilter === "audited") {
          processedStores = fetchedStores
            .map((store) => {
              const filteredStatuses = (store.userStatuses || []).filter(
                (userStatus) => userStatus.Status !== "not_audited"
              );
              return {
                ...store,
                userStatuses: filteredStatuses,
              };
            })
            .filter(
              (store) =>
                (store.userStatuses && store.userStatuses.length > 0) ||
                store.Status !== "not_audited"
            );
        }

        if (requestId === activeRequestIdRef.current) {
          setStores(sortStoresByStatus(processedStores));
          hasFetchedRef.current = true;

          if (res.data.pagination) {
            setTotal(res.data.pagination.total);
            setTotalPages(res.data.pagination.totalPages);
          }

          fetchStatusCounts();
        }
      } catch (error) {
        const isAborted =
          (error as { name?: string; code?: string })?.name ===
            "CanceledError" ||
          (error as { code?: string })?.code === "ERR_CANCELED";
        if (!isAborted) {
          console.error("Error fetching stores:", error);
        }
      } finally {
        if (requestId === activeRequestIdRef.current) {
          if (!options?.clearExisting && !preserveData) {
            setLoading(false);
          } else if (!options?.clearExisting && preserveData) {
            setIsFiltering(false);
          } else {
            setIsFiltering(false);
          }
          resetFilterChangingFlag();
        }
      }
    },
    [
      page,
      pageSize,
      statusFilter,
      selectedTerritory,
      selectedRank,
      selectedUser,
      storeNameFilter,
      resetFilterChangingFlag,
      fetchStatusCounts,
    ]
  );

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    fetchTerritories();
    fetchUsers();
    fetchStores();
    fetchStatusCounts();
  }, [fetchStores, fetchStatusCounts]);

  useEffect(() => {
    if (location.pathname === "/stores" && !isFilterChangingRef.current) {
      fetchStores();
    }
  }, [location.pathname, fetchStores]);

  // Track previous filter values to detect actual changes
  const prevFiltersRef = useRef({
    statusFilter,
    selectedTerritory,
    selectedRank,
    selectedUser,
  });

  useEffect(() => {
    const prevFilters = prevFiltersRef.current;
    const filtersChanged =
      prevFilters.statusFilter !== statusFilter ||
      prevFilters.selectedTerritory !== selectedTerritory ||
      prevFilters.selectedRank !== selectedRank ||
      prevFilters.selectedUser !== selectedUser;

    if (filtersChanged) {
      prevFiltersRef.current = {
        statusFilter,
        selectedTerritory,
        selectedRank,
        selectedUser,
      };
      setPage(1);
      fetchStores({ clearExisting: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, selectedTerritory, selectedRank, selectedUser]);

  useEffect(() => {
    if (isFilterChangingRef.current) {
      return;
    }
    // Only fetch when page or pageSize changes, not when fetchStores is recreated
    fetchStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  useEffect(() => {
    if (storeNameFilter === previousStoreNameFilterRef.current) {
      return;
    }

    previousStoreNameFilterRef.current = storeNameFilter;
    isFilterChangingRef.current = true;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setPage(1);

    if (!storeNameFilter.trim()) {
      setTimeout(() => {
        fetchStores({ clearExisting: true });
      }, 50);
      return;
    }

    setIsFiltering(true);
    setStores([]);

    debounceTimerRef.current = setTimeout(() => {
      fetchStores({ clearExisting: true });
    }, 800);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [storeNameFilter, fetchStores]);

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
      setDeleteLoading(true);
      setDeleteModalOpen(false);

      await api.delete(`/stores/${storeToDelete.Id}`);
      const deletedStoreName = storeToDelete.StoreName;
      setStoreToDelete(null);

      await fetchStores();
      await fetchStatusCounts(); // Refresh status counts after delete

      setDeleteLoading(false);
      setNotification({
        isOpen: true,
        type: "success",
        message: `Đã xóa cửa hàng "${deletedStoreName}" thành công.`,
      });
    } catch (error: unknown) {
      console.error("Error deleting store:", error);
      setDeleteLoading(false);
      const errorMessage =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Lỗi khi xóa cửa hàng. Vui lòng thử lại.";
      setNotification({
        isOpen: true,
        type: "error",
        message: errorMessage,
      });
    }
  };

  const handleViewStore = (store: Store) => {
    navigate(`/stores/${store.Id}`, { state: { store } });
  };

  const handleEditStore = (storeId: number) => {
    navigate(`/stores/${storeId}/edit`);
  };

  const getRankLabel = (rank: number | null) => {
    if (rank === 1) return "Đơn vị, tổ chức";
    if (rank === 2) return "Cá nhân";
    return "-";
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      not_audited: "Chưa thực hiện",
      audited: "Đã thực hiện",
      passed: "Đạt",
      failed: "Không đạt",
    };
    return labels[status] || status;
  };

  const formatStatusWithUsers = (store: Store): React.ReactNode => {
    if (store.userStatuses && store.userStatuses.length > 0) {
      // When filtering by status, always show "user name: status" format
      if (statusFilter !== "all") {
        return (
          <div className="status-multi-user-compact">
            {store.userStatuses.map((us) => (
              <div key={us.UserId} className="status-user-row">
                <span className="status-user-name-compact">
                  {us.UserFullName}
                </span>
                <span className="status-separator">:</span>
                <span className={`status-badge-inline status-${us.Status}`}>
                  {getStatusLabel(us.Status)}
                </span>
              </div>
            ))}
          </div>
        );
      }

      // When showing "all", use compact format if all users have same status
      const userCount = store.userStatuses.length;
      const uniqueStatuses = new Set(store.userStatuses.map((us) => us.Status));
      const allSameStatus = uniqueStatuses.size === 1;

      if (allSameStatus) {
        const status = store.userStatuses[0].Status;
        return (
          <div className="status-single-compact">
            <span className={`status-badge status-${status}`}>
              {getStatusLabel(status)}
            </span>
            <span className="status-user-count">({userCount})</span>
          </div>
        );
      }

      // Multiple different statuses - show "user name: status" format
      return (
        <div className="status-multi-user-compact">
          {store.userStatuses.map((us) => (
            <div key={us.UserId} className="status-user-row">
              <span className="status-user-name-compact">
                {us.UserFullName}
              </span>
              <span className="status-separator">:</span>
              <span className={`status-badge-inline status-${us.Status}`}>
                {getStatusLabel(us.Status)}
              </span>
            </div>
          ))}
        </div>
      );
    }

    return (
      <span className={`status-badge status-${store.Status}`}>
        {getStatusLabel(store.Status)}
      </span>
    );
  };

  const canViewStore = (store: Store) => {
    if (store.userStatuses && store.userStatuses.length > 0) {
      return store.userStatuses.some((us) => us.Status !== "not_audited");
    }
    return store.Status !== "not_audited";
  };

  const handleExportStores = async () => {
    try {
      setExportLoading(true);
      setExportProgress(10);

      const res = await api.get("/stores/export/file", {
        responseType: "blob",
      });

      setExportProgress(90);
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `DanhSachCuaHang_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
      setExportProgress(100);
    } catch (error) {
      console.error("Error exporting stores:", error);
      setExportLoading(false);
      setExportProgress(0);
      alert("Lỗi khi xuất báo cáo. Vui lòng thử lại.");
      return;
    }

    setTimeout(() => {
      setExportLoading(false);
      setExportProgress(0);
    }, 500);
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
    ...(Array.isArray(users)
      ? users.map((u) => ({
          id: u.Id,
          name: u.FullName,
        }))
      : []),
  ];

  const showInitialLoading =
    loading && stores.length === 0 && !hasFetchedRef.current;

  return (
    <div className="stores-page">
      {/* Status Filter Tabs and Action Buttons */}
      <div className="status-filter-header">
        <div className="status-filter-tabs">
          <button
            className={`status-tab ${statusFilter === "all" ? "active" : ""}`}
            onClick={() => {
              setStatusFilter("all");
              setPage(1);
            }}
          >
            <span>Tất cả</span>
            <span className="status-count">({statusCounts.all})</span>
          </button>
          <button
            className={`status-tab ${
              statusFilter === "not_audited" ? "active" : ""
            }`}
            onClick={() => {
              setStatusFilter("not_audited");
              setPage(1);
            }}
          >
            <span>Chưa thực hiện</span>
            <span className="status-count">({statusCounts.not_audited})</span>
          </button>
          <button
            className={`status-tab ${
              statusFilter === "audited" ? "active" : ""
            }`}
            onClick={() => {
              setStatusFilter("audited");
              setPage(1);
            }}
          >
            <span>Đã thực hiện</span>
            <span className="status-count">({statusCounts.audited})</span>
          </button>
        </div>
        <div className="stores-actions">
          <button className="btn-add-store" onClick={() => navigate("/stores/new")}>
            <HiPlus /> Thêm cửa hàng
          </button>
          <button className="btn-download-store" onClick={handleExportStores}>
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
            options={[{ id: null, name: "Tất cả" }, ...territoryOptions]}
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
          <label>Tên nhân viên phụ trách</label>
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
              <th>Tên đối tác</th>
              <th>Số điện thoại</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {showInitialLoading ? (
              <>
                <tr>
                  <td colSpan={8} className="no-data-cell">
                    Đang cập nhật dữ liệu...
                  </td>
                </tr>
                <StoreSkeletonList count={Math.min(pageSize, 8)} />
              </>
            ) : isFiltering && stores.length === 0 ? (
              <StoreSkeletonList count={Math.min(pageSize, 8)} />
            ) : stores.length === 0 ? (
              <tr>
                <td colSpan={8} className="no-data-cell">
                  Không có dữ liệu
                </td>
              </tr>
            ) : (
              stores.map((store) => (
                <tr key={store.Id}>
                  <td>
                    <strong>{store.StoreCode}</strong>
                  </td>
                  <td>{store.StoreName}</td>
                  <td>{getRankLabel(store.Rank)}</td>
                  <td>{store.Address || "-"}</td>
                  <td>{store.PartnerName || "-"}</td>
                  <td>{store.Phone || "-"}</td>
                  <td className="status-col">{formatStatusWithUsers(store)}</td>
                  <td>
                    <div className="action-buttons">
                      {canViewStore(store) && (
                        <button
                          className="btn-action btn-view"
                          onClick={() => handleViewStore(store)}
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

      {/* Pagination */}
      {totalPages > 0 && (
        <div className="pagination-container">
          <div className="pagination-info">
            <span>
              Hiển thị {(page - 1) * pageSize + 1} -{" "}
              {Math.min(page * pageSize, total)} trong tổng số {total} cửa hàng
            </span>
            <div className="page-size-selector">
              <label>Hiển thị:</label>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="page-size-select"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={300}>300</option>
              </select>
            </div>
          </div>
          <div className="pagination-controls">
            <button
              className="pagination-btn"
              onClick={() => setPage(1)}
              disabled={page === 1}
            >
              Đầu
            </button>
            <button
              className="pagination-btn"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              Trước
            </button>
            <div className="pagination-pages">
              {(() => {
                const pages = [];
                const maxVisible = 5;
                let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
                const endPage = Math.min(
                  totalPages,
                  startPage + maxVisible - 1
                );

                if (endPage - startPage < maxVisible - 1) {
                  startPage = Math.max(1, endPage - maxVisible + 1);
                }

                for (let i = startPage; i <= endPage; i++) {
                  pages.push(
                    <button
                      key={i}
                      className={`pagination-btn ${page === i ? "active" : ""}`}
                      onClick={() => setPage(i)}
                    >
                      {i}
                    </button>
                  );
                }
                return pages;
              })()}
            </div>
            <button
              className="pagination-btn"
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
            >
              Sau
            </button>
            <button
              className="pagination-btn"
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
            >
              Cuối
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && storeToDelete && (
        <div
          className="modal-overlay"
          onClick={() => setDeleteModalOpen(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Xác nhận xóa cửa hàng</h3>
            <p>
              Bạn có chắc chắn muốn xóa cửa hàng{" "}
              <strong>{storeToDelete.StoreName}</strong> (Mã:{" "}
              {storeToDelete.StoreCode})?
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

      {/* Loading Modal for Delete */}
      <LoadingModal
        isOpen={deleteLoading}
        message="Đang xóa cửa hàng..."
        progress={0}
      />

      <LoadingModal
        isOpen={exportLoading}
        message="Đang tạo báo cáo Excel..."
        progress={exportProgress}
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

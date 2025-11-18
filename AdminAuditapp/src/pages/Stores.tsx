import { useEffect, useRef, useState } from "react";
import { HiEye, HiPencil, HiTrash } from "react-icons/hi";
import { HiArrowDownTray, HiPlus } from "react-icons/hi2";
import { useLocation, useNavigate } from "react-router-dom";
import LoadingModal from "../components/LoadingModal";
import NotificationModal from "../components/NotificationModal";
import Select from "../components/Select";
import api from "../services/api";
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
  UserCode: string | null;
  Latitude: number | null;
  Longitude: number | null;
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
  const location = useLocation();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [statusCounts, setStatusCounts] = useState<Record<StatusFilter, number>>({
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

  useEffect(() => {
    fetchTerritories();
    fetchUsers();
    fetchStores();
    fetchStatusCounts();
  }, []);

  // Refresh stores when navigating back from add/edit page
  useEffect(() => {
    if (location.pathname === "/stores" && !isFilterChangingRef.current) {
      fetchStores();
    }
  }, [location.pathname]);

  useEffect(() => {
    setPage(1); // Reset to first page when filters change
    fetchStores();
  }, [statusFilter, selectedTerritory, selectedRank, selectedUser]);

  useEffect(() => {
    // Skip fetch if filter is changing to avoid race condition
    if (isFilterChangingRef.current) {
      return;
    }
    fetchStores();
  }, [page, pageSize]);

  // Debounce store name filter
  useEffect(() => {
    // Skip if filter hasn't actually changed (e.g., on initial mount)
    if (storeNameFilter === previousStoreNameFilterRef.current) {
      return;
    }

    // Update previous value
    previousStoreNameFilterRef.current = storeNameFilter;

    isFilterChangingRef.current = true;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Reset page to 1 when store name filter changes
    // But don't let the page useEffect trigger fetchStores
    setPage(1);

    // If filter is empty, fetch immediately
    if (!storeNameFilter.trim()) {
      // Wait a bit to ensure page state is updated
      setTimeout(() => {
        fetchStores();
      }, 50);
      return;
    }

    // Use debounce for filter input
    debounceTimerRef.current = setTimeout(() => {
      fetchStores();
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      // Don't reset isFilterChangingRef here to prevent race condition
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
      // Handle both response formats: { data: [...] } or [...]
      const usersData = res.data.data || res.data || [];
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (error) {
      console.error("Error fetching users:", error);
      setUsers([]);
    }
  };

  const fetchStatusCounts = async () => {
    try {
      // Fetch counts for each status (without other filters)
      const statuses: StatusFilter[] = ["all", "not_audited", "audited", "passed", "failed"];
      const counts: Record<StatusFilter, number> = {
        all: 0,
        not_audited: 0,
        audited: 0,
        passed: 0,
        failed: 0,
      };

      // Fetch all statuses in parallel
      await Promise.all(
        statuses.map(async (status) => {
          try {
            const params: Record<string, string | number> = {
              page: 1,
              pageSize: 1, // We only need the total count
            };

            if (status !== "all") {
              params.status = status;
            }

            const res = await api.get("/stores", { params });
            counts[status] = res.data.pagination?.total || 0;
          } catch (error) {
            console.error(`Error fetching count for status ${status}:`, error);
            counts[status] = 0;
          }
        })
      );

      setStatusCounts(counts);
    } catch (error) {
      console.error("Error fetching status counts:", error);
    }
  };

  const fetchStores = async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = {
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

      // Reset isFilterChangingRef after fetch completes successfully
      // Use setTimeout to ensure this happens after any pending useEffect runs
      setTimeout(() => {
        if (isFilterChangingRef.current) {
          isFilterChangingRef.current = false;
        }
      }, 100);
    } catch (error) {
      console.error("Error fetching stores:", error);
      // Reset isFilterChangingRef even on error
      setTimeout(() => {
        if (isFilterChangingRef.current) {
          isFilterChangingRef.current = false;
        }
      }, 100);
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

  const handleViewStore = (storeId: number) => {
    navigate(`/stores/${storeId}`);
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

  const handleExportStores = async () => {
    try {
      setExportLoading(true);
      setExportProgress(0);

      // Fetch all stores with current filters
      setExportProgress(20);
      const params: Record<string, string | number> = {
        page: 1,
        pageSize: 10000, // Get all stores
      };

      if (statusFilter !== "all") {
        params.status = statusFilter;
      }
      if (selectedTerritory) {
        params.territoryId = selectedTerritory;
      }
      if (selectedRank) {
        params.rank = selectedRank;
      }
      if (selectedUser) {
        params.userId = selectedUser;
      }
      if (storeNameFilter) {
        params.storeName = storeNameFilter;
      }

      const res = await api.get("/stores", { params });
      setExportProgress(50);

      await generateStoresExcel(res.data.data || [], setExportProgress);
      setExportProgress(100);

      // Delay a bit to show 100% before closing
      setTimeout(() => {
        setExportLoading(false);
        setExportProgress(0);
      }, 500);
    } catch (error) {
      console.error("Error exporting stores:", error);
      setExportLoading(false);
      setExportProgress(0);
      alert("Lỗi khi xuất báo cáo. Vui lòng thử lại.");
    }
  };

  const generateStoresExcel = async (
    storesData: Store[],
    progressCallback?: (progress: number) => void
  ) => {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();

    if (progressCallback) progressCallback(60);

    const sheet = workbook.addWorksheet("Danh sách cửa hàng");

    // Header style
    const headerStyle = {
      font: { bold: true, color: { argb: "FFFFFFFF" } },
      fill: {
        type: "pattern" as const,
        pattern: "solid" as const,
        fgColor: { argb: "FF0138C3" },
      },
      alignment: { horizontal: "center" as const, vertical: "middle" as const },
      border: {
        top: { style: "thin" as const },
        bottom: { style: "thin" as const },
        left: { style: "thin" as const },
        right: { style: "thin" as const },
      },
    };

    // Title
    sheet.mergeCells("A1:P1");
    sheet.getCell("A1").value = "CÔNG TY CỔ PHẦN XI MĂNG TÂY ĐÔ";
    sheet.getCell("A1").font = { bold: true, size: 14 };
    sheet.getCell("A1").alignment = { horizontal: "center" };

    sheet.mergeCells("A2:P2");
    sheet.getCell("A2").value = "DANH SÁCH CỬA HÀNG";
    sheet.getCell("A2").font = { bold: true, size: 12 };
    sheet.getCell("A2").alignment = { horizontal: "center" };

    // Headers
    const headers = [
      "STT",
      "Mã cửa hàng",
      "Tên cửa hàng",
      "Loại đối tượng",
      "Địa chỉ",
      "Mã số thuế",
      "Tên đối tác",
      "Số điện thoại",
      "Email",
      "Trạng thái",
      "Địa bàn phụ trách",
      "User phụ trách",
      "Link chi tiết",
      "Latitude",
      "Longitude",
      "Xem trên Google Maps",
    ];
    sheet.getRow(4).values = headers;
    sheet.getRow(4).eachCell((cell) => {
      cell.style = headerStyle;
    });

    // Data
    if (progressCallback) progressCallback(70);
    storesData.forEach((store, index) => {
      const row = sheet.addRow([
        index + 1,
        store.StoreCode,
        store.StoreName,
        getRankLabel(store.Rank),
        store.Address || "",
        store.TaxCode || "",
        store.PartnerName || "",
        store.Phone || "",
        store.Email || "",
        getStatusLabel(store.Status),
        store.TerritoryName || "",
        store.UserFullName
          ? `${store.UserFullName} (${store.UserCode || ""})`
          : "",
        "", // Link chi tiết - will be set as hyperlink
        store.Latitude || "",
        store.Longitude || "",
        "", // Google Maps link - will be set as hyperlink
      ]);

      // Set hyperlink for "Link chi tiết"
      const detailLinkCell = row.getCell(13);
      detailLinkCell.value = {
        text: "Link chi tiết",
        hyperlink: `https://ximang.netlify.app/stores/${store.Id}`,
      };
      detailLinkCell.font = { color: { argb: "FF0000FF" }, underline: true };

      // Set hyperlink for "Xem trên Google Maps" (only if has coordinates)
      const mapLinkCell = row.getCell(16);
      if (store.Latitude && store.Longitude) {
        mapLinkCell.value = {
          text: "Xem trên Google Maps",
          hyperlink: `https://www.google.com/maps?q=${store.Latitude},${store.Longitude}`,
        };
        mapLinkCell.font = { color: { argb: "FF0000FF" }, underline: true };
      }

      // Add borders to all cells
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    // Set column widths
    sheet.columns = [
      { width: 10 }, // STT
      { width: 15 }, // Mã cửa hàng
      { width: 30 }, // Tên cửa hàng
      { width: 20 }, // Loại đối tượng
      { width: 40 }, // Địa chỉ
      { width: 15 }, // Mã số thuế
      { width: 25 }, // Tên đối tác
      { width: 15 }, // Số điện thoại
      { width: 25 }, // Email
      { width: 15 }, // Trạng thái
      { width: 25 }, // Địa bàn phụ trách
      { width: 30 }, // User phụ trách
      { width: 20 }, // Link chi tiết
      { width: 15 }, // Latitude
      { width: 15 }, // Longitude
      { width: 25 }, // Xem trên Google Maps
    ];

    if (progressCallback) progressCallback(90);

    // Generate Excel file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
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
            <span>Tất cả</span>
            <span className="status-count">({statusCounts.all})</span>
          </button>
          <button
            className={`status-tab ${
              statusFilter === "not_audited" ? "active" : ""
            }`}
            onClick={() => setStatusFilter("not_audited")}
          >
            <span>Chưa thực hiện</span>
            <span className="status-count">({statusCounts.not_audited})</span>
          </button>
          <button
            className={`status-tab ${
              statusFilter === "audited" ? "active" : ""
            }`}
            onClick={() => setStatusFilter("audited")}
          >
            <span>Đã thực hiện</span>
            <span className="status-count">({statusCounts.audited})</span>
          </button>
          <button
            className={`status-tab ${
              statusFilter === "passed" ? "active" : ""
            }`}
            onClick={() => setStatusFilter("passed")}
          >
            <span>Đạt</span>
            <span className="status-count">({statusCounts.passed})</span>
          </button>
          <button
            className={`status-tab ${
              statusFilter === "failed" ? "active" : ""
            }`}
            onClick={() => setStatusFilter("failed")}
          >
            <span>Không đạt</span>
            <span className="status-count">({statusCounts.failed})</span>
          </button>
        </div>
        <div className="stores-actions">
          <button className="btn-add" onClick={() => navigate("/stores/new")}>
            <HiPlus /> Thêm cửa hàng
          </button>
          <button className="btn-download" onClick={handleExportStores}>
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
                  <td>
                    <strong>{store.StoreCode}</strong>
                  </td>
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

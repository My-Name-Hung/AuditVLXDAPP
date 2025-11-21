import { useCallback, useEffect, useRef, useState } from "react";
import { HiPencil, HiTrash } from "react-icons/hi";
import { HiArrowDownTray, HiArrowPath, HiPlus } from "react-icons/hi2";
import { useLocation, useNavigate } from "react-router-dom";
import LoadingModal from "../components/LoadingModal";
import NotificationModal from "../components/NotificationModal";
import Select from "../components/Select";
import { UserSkeletonList } from "../components/UserSkeleton";
import api from "../services/api";
import "./Users.css";

const DEFAULT_POSITION_FILTERS = [
  "all",
  "Quản trị Viên",
  "Nhân viên Thị Trường",
];

interface User {
  Id: number;
  UserCode: string;
  Username: string;
  FullName: string;
  Email: string;
  Phone: string;
  Role: string;
  Position?: string | null;
  IsChangePassword: boolean;
  CreatedAt: string;
  UpdatedAt: string;
}

type PositionFilter = "all" | string;

export default function Users() {
  const navigate = useNavigate();
  const location = useLocation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("all");
  const [positionOptions, setPositionOptions] = useState<string[]>(
    DEFAULT_POSITION_FILTERS
  );
  const [searchFilter, setSearchFilter] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
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
  const [deleteWarning, setDeleteWarning] = useState<{
    isOpen: boolean;
    message: string;
    auditCount: number;
  }>({
    isOpen: false,
    message: "",
    auditCount: 0,
  });
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [userToResetPassword, setUserToResetPassword] = useState<User | null>(
    null
  );
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousSearchFilterRef = useRef<string>("");
  const isFilterChangingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasFetchedRef = useRef(false);

  const resetFilterChangingFlag = useCallback(() => {
    setTimeout(() => {
      if (isFilterChangingRef.current) {
        isFilterChangingRef.current = false;
      }
    }, 100);
  }, []);

  const fetchUsers = useCallback(async () => {
    const preserveData = hasFetchedRef.current;

    if (!preserveData) {
      setLoading(true);
    } else if (isFilterChangingRef.current) {
      setIsSearching(true);
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
        _t: Date.now(),
      };

      if (positionFilter !== "all") {
        params.position = positionFilter;
      }
      if (searchFilter.trim()) {
        params.search = searchFilter.trim();
      }

      const res = await api.get("/users", {
        params,
        signal: controller.signal,
      });
      setUsers(res.data.data || []);
      hasFetchedRef.current = true;
      if (res.data.pagination) {
        setTotal(res.data.pagination.total);
        setTotalPages(res.data.pagination.totalPages);
      }

      // Reset isFilterChangingRef after fetch completes
      resetFilterChangingFlag();
    } catch (error) {
      const isAborted =
        (error as { name?: string; code?: string })?.name === "CanceledError" ||
        (error as { code?: string })?.code === "ERR_CANCELED";
      if (!isAborted) {
      console.error("Error fetching users:", error);
      }
    } finally {
      if (!preserveData) {
      setLoading(false);
    }
      setIsSearching(false);
    }
  }, [
    page,
    pageSize,
    positionFilter,
    searchFilter,
    resetFilterChangingFlag,
  ]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Refresh users when navigating back from add/edit page
  useEffect(() => {
    if (location.pathname === "/users") {
      fetchUsers();
    }
  }, [location.pathname, fetchUsers]);

  useEffect(() => {
    setPage(1); // Reset to first page when filters change
    fetchUsers();
  }, [positionFilter, fetchUsers]);

  useEffect(() => {
    // Skip fetch if filter is changing to avoid race condition
    if (isFilterChangingRef.current) {
      return;
    }
    fetchUsers();
  }, [page, pageSize, fetchUsers]);

  // Debounce search filter
  useEffect(() => {
    // Skip if filter hasn't actually changed (e.g., on initial mount)
    if (searchFilter === previousSearchFilterRef.current) {
      return;
    }

    // Update previous value
    previousSearchFilterRef.current = searchFilter;

    isFilterChangingRef.current = true;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Reset page to 1 when search filter changes
    setPage(1);

    // If filter is empty, fetch immediately
    if (!searchFilter.trim()) {
      setIsSearching(false);
      setTimeout(() => {
        fetchUsers();
      }, 50);
      return;
    }

    setIsSearching(true);

    // Use debounce for filter input
    debounceTimerRef.current = setTimeout(() => {
      fetchUsers();
    }, 800);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchFilter, fetchUsers]);

  const handleDeleteUser = (user: User) => {
    setUserToDelete(user);
    setDeleteModalOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      setDeleteLoading(true);
      // First check if user has audits
      const res = await api.delete(`/users/${userToDelete.Id}`);

      // If response has warning, show warning modal
      if (res.data.warning) {
        setDeleteWarning({
          isOpen: true,
          message: res.data.message,
          auditCount: res.data.auditCount,
        });
        setDeleteModalOpen(false);
        setDeleteLoading(false);
        return;
      }

      // If no warning, user was deleted successfully
      await fetchUsers();

      setDeleteLoading(false);
      setDeleteModalOpen(false);
      setUserToDelete(null);
      setNotification({
        isOpen: true,
        type: "success",
        message: `Đã xóa nhân viên "${userToDelete.FullName}" thành công.`,
      });
    } catch (error: unknown) {
      console.error("Error deleting user:", error);
      setDeleteLoading(false);
      setDeleteModalOpen(false);
      const errorMessage =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Lỗi khi xóa nhân viên.";
      setNotification({
        isOpen: true,
        type: "error",
        message: errorMessage,
      });
    }
  };

  const forceDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      setDeleteLoading(true);
      await api.delete(`/users/${userToDelete.Id}?force=true`);

      await fetchUsers();

      setDeleteLoading(false);
      setDeleteWarning({ isOpen: false, message: "", auditCount: 0 });
      setUserToDelete(null);
      setNotification({
        isOpen: true,
        type: "success",
        message: `Đã xóa nhân viên "${userToDelete.FullName}" thành công.`,
      });
    } catch (error: unknown) {
      console.error("Error force deleting user:", error);
      setDeleteLoading(false);
      setDeleteWarning({ isOpen: false, message: "", auditCount: 0 });
      const errorMessage =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Lỗi khi xóa nhân viên.";
      setNotification({
        isOpen: true,
        type: "error",
        message: errorMessage,
      });
    }
  };

  const handleEditUser = (userId: number) => {
    navigate(`/users/${userId}/edit`);
  };

  const handleResetPassword = (user: User) => {
    setUserToResetPassword(user);
    setResetPasswordModalOpen(true);
  };

  const confirmResetPassword = async () => {
    if (!userToResetPassword) return;

    try {
      setResetPasswordLoading(true);
      await api.post(`/users/${userToResetPassword.Id}/reset-password`);

      setResetPasswordLoading(false);
      setResetPasswordModalOpen(false);
      setUserToResetPassword(null);
      setNotification({
        isOpen: true,
        type: "success",
        message: `Đã reset mật khẩu của nhân viên "${userToResetPassword.FullName}" về mặc định (123456).`,
      });
    } catch (error: unknown) {
      console.error("Error resetting password:", error);
      setResetPasswordLoading(false);
      const errorMessage =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Lỗi khi reset mật khẩu.";
      setNotification({
        isOpen: true,
        type: "error",
        message: errorMessage,
      });
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: "Admin",
      sales: "Sales",
    };
    return labels[role] || role;
  };

  const hasActiveFilters = () => {
    return positionFilter !== "all" || searchFilter.trim() !== "";
  };

  const handleClearFilters = () => {
    setPositionFilter("all");
    setSearchFilter("");
  };

  const handleExportUsers = async () => {
    try {
      setExportLoading(true);
      setExportProgress(0);

      // Fetch all users with current filters
      setExportProgress(20);
      const params: Record<string, string | number> = {
        page: 1,
        pageSize: 10000, // Get all users
      };

      if (positionFilter !== "all") {
        params.position = positionFilter;
      }
      if (searchFilter.trim()) {
        params.search = searchFilter.trim();
      }

      const res = await api.get("/users", { params });
      setExportProgress(50);

      await generateUsersExcel(res.data.data || [], setExportProgress);
      setExportProgress(100);

      // Delay a bit to show 100% before closing
      setTimeout(() => {
        setExportLoading(false);
        setExportProgress(0);
      }, 500);
    } catch (error) {
      console.error("Error exporting users:", error);
      setExportLoading(false);
      setExportProgress(0);
      alert("Lỗi khi xuất báo cáo. Vui lòng thử lại.");
    }
  };

  const generateUsersExcel = async (
    usersData: User[],
    progressCallback?: (progress: number) => void
  ) => {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();

    if (progressCallback) progressCallback(60);

    const sheet = workbook.addWorksheet("Danh sách nhân viên");

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
    sheet.mergeCells("A1:F1");
    sheet.getCell("A1").value = "CÔNG TY CỔ PHẦN XI MĂNG TÂY ĐÔ";
    sheet.getCell("A1").font = { bold: true, size: 14 };
    sheet.getCell("A1").alignment = { horizontal: "center" };

    sheet.mergeCells("A2:F2");
    sheet.getCell("A2").value = "DANH SÁCH NHÂN VIÊN";
    sheet.getCell("A2").font = { bold: true, size: 12 };
    sheet.getCell("A2").alignment = { horizontal: "center" };

    // Headers
    const headers = [
      "STT",
      "Mã nhân viên",
      "Tên nhân viên",
      "Email",
      "Số điện thoại",
      "Chức vụ",
      "Vai trò",
    ];
    sheet.getRow(4).values = headers;
    sheet.getRow(4).eachCell((cell) => {
      cell.style = headerStyle;
    });

    // Data
    if (progressCallback) progressCallback(70);
    usersData.forEach((user, index) => {
      const row = sheet.addRow([
        index + 1,
        user.UserCode,
        user.FullName,
        user.Email || "",
        user.Phone || "",
        user.Position || "",
        getRoleLabel(user.Role),
      ]);

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
      { width: 15 }, // Mã nhân viên
      { width: 30 }, // Tên nhân viên
      { width: 30 }, // Email
      { width: 15 }, // Số điện thoại
      { width: 25 }, // Chức vụ
      { width: 15 }, // Vai trò
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
    link.download = `DanhSachNhanVien_${
      new Date().toISOString().split("T")[0]
    }.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const loadPositionOptions = async () => {
    try {
      const res = await api.get<string[]>("/users/positions");
      if (Array.isArray(res.data)) {
        setPositionOptions((prev) => {
          const merged = [...prev];
          res.data.forEach((pos) => {
            const trimmed = pos?.trim();
            if (trimmed && !merged.includes(trimmed)) {
              merged.push(trimmed);
            }
          });
          return merged;
        });
      }
    } catch (error) {
      console.warn("Không thể tải danh sách chức vụ:", error);
    }
  };

  useEffect(() => {
    loadPositionOptions();
  }, []);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const showInitialLoading = loading && !hasFetchedRef.current;

  return (
    <div className="users-container">
      <div className="users-header">
        <h1>Danh sách nhân viên</h1>
        <div className="users-actions">
          <button className="btn-add" onClick={() => navigate("/users/new")}>
            <HiPlus /> Thêm nhân viên
          </button>
          <button className="btn-download" onClick={handleExportUsers}>
            <HiArrowDownTray /> Xuất Excel
          </button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="users-filters">
        <div className="filter-group">
          <label>Tìm kiếm (Mã/Tên nhân viên)</label>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Tìm kiếm theo mã hoặc tên"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="filter-input"
          />
        </div>

        <div className="filter-group">
          <label>Chức vụ</label>
          <Select
            options={positionOptions.map((pos) => ({
              id: pos,
              name: pos === "all" ? "Tất cả" : pos,
            }))}
            value={positionFilter}
            onChange={(value) => setPositionFilter(value as PositionFilter)}
            placeholder="Chọn chức vụ"
            searchable={false}
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

      {/* Table */}
      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>Mã nhân viên</th>
              <th>Tên nhân viên</th>
              <th>Email</th>
              <th>Số điện thoại</th>
              <th>Chức vụ</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {showInitialLoading ? (
              <>
                <tr>
                  <td colSpan={6} className="no-data">
                    Đang cập nhật dữ liệu...
                  </td>
                </tr>
                <UserSkeletonList count={Math.min(pageSize, 8)} />
              </>
            ) : isSearching && users.length === 0 ? (
              <UserSkeletonList count={Math.min(pageSize, 8)} />
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="no-data">
                  Không có dữ liệu
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.Id}>
                  <td>
                    <strong>{user.UserCode}</strong>
                  </td>
                  <td>{user.FullName}</td>
                  <td>{user.Email || "-"}</td>
                  <td>{user.Phone || "-"}</td>
                  <td>{user.Position || "-"}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-edit"
                        onClick={() => handleEditUser(user.Id)}
                        title="Chỉnh sửa"
                      >
                        <HiPencil />
                      </button>
                      <button
                        className="btn-resetUsers"
                        onClick={() => handleResetPassword(user)}
                        title="Reset mật khẩu"
                      >
                        <HiArrowPath />
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => handleDeleteUser(user)}
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
      {totalPages > 1 && (
        <div className="pagination">
          <div className="pagination-info">
            Hiển thị {((page - 1) * pageSize + 1).toLocaleString()} -{" "}
            {Math.min(page * pageSize, total).toLocaleString()} trong tổng số{" "}
            {total.toLocaleString()} nhân viên
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
            <span className="pagination-page">
              Trang {page} / {totalPages}
            </span>
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
          <div className="pagination-page-size">
            <label>Hiển thị:</label>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Xác nhận xóa</h3>
            <p>Bạn có chắc muốn xóa nhân viên "{userToDelete?.FullName}"?</p>
            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setUserToDelete(null);
                }}
              >
                Hủy
              </button>
              <button className="btn-confirm" onClick={confirmDeleteUser}>
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Confirmation Modal */}
      {resetPasswordModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Xác nhận reset mật khẩu</h3>
            <p>
              Bạn có chắc muốn reset mật khẩu của nhân viên "
              {userToResetPassword?.FullName}" về mặc định (123456)?
            </p>
            <p style={{ color: "#666", fontSize: "14px", marginTop: "8px" }}>
              Nhân viên sẽ phải đổi mật khẩu khi đăng nhập lần tiếp theo.
            </p>
            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={() => {
                  setResetPasswordModalOpen(false);
                  setUserToResetPassword(null);
                }}
                disabled={resetPasswordLoading}
              >
                Hủy
              </button>
              <button
                className="btn-confirm"
                onClick={confirmResetPassword}
                disabled={resetPasswordLoading}
              >
                {resetPasswordLoading ? "Đang xử lý..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Warning Modal */}
      {deleteWarning.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Cảnh báo</h3>
            <p>{deleteWarning.message}</p>
            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={() => {
                  setDeleteWarning({
                    isOpen: false,
                    message: "",
                    auditCount: 0,
                  });
                  setUserToDelete(null);
                }}
              >
                Hủy
              </button>
              <button className="btn-confirm" onClick={forceDeleteUser}>
                Tiếp tục xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Modal for Delete */}
      <LoadingModal
        isOpen={deleteLoading}
        message="Đang xóa nhân viên..."
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
      />
    </div>
  );
}

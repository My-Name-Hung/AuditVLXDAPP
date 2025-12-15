import { useEffect, useState } from "react";
import { HiPencil, HiPlus, HiTrash } from "react-icons/hi";
import { HiArrowDownTray } from "react-icons/hi2";
import LoadingModal from "../components/LoadingModal";
import NotificationModal from "../components/NotificationModal";
import api from "../services/api";
import "./CementProducts.css";

interface CementProduct {
  Id: number;
  Code: string;
  Name: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export default function CementProducts() {
  const [products, setProducts] = useState<CementProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<CementProduct | null>(
    null
  );
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<CementProduct | null>(
    null
  );
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({ Code: "", Name: "" });
  const [formLoading, setFormLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [notification, setNotification] = useState<{
    isOpen: boolean;
    type: "success" | "error";
    message: string;
  }>({
    isOpen: false,
    type: "success",
    message: "",
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (searchFilter.trim()) {
        params.search = searchFilter.trim();
      }
      const res = await api.get("/cement-products", { params });
      setProducts(res.data || []);
    } catch (error) {
      console.error("Error fetching cement products:", error);
      showNotification("error", "Không thể tải danh sách loại xi măng");
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ isOpen: true, type, message });
  };

  const handleAdd = () => {
    setFormData({ Code: "", Name: "" });
    setAddModalOpen(true);
  };

  const handleEdit = (product: CementProduct) => {
    setProductToEdit(product);
    setFormData({ Code: product.Code, Name: product.Name });
    setEditModalOpen(true);
  };

  const handleDelete = (product: CementProduct) => {
    setProductToDelete(product);
    setDeleteModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.Name.trim()) {
      showNotification("error", "Vui lòng nhập tên xi măng");
      return;
    }

    try {
      setFormLoading(true);
      if (editModalOpen && productToEdit) {
        // Update
        await api.put(`/cement-products/${productToEdit.Id}`, {
          code: formData.Code.trim() || undefined,
          name: formData.Name.trim(),
        });
        showNotification("success", "Cập nhật loại xi măng thành công");
      } else {
        // Create
        await api.post("/cement-products", {
          code: formData.Code.trim() || undefined,
          name: formData.Name.trim(),
        });
        showNotification("success", "Thêm loại xi măng thành công");
      }
      setAddModalOpen(false);
      setEditModalOpen(false);
      setFormData({ Code: "", Name: "" });
      setProductToEdit(null);
      await fetchProducts();
    } catch (error: any) {
      console.error("Error saving cement product:", error);
      const message =
        error.response?.data?.error ||
        error.message ||
        "Không thể lưu loại xi măng";
      showNotification("error", message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;

    try {
      setFormLoading(true);
      await api.delete(`/cement-products/${productToDelete.Id}`);
      showNotification("success", "Xóa loại xi măng thành công");
      setDeleteModalOpen(false);
      setProductToDelete(null);
      await fetchProducts();
    } catch (error: any) {
      console.error("Error deleting cement product:", error);
      const message =
        error.response?.data?.error ||
        error.message ||
        "Không thể xóa loại xi măng";
      showNotification("error", message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExportLoading(true);
      const params: Record<string, string> = {};
      if (searchFilter.trim()) {
        params.search = searchFilter.trim();
      }
      const res = await api.get("/cement-products/export", {
        params,
        responseType: "blob",
      });

      const blob = new Blob([res.data], {
        type:
          res.headers["content-type"] ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "cement-products.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showNotification("success", "Đã xuất Excel danh sách loại xi măng");
    } catch (error: any) {
      console.error("Error exporting cement products:", error);
      const message =
        error.response?.data?.error || error.message || "Không thể xuất Excel";
      showNotification("error", message);
    } finally {
      setExportLoading(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    if (!searchFilter.trim()) return true;
    const search = searchFilter.toLowerCase();
    return (
      product.Code.toLowerCase().includes(search) ||
      product.Name.toLowerCase().includes(search)
    );
  });

  return (
    <div className="cement-products-page">
      <div className="page-header">
        <h1>Danh sách loại xi măng</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="btn-secondary"
            onClick={handleExport}
            disabled={exportLoading}
          >
            <HiArrowDownTray className="icon" />
            {exportLoading ? "Đang xuất..." : "Xuất Excel"}
          </button>
          <button className="btn-primary" onClick={handleAdd}>
            <HiPlus className="icon" />
            Thêm loại xi măng
          </button>
        </div>
      </div>

      <div className="page-filters">
        <input
          type="text"
          placeholder="Tìm kiếm theo mã hoặc tên..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="search-input"
        />
      </div>

      {loading ? (
        <div className="loading-container">
          <LoadingModal isOpen={true} />
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên xi măng</th>
                <th>Ngày tạo</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty-state">
                    {searchFilter.trim()
                      ? "Không tìm thấy loại xi măng nào"
                      : "Chưa có loại xi măng nào"}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.Id}>
                    <td>{product.Code}</td>
                    <td>{product.Name}</td>
                    <td>
                      {new Date(product.CreatedAt).toLocaleDateString("vi-VN")}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-icon btn-edit"
                          onClick={() => handleEdit(product)}
                          title="Sửa"
                        >
                          <HiPencil />
                        </button>
                        <button
                          className="btn-icon btn-delete"
                          onClick={() => handleDelete(product)}
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
      )}

      {/* Add/Edit Modal */}
      {(addModalOpen || editModalOpen) && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!formLoading) {
              setAddModalOpen(false);
              setEditModalOpen(false);
              setFormData({ Code: "", Name: "" });
              setProductToEdit(null);
            }
          }}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editModalOpen ? "Sửa loại xi măng" : "Thêm loại xi măng"}</h2>
            <div className="form-group">
              <label>
                Mã xi măng <span className="optional">(Tùy chọn)</span>
              </label>
              <input
                type="text"
                value={formData.Code}
                onChange={(e) =>
                  setFormData({ ...formData, Code: e.target.value })
                }
                placeholder="VD: 801002022"
                disabled={formLoading}
              />
            </div>
            <div className="form-group">
              <label>
                Tên xi măng <span className="required">*</span>
              </label>
              <input
                type="text"
                value={formData.Name}
                onChange={(e) =>
                  setFormData({ ...formData, Name: e.target.value })
                }
                placeholder="Nhập tên xi măng"
                disabled={formLoading}
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => {
                  setAddModalOpen(false);
                  setEditModalOpen(false);
                  setFormData({ Code: "", Name: "" });
                  setProductToEdit(null);
                }}
                disabled={formLoading}
              >
                Hủy
              </button>
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={formLoading}
              >
                {formLoading ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!formLoading) {
              setDeleteModalOpen(false);
              setProductToDelete(null);
            }
          }}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Xác nhận xóa</h2>
            <p>
              Bạn có chắc chắn muốn xóa loại xi măng{" "}
              <strong>{productToDelete?.Name}</strong> không?
            </p>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setProductToDelete(null);
                }}
                disabled={formLoading}
              >
                Hủy
              </button>
              <button
                className="btn-danger"
                onClick={handleConfirmDelete}
                disabled={formLoading}
              >
                {formLoading ? "Đang xóa..." : "Xóa"}
              </button>
            </div>
          </div>
        </div>
      )}

      <NotificationModal
        isOpen={notification.isOpen}
        type={notification.type}
        message={notification.message}
        onClose={() => setNotification({ ...notification, isOpen: false })}
      />
    </div>
  );
}

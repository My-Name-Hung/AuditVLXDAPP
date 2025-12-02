import { useEffect, useState } from "react";
import { HiEye } from "react-icons/hi";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "./StoreSurveyList.css";

interface StoreSurveyListItem {
  Id: number;
  StoreId: number;
  AuditId: number;
  UserId: number;
  StoreCode: string;
  StoreName: string;
  UserFullName: string;
  UserCode: string;
  CementProductCode: string | null;
  CementProductName: string | null;
  ContactPerson: string | null;
  PurchasePrice: number | null;
  SellingPrice: number | null;
  SupplierName: string | null;
  ImportExportQuantity: string | null;
  AuditDate: string | null;
  AuditNotes: string | null;
  products: Array<{
    Id: number;
    ProductType: string;
    CementProductCode: string | null;
    CementProductName: string | null;
    SellingPrice: number | null;
  }>;
}

const formatVND = (value: number | null): string => {
  if (value === null || value === undefined) return "";
  return value.toLocaleString("vi-VN");
};

const formatDate = (dateString: string | null): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("vi-VN");
};

export default function StoreSurveyList() {
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState<StoreSurveyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);

  // Filter states
  const [filters, setFilters] = useState({
    storeName: "",
    userName: "",
    cementProductName: "",
    dateFrom: "",
    dateTo: "",
  });

  useEffect(() => {
    fetchSurveys();
  }, []);

  const fetchSurveys = async () => {
    try {
      setLoading(true);
      const params: any = { page: 1, pageSize: 1000 };

      if (filters.storeName) params.storeName = filters.storeName;
      if (filters.userName) params.userName = filters.userName;
      if (filters.cementProductName)
        params.cementProductName = filters.cementProductName;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;

      const res = await api.get("/store-surveys", { params });

      // Fetch products for each survey
      const surveysWithProducts = await Promise.all(
        res.data.map(async (survey: any) => {
          try {
            const productsRes = await api.get(
              `/store-survey-products/survey/${survey.Id}`
            );
            return { ...survey, products: productsRes.data || [] };
          } catch {
            return { ...survey, products: [] };
          }
        })
      );

      setSurveys(surveysWithProducts);
    } catch (error) {
      console.error("Error fetching surveys:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleApplyFilters = () => {
    fetchSurveys();
  };

  const handleResetFilters = () => {
    setFilters({
      storeName: "",
      userName: "",
      cementProductName: "",
      dateFrom: "",
      dateTo: "",
    });
    setTimeout(() => fetchSurveys(), 100);
  };

  const handleExportExcel = async () => {
    try {
      setExportLoading(true);
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();

      // Get current week number
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const pastDaysOfYear = (now.getTime() - startOfYear.getTime()) / 86400000;
      const weekNumber = Math.ceil(
        (pastDaysOfYear + startOfYear.getDay() + 1) / 7
      );

      const sheet = workbook.addWorksheet("Báo cáo khảo sát");

      // Header style
      const headerStyle = {
        font: { bold: true, color: { argb: "FFFFFFFF" } },
        fill: {
          type: "pattern" as const,
          pattern: "solid" as const,
          fgColor: { argb: "FF0138C3" },
        },
        alignment: {
          horizontal: "center" as const,
          vertical: "middle" as const,
        },
        border: {
          top: { style: "thin" as const },
          bottom: { style: "thin" as const },
          left: { style: "thin" as const },
          right: { style: "thin" as const },
        },
      };

      // Title rows
      sheet.mergeCells("A1:K1");
      sheet.getCell("A1").value =
        "1. BÁO CÁO THỰC TẾ THĂM CỬA HÀNG TUẦN 20/2025";
      sheet.getCell("A1").font = { bold: true, size: 12 };
      sheet.getCell("A1").alignment = { horizontal: "left" };

      sheet.mergeCells("A2:K2");
      sheet.getCell("A2").value = `BÁO CÁO THĂM CỬA HÀNG TUẦN ${weekNumber}`;
      sheet.getCell("A2").font = { bold: true, size: 14 };
      sheet.getCell("A2").alignment = { horizontal: "center" };

      sheet.mergeCells("A3:K3");
      sheet.getCell("A3").value = "Địa bàn: An Giang";
      sheet.getCell("A3").font = { bold: true, size: 12 };
      sheet.getCell("A3").alignment = { horizontal: "center" };

      // Table headers
      const headers = [
        "Stt",
        "Tên Cửa hàng",
        "Ngày thăm",
        "Người tiếp xúc",
        "Loại XM",
        "Giá mua",
        "Giá bán",
        "SLTTBQ (tấn/tháng)",
        "Mua qua NPP",
        "Ý kiến CH",
      ];

      sheet.getRow(5).values = headers;
      sheet.getRow(5).eachCell((cell) => {
        cell.style = headerStyle;
      });

      // Data rows - Group by store and show multiple cement types
      let rowIndex = 6;
      let sttCounter = 1;

      // Group surveys by store
      const storeGroups = new Map<number, StoreSurveyListItem[]>();
      surveys.forEach((survey) => {
        if (!storeGroups.has(survey.StoreId)) {
          storeGroups.set(survey.StoreId, []);
        }
        storeGroups.get(survey.StoreId)!.push(survey);
      });

      storeGroups.forEach((storeSurveys) => {
        const firstSurvey = storeSurveys[0];
        let isFirstRow = true;

        // If store has products from Title 3, show them
        if (firstSurvey.products && firstSurvey.products.length > 0) {
          firstSurvey.products.forEach((product) => {
            const row = sheet.addRow([
              isFirstRow ? sttCounter : "",
              isFirstRow ? firstSurvey.StoreName || "" : "",
              isFirstRow ? formatDate(firstSurvey.AuditDate) : "",
              isFirstRow ? firstSurvey.ContactPerson || "" : "",
              product.CementProductName || "",
              "",
              formatVND(product.SellingPrice),
              "",
              "",
              isFirstRow ? firstSurvey.AuditNotes || "" : "",
            ]);

            row.eachCell((cell) => {
              cell.border = {
                top: { style: "thin" },
                bottom: { style: "thin" },
                left: { style: "thin" },
                right: { style: "thin" },
              };
              cell.alignment = { vertical: "middle" };
            });
            isFirstRow = false;
            rowIndex++;
          });
        }

        // Show Title 1 cement product if exists
        if (firstSurvey.CementProductName) {
          const row = sheet.addRow([
            isFirstRow ? sttCounter : "",
            isFirstRow ? firstSurvey.StoreName || "" : "",
            isFirstRow ? formatDate(firstSurvey.AuditDate) : "",
            isFirstRow ? firstSurvey.ContactPerson || "" : "",
            firstSurvey.CementProductName || "",
            formatVND(firstSurvey.PurchasePrice),
            formatVND(firstSurvey.SellingPrice),
            firstSurvey.ImportExportQuantity || "",
            firstSurvey.SupplierName || "",
            isFirstRow ? firstSurvey.AuditNotes || "" : "",
          ]);

          row.eachCell((cell) => {
            cell.border = {
              top: { style: "thin" },
              bottom: { style: "thin" },
              left: { style: "thin" },
              right: { style: "thin" },
            };
            cell.alignment = { vertical: "middle" };
          });
          isFirstRow = false;
          rowIndex++;
        }

        // If no products shown, show at least one row
        if (isFirstRow) {
          const row = sheet.addRow([
            sttCounter,
            firstSurvey.StoreName || "",
            formatDate(firstSurvey.AuditDate),
            firstSurvey.ContactPerson || "",
            firstSurvey.CementProductName || "",
            formatVND(firstSurvey.PurchasePrice),
            formatVND(firstSurvey.SellingPrice),
            firstSurvey.ImportExportQuantity || "",
            firstSurvey.SupplierName || "",
            firstSurvey.AuditNotes || "",
          ]);

          row.eachCell((cell) => {
            cell.border = {
              top: { style: "thin" },
              bottom: { style: "thin" },
              left: { style: "thin" },
              right: { style: "thin" },
            };
            cell.alignment = { vertical: "middle" };
          });
          rowIndex++;
        }

        sttCounter++;
      });

      // Column widths
      sheet.columns = [
        { width: 8 },
        { width: 25 },
        { width: 12 },
        { width: 18 },
        { width: 20 },
        { width: 12 },
        { width: 12 },
        { width: 18 },
        { width: 18 },
        { width: 30 },
      ];

      // Export
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `BaoCaoKhaoSat_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting Excel:", error);
      alert("Lỗi khi xuất file Excel");
    } finally {
      setExportLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Đang tải dữ liệu...</div>;
  }

  return (
    <div className="store-survey-list">
      <div className="store-survey-list-header">
        <h1>Danh sách khảo sát</h1>
        <button
          className="btn-export"
          onClick={handleExportExcel}
          disabled={exportLoading}
        >
          {exportLoading ? "Đang xuất..." : "Xuất Excel"}
        </button>
      </div>

      {/* Filter Section */}
      <div className="filter-section">
        <h3>Bộ lọc</h3>
        <div className="filter-grid">
          <div className="filter-item">
            <label>Tên cửa hàng:</label>
            <input
              type="text"
              value={filters.storeName}
              onChange={(e) => handleFilterChange("storeName", e.target.value)}
              placeholder="Nhập tên cửa hàng"
            />
          </div>
          <div className="filter-item">
            <label>Nhân viên:</label>
            <input
              type="text"
              value={filters.userName}
              onChange={(e) => handleFilterChange("userName", e.target.value)}
              placeholder="Nhập tên nhân viên"
            />
          </div>
          <div className="filter-item">
            <label>Loại xi măng:</label>
            <input
              type="text"
              value={filters.cementProductName}
              onChange={(e) =>
                handleFilterChange("cementProductName", e.target.value)
              }
              placeholder="Nhập loại xi măng"
            />
          </div>
          <div className="filter-item">
            <label>Từ ngày:</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
            />
          </div>
          <div className="filter-item">
            <label>Đến ngày:</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange("dateTo", e.target.value)}
            />
          </div>
        </div>
        <div className="filter-actions">
          <button className="btn-apply" onClick={handleApplyFilters}>
            Áp dụng
          </button>
          <button className="btn-reset" onClick={handleResetFilters}>
            Đặt lại
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="survey-list-table">
          <thead>
            <tr>
              <th>Stt</th>
              <th>Tên cửa hàng</th>
              <th>Loại xi măng</th>
              <th>Tên sản phẩm</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {surveys.length === 0 ? (
              <tr>
                <td colSpan={5} className="no-data">
                  Không có dữ liệu
                </td>
              </tr>
            ) : (
              surveys.map((survey, index) => {
                const mainProduct =
                  survey.products && survey.products.length > 0
                    ? survey.products[0]
                    : null;
                return (
                  <tr key={survey.Id}>
                    <td>{index + 1}</td>
                    <td>{survey.StoreName}</td>
                    <td>
                      {survey.CementProductName ||
                        mainProduct?.CementProductName ||
                        "-"}
                    </td>
                    <td>{mainProduct?.ProductType || "-"}</td>
                    <td>
                      <button
                        className="btn-view-survey-list"
                        onClick={() =>
                          navigate(
                            `/stores/${survey.StoreId}/survey?auditId=${survey.AuditId}&userId=${survey.UserId}`
                          )
                        }
                        title="Xem chi tiết"
                      >
                        <HiEye />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

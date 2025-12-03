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
  TerritoryName?: string;
  UserFullName: string;
  UserCode: string;
  CementProductId: number | null;
  CementProductCode: string | null;
  CementProductName: string | null;
  ContactPerson: string | null;
  PurchasePrice: number | null;
  SellingPrice: number | null;
  SupplierName: string | null;
  ImportExportQuantity: string | null;
  AuditDate: string | null;
  AuditNotes: string | null;
  AverageMonthlyConsumption?: number | null;
  StoreComment?: string | null;
  WhyNotSellNewProduct?: string | null;
  NewProductSellingPrice?: number | null;
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
    priceFrom: "",
    priceTo: "",
    productType: "", // 'xmtd' or 'non-xmtd' or ''
  });

  useEffect(() => {
    fetchSurveys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSurveys = async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = {
        page: 1,
        pageSize: 1000,
      };

      if (filters.storeName) params.storeName = filters.storeName;
      if (filters.userName) params.userName = filters.userName;
      if (filters.cementProductName)
        params.cementProductName = filters.cementProductName;
      if (filters.priceFrom) params.priceFrom = filters.priceFrom;
      if (filters.priceTo) params.priceTo = filters.priceTo;
      if (filters.productType) params.productType = filters.productType;

      const res = await api.get("/store-surveys", { params });

      // Fetch products for each survey
      const surveysWithProducts = await Promise.all(
        res.data.map(async (survey: StoreSurveyListItem) => {
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
      priceFrom: "",
      priceTo: "",
      productType: "",
    });
    setTimeout(() => fetchSurveys(), 100);
  };

  const handleExportExcel = async () => {
    try {
      setExportLoading(true);
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();

      // Get current week number based on month
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const firstDayOfMonth = new Date(year, month - 1, 1);
      const daysSinceMonthStart = Math.floor(
        (now.getTime() - firstDayOfMonth.getTime()) / (1000 * 60 * 60 * 24)
      );
      const weekNumber = Math.ceil(
        (daysSinceMonthStart + firstDayOfMonth.getDay() + 1) / 7
      );

      // Filter only XMTĐ products (Title 2 + 3)
      const xmtdSurveys = surveys.filter(
        (survey) =>
          survey.WhyNotSellNewProduct ||
          (survey.products && survey.products.length > 0)
      );

      // Group by TerritoryName
      const territoryGroups = new Map<string, StoreSurveyListItem[]>();
      xmtdSurveys.forEach((survey) => {
        const territory = survey.TerritoryName || "Chưa xác định";
        if (!territoryGroups.has(territory)) {
          territoryGroups.set(territory, []);
        }
        territoryGroups.get(territory)!.push(survey);
      });

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

      // Create a sheet for each territory
      territoryGroups.forEach((territorySurveys, territoryName) => {
        const sheet = workbook.addWorksheet(territoryName || "Chưa xác định");

        // Title rows
        sheet.mergeCells("A1:J1");
        sheet.getCell(
          "A1"
        ).value = `1. BÁO CÁO THỰC TẾ THĂM CỬA HÀNG TUẦN ${weekNumber}/${month}/${year}`;
        sheet.getCell("A1").font = { bold: true, size: 12 };
        sheet.getCell("A1").alignment = { horizontal: "left" };

        sheet.mergeCells("A2:J2");
        sheet.getCell("A2").value = `BÁO CÁO THĂM CỬA HÀNG TUẦN ${weekNumber}`;
        sheet.getCell("A2").font = { bold: true, size: 14 };
        sheet.getCell("A2").alignment = { horizontal: "center" };

        sheet.mergeCells("A3:J3");
        sheet.getCell("A3").value = `Địa bàn: ${
          territoryName || "Chưa xác định"
        }`;
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

        // Data rows - Group by store and show multiple products
        let sttCounter = 1;
        const storeGroups = new Map<number, StoreSurveyListItem[]>();
        territorySurveys.forEach((survey) => {
          if (!storeGroups.has(survey.StoreId)) {
            storeGroups.set(survey.StoreId, []);
          }
          storeGroups.get(survey.StoreId)!.push(survey);
        });

        storeGroups.forEach((storeSurveys) => {
          const firstSurvey = storeSurveys[0];
          let isFirstRow = true;

          // Show products from Title 3
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
                firstSurvey.AverageMonthlyConsumption || "",
                "",
                isFirstRow
                  ? firstSurvey.AuditNotes || firstSurvey.StoreComment || ""
                  : "",
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
            });
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
      });

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
            <label>Giá từ:</label>
            <input
              type="number"
              value={filters.priceFrom}
              onChange={(e) => handleFilterChange("priceFrom", e.target.value)}
              placeholder="Nhập giá tối thiểu"
            />
          </div>
          <div className="filter-item">
            <label>Giá đến:</label>
            <input
              type="number"
              value={filters.priceTo}
              onChange={(e) => handleFilterChange("priceTo", e.target.value)}
              placeholder="Nhập giá tối đa"
            />
          </div>
          <div className="filter-item">
            <label>Loại sản phẩm:</label>
            <select
              value={filters.productType}
              onChange={(e) =>
                handleFilterChange("productType", e.target.value)
              }
            >
              <option value="">Tất cả</option>
              <option value="xmtd">Sản phẩm XMTĐ</option>
              <option value="non-xmtd">Không phải sản phẩm XMTĐ</option>
            </select>
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

      {/* Tables - Phân cấp theo loại sản phẩm */}
      {/* Sản phẩm XMTĐ (Title 2 + 3) */}
      <div className="table-container">
        <h3 className="table-section-title">Sản phẩm của XMTĐ</h3>
        <table className="survey-list-table">
          <thead>
            <tr>
              <th>Stt</th>
              <th>Tên cửa hàng</th>
              <th>Ngày thăm</th>
              <th>Người tiếp xúc</th>
              <th>Loại XM</th>
              <th>Giá mua</th>
              <th>Giá bán</th>
              <th>SLTTBQ (tấn/tháng)</th>
              <th>Mua qua NPP</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {surveys.filter(
              (survey) =>
                survey.WhyNotSellNewProduct ||
                (survey.products && survey.products.length > 0)
            ).length === 0 ? (
              <tr>
                <td colSpan={10} className="no-data">
                  Không có dữ liệu
                </td>
              </tr>
            ) : (
              surveys
                .filter(
                  (survey) =>
                    survey.WhyNotSellNewProduct ||
                    (survey.products && survey.products.length > 0)
                )
                .map((survey, index) => {
                  const mainProduct =
                    survey.products && survey.products.length > 0
                      ? survey.products[0]
                      : null;
                  return (
                    <tr key={survey.Id}>
                      <td>{index + 1}</td>
                      <td>{survey.StoreName}</td>
                      <td>{formatDate(survey.AuditDate)}</td>
                      <td>{survey.ContactPerson || "-"}</td>
                      <td>{mainProduct?.CementProductName || "-"}</td>
                      <td>-</td>
                      <td>
                        {formatVND(
                          mainProduct?.SellingPrice ||
                            survey.NewProductSellingPrice ||
                            null
                        )}
                      </td>
                      <td>{survey.AverageMonthlyConsumption ?? "-"}</td>
                      <td>-</td>
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

      {/* Không phải sản phẩm XMTĐ (Title 1) */}
      <div className="table-container" style={{ marginTop: 24 }}>
        <h3 className="table-section-title">
          Cửa hàng bán sản phẩm không phải của Xi Măng Tây Đô
        </h3>
        <table className="survey-list-table">
          <thead>
            <tr>
              <th>Stt</th>
              <th>Tên cửa hàng</th>
              <th>Ngày thăm</th>
              <th>Người tiếp xúc</th>
              <th>Loại XM</th>
              <th>Giá mua</th>
              <th>Giá bán</th>
              <th>SLTTBQ (tấn/tháng)</th>
              <th>Mua qua NPP</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {surveys.filter((survey) => survey.CementProductId).length === 0 ? (
              <tr>
                <td colSpan={10} className="no-data">
                  Không có dữ liệu
                </td>
              </tr>
            ) : (
              surveys
                .filter((survey) => survey.CementProductId)
                .map((survey, index) => (
                  <tr key={survey.Id}>
                    <td>{index + 1}</td>
                    <td>{survey.StoreName}</td>
                    <td>{formatDate(survey.AuditDate)}</td>
                    <td>{survey.ContactPerson || "-"}</td>
                    <td>{survey.CementProductName || "-"}</td>
                    <td>{formatVND(survey.PurchasePrice)}</td>
                    <td>{formatVND(survey.SellingPrice)}</td>
                    <td>{survey.ImportExportQuantity || "-"}</td>
                    <td>{survey.SupplierName || "-"}</td>
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
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

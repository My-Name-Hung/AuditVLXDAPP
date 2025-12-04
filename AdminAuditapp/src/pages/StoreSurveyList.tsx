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
    ContactPersonPhone: string | null;
    PurchasePrice: number | null;
    SellingPrice: number | null;
    RoadTransportFee: number | null;
    WaterTransportFee: number | null;
    QuantityReceived: number | null;
    ImportedFromNPP: string | null;
    DiscountPromotion: string | null;
    AverageStockQuantity: number | null;
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

interface User {
  Id: number;
  FullName: string;
  UserCode: string;
}

interface CementProduct {
  Id: number;
  Code: string;
  Name: string;
}

export default function StoreSurveyList() {
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState<StoreSurveyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);

  // Users and Cement Products for filters
  const [users, setUsers] = useState<User[]>([]);
  const [cementProducts, setCementProducts] = useState<CementProduct[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [cementSearch, setCementSearch] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showCementDropdown, setShowCementDropdown] = useState(false);

  // Filter states
  const [filters, setFilters] = useState({
    storeName: "",
    userName: "",
    cementProductName: "",
    priceFrom: "",
    priceTo: "",
  });

  useEffect(() => {
    fetchSurveys();
    fetchUsers();
    fetchCementProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowUserDropdown(false);
      setShowCementDropdown(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get("/users", {
        params: { page: 1, pageSize: 1000 },
      });
      const data = response.data?.data || response.data || [];
      setUsers(
        data.map((u: { Id: number; FullName?: string; UserCode?: string }) => ({
          Id: u.Id,
          FullName: u.FullName || "",
          UserCode: u.UserCode || "",
        }))
      );
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchCementProducts = async () => {
    try {
      const response = await api.get("/cement-products");
      setCementProducts(response.data || []);
    } catch (error) {
      console.error("Error fetching cement products:", error);
    }
  };

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
      if (filters.priceFrom) {
        // Remove formatting before sending
        const priceFromValue = filters.priceFrom.replace(/[^\d]/g, "");
        if (priceFromValue) params.priceFrom = priceFromValue;
      }
      if (filters.priceTo) {
        // Remove formatting before sending
        const priceToValue = filters.priceTo.replace(/[^\d]/g, "");
        if (priceToValue) params.priceTo = priceToValue;
      }

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
    });
    setUserSearch("");
    setCementSearch("");
    setTimeout(() => fetchSurveys(), 100);
  };

  // Format VND for price inputs
  const formatVNDInput = (value: string): string => {
    const digits = value.replace(/[^\d]/g, "");
    if (!digits) return "";
    return Number(digits).toLocaleString("vi-VN");
  };

  const handlePriceFromChange = (value: string) => {
    const formatted = formatVNDInput(value);
    setFilters((prev) => ({ ...prev, priceFrom: formatted }));
  };

  const handlePriceToChange = (value: string) => {
    const formatted = formatVNDInput(value);
    setFilters((prev) => ({ ...prev, priceTo: formatted }));
  };

  // Filter users and cement products based on search
  const filteredUsers = users.filter((user) =>
    user.FullName.toLowerCase().includes(userSearch.toLowerCase()) ||
    user.UserCode.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredCementProducts = cementProducts.filter((product) =>
    product.Name.toLowerCase().includes(cementSearch.toLowerCase()) ||
    product.Code.toLowerCase().includes(cementSearch.toLowerCase())
  );

  const handleExportExcel = async () => {
    try {
      setExportLoading(true);
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();

      // Calculate week number in month and week number in year
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const day = now.getDate();
      
      // Week number in month (1-5): which week of the month (1-7, 8-14, 15-21, 22-28, 29+)
      const weekNumberInMonth = Math.ceil(day / 7);
      
      // Week number in year: calculate from January 1st
      // Get the first day of the year
      const januaryFirst = new Date(year, 0, 1);
      // Get the day of week for January 1st (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
      const firstDayOfWeek = januaryFirst.getDay();
      // Convert to Monday = 0, Tuesday = 1, ..., Sunday = 6
      const firstMondayOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
      
      // Calculate days since year start
      const daysSinceYearStart = Math.floor(
        (now.getTime() - januaryFirst.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      // Calculate week number: (days + offset to first Monday) / 7, rounded up
      const weekNumberInYear = Math.ceil((daysSinceYearStart + firstMondayOffset + 1) / 7);

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

        // Title rows - Layout: Title 1 (top), Territory (middle), Title 2 (below)
        sheet.mergeCells("A1:M1");
        sheet.getCell("A1").value = `BÁO CÁO THĂM CỬA HÀNG TUẦN ${weekNumberInMonth}`;
        sheet.getCell("A1").font = { bold: true, size: 14 };
        sheet.getCell("A1").alignment = { horizontal: "center" };

        sheet.mergeCells("A2:M2");
        sheet.getCell("A2").value = `Địa bàn: ${
          territoryName || "Chưa xác định"
        }`;
        sheet.getCell("A2").font = { bold: true, size: 12 };
        sheet.getCell("A2").alignment = { horizontal: "center" };

        sheet.mergeCells("A3:M3");
        sheet.getCell(
          "A3"
        ).value = `1. BÁO CÁO THỰC TẾ THĂM CỬA HÀNG TUẦN ${weekNumberInYear}/${year}`;
        sheet.getCell("A3").font = { bold: true, size: 12 };
        sheet.getCell("A3").alignment = { horizontal: "left" };

        // Table headers
        const headers = [
          "Stt",
          "Tên Cửa hàng",
          "Ngày thăm",
          "Tên + SDT",
          "Loại XM",
          "Giá mua",
          "Giá bán",
          "Phí VC đường bộ",
          "Phí VC đường thủy",
          "SL nhận hàng (tấn/tháng)",
          "Nhập từ NPP",
          "Số lượng tồn bình quân (tấn/tháng)",
          "Ý kiến CH",
        ];

        sheet.getRow(5).values = headers;
        sheet.getRow(5).height = 40; // Set row height for wrapped text
        sheet.getRow(5).eachCell((cell) => {
          cell.style = {
            ...headerStyle,
            alignment: {
              ...headerStyle.alignment,
              wrapText: true,
            },
          };
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
                product.ContactPersonPhone || "",
                product.CementProductName || "",
                formatVND(product.PurchasePrice),
                formatVND(product.SellingPrice),
                formatVND(product.RoadTransportFee),
                formatVND(product.WaterTransportFee),
                product.QuantityReceived || "",
                product.ImportedFromNPP || "",
                product.AverageStockQuantity || "",
                isFirstRow
                  ? firstSurvey.StoreComment || ""
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
          { width: 20 },
          { width: 20 },
          { width: 12 },
          { width: 12 },
          { width: 15 },
          { width: 15 },
          { width: 20 },
          { width: 18 },
          { width: 25 },
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
            <div style={{ position: "relative" }}>
              <input
                type="text"
                value={filters.userName || userSearch}
                onChange={(e) => {
                  const value = e.target.value;
                  setUserSearch(value);
                  handleFilterChange("userName", value);
                  setShowUserDropdown(true);
                }}
                onFocus={(e) => {
                  e.stopPropagation();
                  setShowUserDropdown(true);
                }}
                onClick={(e) => e.stopPropagation()}
                placeholder="Tìm kiếm nhân viên"
              />
              {showUserDropdown && filteredUsers.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    backgroundColor: "#fff",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    maxHeight: "200px",
                    overflowY: "auto",
                    zIndex: 1000,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  }}
                >
                  {filteredUsers.map((user) => (
                    <div
                      key={user.Id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFilterChange("userName", user.FullName);
                        setUserSearch(user.FullName);
                        setShowUserDropdown(false);
                      }}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer",
                        borderBottom: "1px solid #eee",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#f5f5f5";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#fff";
                      }}
                    >
                      {user.FullName} ({user.UserCode})
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="filter-item">
            <label>Loại xi măng:</label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                value={filters.cementProductName || cementSearch}
                onChange={(e) => {
                  const value = e.target.value;
                  setCementSearch(value);
                  handleFilterChange("cementProductName", value);
                  setShowCementDropdown(true);
                }}
                onFocus={(e) => {
                  e.stopPropagation();
                  setShowCementDropdown(true);
                }}
                onClick={(e) => e.stopPropagation()}
                placeholder="Tìm kiếm loại xi măng"
              />
              {showCementDropdown && filteredCementProducts.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    backgroundColor: "#fff",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    maxHeight: "200px",
                    overflowY: "auto",
                    zIndex: 1000,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  }}
                >
                  {filteredCementProducts.map((product) => (
                    <div
                      key={product.Id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFilterChange("cementProductName", product.Name);
                        setCementSearch(product.Name);
                        setShowCementDropdown(false);
                      }}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer",
                        borderBottom: "1px solid #eee",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#f5f5f5";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#fff";
                      }}
                    >
                      {product.Name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="filter-item">
            <label>Giá từ:</label>
            <input
              type="text"
              value={filters.priceFrom}
              onChange={(e) => handlePriceFromChange(e.target.value)}
              placeholder="Nhập giá tối thiểu"
            />
          </div>
          <div className="filter-item">
            <label>Giá đến:</label>
            <input
              type="text"
              value={filters.priceTo}
              onChange={(e) => handlePriceToChange(e.target.value)}
              placeholder="Nhập giá tối đa"
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
              <th>Số lượng tồn bình quân (tấn/tháng)</th>
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
                      <td>{survey.StoreName || "-"}</td>
                      <td>{formatDate(survey.AuditDate) || "-"}</td>
                      <td>{mainProduct?.ContactPersonPhone || survey.ContactPerson || "-"}</td>
                      <td>{mainProduct?.CementProductName || "-"}</td>
                      <td>{formatVND(mainProduct?.PurchasePrice || null) || "-"}</td>
                      <td>
                        {formatVND(
                          mainProduct?.SellingPrice ||
                            survey.NewProductSellingPrice ||
                            null
                        ) || "-"}
                      </td>
                      <td>{mainProduct?.AverageStockQuantity ?? survey.AverageMonthlyConsumption ?? "-"}</td>
                      <td>{survey.SupplierName || mainProduct?.ImportedFromNPP || "-"}</td>
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

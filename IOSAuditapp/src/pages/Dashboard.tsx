import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Pie } from "react-chartjs-2";
import Header from "../components/Header";
import { useTheme } from "../contexts/ThemeContext";
import api from "../services/api";
import "./Dashboard.css";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface Territory {
  Id: number;
  TerritoryName: string;
}

interface CementProduct {
  Id: number;
  Code: string;
  Name: string;
}

interface StoresByDate {
  AuditDate: string;
  AuditedCount: number;
  NotAuditedCount: number;
}

interface ProductPrice {
  PurchasePrice: number;
  SellingPrice: number;
  Count: number;
}

interface SummaryTableItem {
  StoreId: number;
  StoreCode: string;
  StoreName: string;
  TerritoryName: string;
  AuditStatus: string;
  ProductName: string | null;
  PurchasePrice: number | null;
  SellingPrice: number | null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [cementProducts, setCementProducts] = useState<CementProduct[]>([]);
  const [selectedTerritory, setSelectedTerritory] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [showTerritoryDropdown, setShowTerritoryDropdown] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Chart data
  const [storesByDate, setStoresByDate] = useState<StoresByDate[]>([]);
  const [productPrices, setProductPrices] = useState<{
    prices: ProductPrice[];
    totalPurchase: number;
    totalSelling: number;
  } | null>(null);

  // Table data
  const [tableData, setTableData] = useState<SummaryTableItem[]>([]);
  const [tablePage, setTablePage] = useState(1);
  const [tableTotalPages, setTableTotalPages] = useState(1);

  useEffect(() => {
    fetchTerritories();
    fetchCementProducts();
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      fetchStoresByDate();
    }
  }, [startDate, endDate, selectedTerritory]);

  useEffect(() => {
    if (selectedProduct) {
      fetchProductPrices();
    }
  }, [selectedProduct]);

  useEffect(() => {
    fetchSummaryTable();
  }, [tablePage, selectedTerritory, startDate, endDate]);

  const fetchTerritories = async () => {
    try {
      const response = await api.get("/territories");
      console.log("Territories response:", response.data);
      // Handle different response structures
      if (Array.isArray(response.data)) {
        setTerritories(response.data);
      } else if (response.data && Array.isArray(response.data.data)) {
        setTerritories(response.data.data);
      } else {
        setTerritories([]);
      }
    } catch (error) {
      console.error("Error fetching territories:", error);
      setTerritories([]);
    }
  };

  const fetchCementProducts = async () => {
    try {
      const response = await api.get("/cement-products");
      setCementProducts(response.data || []);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching cement products:", error);
      setLoading(false);
    }
  };

  const fetchStoresByDate = async () => {
    try {
      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (selectedTerritory) params.territoryId = selectedTerritory;

      const response = await api.get("/dashboard/stores-by-date", { params });
      console.log("Stores by date response:", response.data);
      if (response.data && response.data.success) {
        setStoresByDate(response.data.data || []);
      } else {
        setStoresByDate(response.data || []);
      }
    } catch (error) {
      console.error("Error fetching stores by date:", error);
      setStoresByDate([]);
    }
  };

  const fetchProductPrices = async () => {
    try {
      const response = await api.get("/dashboard/product-prices", {
        params: { cementProductId: selectedProduct },
      });
      console.log("Product prices response:", response.data);
      if (response.data && response.data.success) {
        setProductPrices(response.data.data || null);
      } else {
        setProductPrices(response.data || null);
      }
    } catch (error) {
      console.error("Error fetching product prices:", error);
      setProductPrices(null);
    }
  };

  const fetchSummaryTable = async () => {
    try {
      const params: any = {
        page: tablePage,
        pageSize: 20,
      };
      if (selectedTerritory) params.territoryId = selectedTerritory;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await api.get("/dashboard/summary-table", { params });
      console.log("Summary table response:", response.data);
      if (response.data && response.data.success) {
        setTableData(response.data.data || []);
        setTableTotalPages(response.data.pagination?.totalPages || 1);
      } else {
        setTableData(response.data?.data || response.data || []);
        setTableTotalPages(response.data?.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error("Error fetching summary table:", error);
      setTableData([]);
      setTableTotalPages(1);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container" style={{ backgroundColor: colors.background }}>
        <Header title="Dashboard" />
        <div className="loading-container">
          <div className="spinner" style={{ borderTopColor: colors.primary }}></div>
        </div>
      </div>
    );
  }

    return (
      <div className="dashboard-container" style={{ backgroundColor: colors.background }}>
        <Header />
        <div className="back-button-container">
          <div
            className="back-button"
            style={{ borderColor: colors.icon + "40", cursor: "pointer" }}
            onClick={() => navigate("/stores")}
          >
            <span style={{ fontSize: "16px" }}>←</span>
            <span style={{ color: colors.text }}>Quay lại</span>
          </div>
        </div>
        <div className="dashboard-content">
        {/* Filters */}
        <div className="filter-section" style={{ borderColor: colors.icon + "20" }}>
          <h3 className="section-title" style={{ color: colors.text }}>Bộ lọc</h3>

          <div className="filter-row">
            <label className="filter-label" style={{ color: colors.text }}>
              Địa bàn:
            </label>
            <div className="dropdown-container">
              <div
                className="dropdown"
                style={{ borderColor: colors.icon + "40", backgroundColor: colors.background }}
                onClick={() => setShowTerritoryDropdown(!showTerritoryDropdown)}
              >
                <span className="dropdown-text" style={{ color: colors.text }}>
                  {selectedTerritory
                    ? territories.find((t) => t.Id.toString() === selectedTerritory)?.TerritoryName || "Tất cả"
                    : "Tất cả"}
                </span>
                <span style={{ color: colors.icon }}>
                  {showTerritoryDropdown ? "▲" : "▼"}
                </span>
              </div>
              {showTerritoryDropdown && (
                <div
                  className="dropdown-menu"
                  style={{ backgroundColor: colors.background, borderColor: colors.icon + "40" }}
                >
                  <div
                    className="dropdown-item"
                    onClick={() => {
                      setSelectedTerritory("");
                      setShowTerritoryDropdown(false);
                    }}
                  >
                    <span className="dropdown-item-text" style={{ color: colors.text }}>
                      Tất cả
                    </span>
                  </div>
                  {territories.map((territory) => (
                    <div
                      key={territory.Id}
                      className="dropdown-item"
                      onClick={() => {
                        setSelectedTerritory(territory.Id.toString());
                        setShowTerritoryDropdown(false);
                      }}
                    >
                      <span className="dropdown-item-text" style={{ color: colors.text }}>
                        {territory.TerritoryName}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="filter-row">
            <label className="filter-label" style={{ color: colors.text }}>
              Từ ngày:
            </label>
            <div className="date-input-container" style={{ borderColor: colors.icon + "40" }}>
              <input
                type="date"
                className="date-input"
                style={{ color: colors.text }}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span className="calendar-icon" style={{ color: colors.primary }}>📅</span>
            </div>
          </div>

          <div className="filter-row">
            <label className="filter-label" style={{ color: colors.text }}>
              Đến ngày:
            </label>
            <div className="date-input-container" style={{ borderColor: colors.icon + "40" }}>
              <input
                type="date"
                className="date-input"
                style={{ color: colors.text }}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              <span className="calendar-icon" style={{ color: colors.primary }}>📅</span>
            </div>
          </div>
        </div>

        {/* Bar Chart Section */}
        {storesByDate.length > 0 ? (
          <div className="chart-section" style={{ borderColor: colors.icon + "20" }}>
            <h3 className="section-title" style={{ color: colors.text }}>
              Biểu đồ số cửa hàng theo ngày
            </h3>
            <div className="chart-placeholder">
              <p className="chart-placeholder-text" style={{ color: colors.icon }}>
                Bar Chart sẽ được hiển thị ở đây
              </p>
              <p className="chart-info" style={{ color: colors.text }}>
                Đã thực hiện: {storesByDate.reduce((sum, item) => sum + item.AuditedCount, 0)}
              </p>
              <p className="chart-info" style={{ color: colors.text }}>
                Chưa thực hiện: {storesByDate.reduce((sum, item) => sum + item.NotAuditedCount, 0)}
              </p>
            </div>
          </div>
        ) : (
          <div className="chart-section" style={{ borderColor: colors.icon + "20" }}>
            <h3 className="section-title" style={{ color: colors.text }}>
              Biểu đồ số cửa hàng theo ngày
            </h3>
            <p className="no-data-text" style={{ color: colors.icon }}>
              Chưa có dữ liệu. Vui lòng chọn khoảng thời gian.
            </p>
          </div>
        )}

        {/* Pie Chart Section */}
        <div className="chart-section" style={{ borderColor: colors.icon + "20" }}>
          <h3 className="section-title" style={{ color: colors.text }}>
            Biểu đồ giá sản phẩm
          </h3>

          <div className="filter-row">
            <label className="filter-label" style={{ color: colors.text }}>
              Chọn sản phẩm:
            </label>
            <div className="dropdown-container">
              <div
                className="dropdown"
                style={{ borderColor: colors.icon + "40", backgroundColor: colors.background }}
                onClick={() => setShowProductDropdown(!showProductDropdown)}
              >
                <span className="dropdown-text" style={{ color: colors.text }}>
                  {selectedProduct
                    ? cementProducts.find((p) => p.Id.toString() === selectedProduct)?.Name || "Chọn sản phẩm"
                    : "Chọn sản phẩm"}
                </span>
                <span style={{ color: colors.icon }}>
                  {showProductDropdown ? "▲" : "▼"}
                </span>
              </div>
              {showProductDropdown && (
                <div
                  className="dropdown-menu"
                  style={{ backgroundColor: colors.background, borderColor: colors.icon + "40" }}
                >
                  <div
                    className="dropdown-item"
                    onClick={() => {
                      setSelectedProduct("");
                      setShowProductDropdown(false);
                    }}
                  >
                    <span className="dropdown-item-text" style={{ color: colors.text }}>
                      Chọn sản phẩm
                    </span>
                  </div>
                  {cementProducts.map((product) => (
                    <div
                      key={product.Id}
                      className="dropdown-item"
                      onClick={() => {
                        setSelectedProduct(product.Id.toString());
                        setShowProductDropdown(false);
                      }}
                    >
                      <span className="dropdown-item-text" style={{ color: colors.text }}>
                        {product.Name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {productPrices && productPrices.prices.length > 0 ? (
            <div className="pie-chart-container">
              <div className="chart-container">
                <Pie
                  data={{
                    labels: ["Giá mua", "Giá bán"],
                    datasets: [
                      {
                        data: [productPrices.totalPurchase, productPrices.totalSelling],
                        backgroundColor: ["rgba(33, 150, 243, 0.8)", "rgba(76, 175, 80, 0.8)"],
                        borderColor: ["rgba(33, 150, 243, 1)", "rgba(76, 175, 80, 1)"],
                        borderWidth: 1,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: "bottom" as const,
                        labels: {
                          color: colors.text,
                          padding: 15,
                        },
                      },
                      tooltip: {
                        callbacks: {
                          label: function (context) {
                            const label = context.label || "";
                            const value = context.parsed || 0;
                            return `${label}: ${value.toLocaleString("vi-VN")} VNĐ`;
                          },
                        },
                      },
                    },
                  }}
                  style={{ height: "300px" }}
                />
              </div>
              <div className="chart-info-container">
                <p className="chart-info" style={{ color: colors.text }}>
                  Tổng giá mua: {productPrices.totalPurchase.toLocaleString("vi-VN")} VNĐ
                </p>
                <p className="chart-info" style={{ color: colors.text }}>
                  Tổng giá bán: {productPrices.totalSelling.toLocaleString("vi-VN")} VNĐ
                </p>
              </div>
            </div>
          ) : (
            <p className="no-data-text" style={{ color: colors.icon }}>
              Chưa có dữ liệu. Vui lòng chọn sản phẩm.
            </p>
          )}
        </div>

        {/* Summary Table */}
        <div className="table-section" style={{ borderColor: colors.icon + "20" }}>
          <h3 className="section-title" style={{ color: colors.text }}>
            Bảng tổng hợp
          </h3>

          {tableData.length > 0 ? (
            <>
              <table className="summary-table">
                <thead>
                  <tr style={{ backgroundColor: colors.primary + "20" }}>
                    <th style={{ color: colors.text }}>Cửa hàng</th>
                    <th style={{ color: colors.text }}>Trạng thái</th>
                    <th style={{ color: colors.text }}>Sản phẩm</th>
                    <th style={{ color: colors.text }}>Giá mua</th>
                    <th style={{ color: colors.text }}>Giá bán</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((item, index) => (
                    <tr key={index} style={{ borderTopColor: colors.icon + "20" }}>
                      <td style={{ color: colors.text }}>{item.StoreName}</td>
                      <td style={{ color: colors.text }}>{item.AuditStatus}</td>
                      <td style={{ color: colors.text }}>{item.ProductName || "-"}</td>
                      <td style={{ color: colors.text }}>
                        {item.PurchasePrice ? item.PurchasePrice.toLocaleString("vi-VN") : "-"}
                      </td>
                      <td style={{ color: colors.text }}>
                        {item.SellingPrice ? item.SellingPrice.toLocaleString("vi-VN") : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="pagination">
                <button
                  className="pagination-button"
                  style={{
                    backgroundColor: colors.primary,
                    opacity: tablePage === 1 ? 0.5 : 1,
                  }}
                  onClick={() => setTablePage(Math.max(1, tablePage - 1))}
                  disabled={tablePage === 1}
                >
                  Trước
                </button>
                <span className="pagination-text" style={{ color: colors.text }}>
                  Trang {tablePage} / {tableTotalPages}
                </span>
                <button
                  className="pagination-button"
                  style={{
                    backgroundColor: colors.primary,
                    opacity: tablePage >= tableTotalPages ? 0.5 : 1,
                  }}
                  onClick={() => setTablePage(Math.min(tableTotalPages, tablePage + 1))}
                  disabled={tablePage >= tableTotalPages}
                >
                  Sau
                </button>
              </div>
            </>
          ) : (
            <p className="no-data-text" style={{ color: colors.icon }}>
              Chưa có dữ liệu.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}


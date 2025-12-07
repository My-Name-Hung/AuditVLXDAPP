import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import Header from "../components/Header";
import { useTheme } from "../contexts/ThemeContext";
import api from "../services/api";
import "./Dashboard.css";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface Territory {
  Id: number;
  TerritoryName: string;
}

interface StoresByDate {
  AuditDate: string;
  AuditedCount: number;
  NotAuditedCount: number;
}

interface StoreSurveyDetail {
  StoreId: number;
  StoreName: string;
  PurchasePrice: number | null;
  SellingPrice: number | null;
  AverageStockQuantity: number | null;
  QuantityReceived: number | null;
}

interface WeekData {
  week: number;
  weekLabel: string;
  startDate: string;
  endDate: string;
  auditedCount: number;
  notAuditedCount: number;
  totalPurchasePrice: number;
  totalSellingPrice: number;
  storeDetails: StoreSurveyDetail[];
}

// Helper function to get week number in month (1-4)
const getWeekInMonth = (date: Date): number => {
  const day = date.getDate();
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
};

// Helper function to get start and end date of a week in current month
const getWeekDates = (week: number, year: number, month: number) => {
  let startDay: number;
  let endDay: number;
  
  if (week === 1) {
    startDay = 1;
    endDay = 7;
  } else if (week === 2) {
    startDay = 8;
    endDay = 14;
  } else if (week === 3) {
    startDay = 15;
    endDay = 21;
  } else {
    startDay = 22;
    endDay = new Date(year, month + 1, 0).getDate(); // Last day of month
  }
  
  const startDate = new Date(year, month, startDay);
  const endDate = new Date(year, month, endDay);
  
  return {
    start: startDate.toISOString().split("T")[0],
    end: endDate.toISOString().split("T")[0],
  };
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [selectedTerritory, setSelectedTerritory] = useState<string>("");
  const [showTerritoryModal, setShowTerritoryModal] = useState(false);
  const [territorySearch, setTerritorySearch] = useState("");
  
  // Week filter - default to current week
  const now = new Date();
  const currentWeek = getWeekInMonth(now);
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>([currentWeek]);
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  
  // Chart data
  const [weekData, setWeekData] = useState<WeekData[]>([]);
  const [hasSurveyData, setHasSurveyData] = useState(false);

  useEffect(() => {
    fetchTerritories();
  }, []);

  useEffect(() => {
    if (selectedWeeks.length > 0) {
      fetchWeekData();
    }
  }, [selectedWeeks, selectedMonth, selectedYear, selectedTerritory]);

  const fetchTerritories = async () => {
    try {
      const response = await api.get("/territories");
      if (response.data && response.data.success && Array.isArray(response.data.data)) {
        setTerritories(response.data.data);
      } else if (Array.isArray(response.data)) {
        setTerritories(response.data);
      } else if (response.data && Array.isArray(response.data.data)) {
        setTerritories(response.data.data);
      } else {
        setTerritories([]);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error fetching territories:", error);
      setTerritories([]);
      setLoading(false);
    }
  };

  const fetchWeekData = async () => {
    try {
      const allWeekData: WeekData[] = [];
      let hasAnySurveyData = false;

      for (const week of selectedWeeks) {
        const weekDates = getWeekDates(week, selectedYear, selectedMonth);
        
        const params: any = {
          startDate: weekDates.start,
          endDate: weekDates.end,
        };
        if (selectedTerritory) params.territoryId = selectedTerritory;

        // Fetch stores by date
        const storesResponse = await api.get("/dashboard/stores-by-date", { params });
        const storesData = storesResponse.data?.success 
          ? storesResponse.data.data || []
          : storesResponse.data || [];

        // Calculate totals for the week
        let auditedCount = 0;
        let notAuditedCount = 0;

        storesData.forEach((item: StoresByDate) => {
          const date = new Date(item.AuditDate);
          const itemWeek = getWeekInMonth(date);
          if (itemWeek === week) {
            auditedCount += item.AuditedCount || 0;
            notAuditedCount += item.NotAuditedCount || 0;
          }
        });

        // Fetch survey details for this week
        const surveyParams = { ...params };
        const surveyResponse = await api.get("/dashboard/store-survey-details", { params: surveyParams }).catch(() => null);
        
        let totalPurchasePrice = 0;
        let totalSellingPrice = 0;
        const storeDetails: StoreSurveyDetail[] = [];

        if (surveyResponse?.data?.success && surveyResponse.data.data) {
          hasAnySurveyData = true;
          const surveyData = surveyResponse.data.data;
          
          surveyData.forEach((store: any) => {
            if (store.PurchasePrice) totalPurchasePrice += store.PurchasePrice;
            if (store.SellingPrice) totalSellingPrice += store.SellingPrice;
            
            storeDetails.push({
              StoreId: store.StoreId,
              StoreName: store.StoreName,
              PurchasePrice: store.PurchasePrice,
              SellingPrice: store.SellingPrice,
              AverageStockQuantity: store.AverageStockQuantity,
              QuantityReceived: store.QuantityReceived,
            });
          });
        }

        allWeekData.push({
          week,
          weekLabel: `Tuần ${week}`,
          startDate: weekDates.start,
          endDate: weekDates.end,
          auditedCount,
          notAuditedCount,
          totalPurchasePrice,
          totalSellingPrice,
          storeDetails,
        });
      }

      setHasSurveyData(hasAnySurveyData);
      setWeekData(allWeekData);
    } catch (error) {
      console.error("Error fetching week data:", error);
      setWeekData([]);
      setHasSurveyData(false);
    }
  };

  const toggleWeek = (week: number) => {
    setSelectedWeeks((prev) => {
      if (prev.includes(week)) {
        // Don't allow deselecting if it's the only selected week
        if (prev.length === 1) return prev;
        return prev.filter((w) => w !== week);
      } else {
        // Max 4 weeks
        if (prev.length >= 4) return prev;
        return [...prev, week].sort();
      }
    });
  };

  const selectAllWeeks = () => {
    setSelectedWeeks([1, 2, 3, 4]);
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

  // Prepare chart data
  const chartLabels = weekData.map((w) => w.weekLabel);
  const auditedData = weekData.map((w) => w.auditedCount);
  const notAuditedData = weekData.map((w) => w.notAuditedCount);
  const purchasePriceData = weekData.map((w) => Math.round(w.totalPurchasePrice / 1000000)); // Convert to millions
  const sellingPriceData = weekData.map((w) => Math.round(w.totalSellingPrice / 1000000));

  // Get all store details for survey chart
  const allStoreDetails = weekData.flatMap((w) => w.storeDetails);

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

          {/* Territory Filter */}
          <div className="filter-row">
            <div style={{ flex: 1 }}>
              <label className="filter-label" style={{ color: colors.text }}>
                Địa bàn:
              </label>
            </div>
            <div
              className="dropdown"
              style={{ borderColor: colors.icon + "40", backgroundColor: colors.background, cursor: "pointer" }}
              onClick={() => setShowTerritoryModal(true)}
            >
              <span className="dropdown-text" style={{ color: colors.text }}>
                {selectedTerritory
                  ? territories.find((t) => t.Id.toString() === selectedTerritory)?.TerritoryName || "Tất cả"
                  : "Tất cả"}
              </span>
              <span style={{ color: colors.icon }}>▼</span>
            </div>
          </div>

          {/* Week Filter */}
          <div className="week-filter-container">
            <div className="week-filter-header">
              <label className="filter-label" style={{ color: colors.text }}>
                Chọn tuần trong tháng:
              </label>
              <button
                type="button"
                onClick={selectAllWeeks}
                className="select-all-button"
                style={{ backgroundColor: colors.primary + "20", color: colors.primary }}
              >
                Chọn tất cả
              </button>
            </div>
            <div className="week-checkbox-container">
              {[1, 2, 3, 4].map((week) => (
                <button
                  key={week}
                  type="button"
                  className="week-checkbox"
                  style={{
                    backgroundColor: selectedWeeks.includes(week)
                      ? colors.primary
                      : colors.background,
                    borderColor: colors.icon + "40",
                    color: selectedWeeks.includes(week) ? "#fff" : colors.text,
                  }}
                  onClick={() => toggleWeek(week)}
                >
                  {selectedWeeks.includes(week) ? "✓" : "☐"} Tuần {week}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Bar Chart - Stores by Week */}
        {weekData.length > 0 ? (
          <div className="chart-section" style={{ borderColor: colors.icon + "20" }}>
            <h3 className="section-title" style={{ color: colors.text }}>
              Thống kê cửa hàng theo tuần
            </h3>
            <div className="chart-container">
              <Bar
                data={{
                  labels: chartLabels,
                  datasets: [
                    {
                      label: "Đã thực hiện",
                      data: auditedData,
                      backgroundColor: "rgba(16, 185, 129, 0.8)",
                      borderColor: "rgba(16, 185, 129, 1)",
                      borderWidth: 1,
                    },
                    {
                      label: "Chưa thực hiện",
                      data: notAuditedData,
                      backgroundColor: "rgba(245, 158, 11, 0.8)",
                      borderColor: "rgba(245, 158, 11, 1)",
                      borderWidth: 1,
                    },
                    {
                      label: "Giá mua (triệu VNĐ)",
                      data: purchasePriceData,
                      backgroundColor: "rgba(59, 130, 246, 0.8)",
                      borderColor: "rgba(59, 130, 246, 1)",
                      borderWidth: 1,
                    },
                    {
                      label: "Giá bán (triệu VNĐ)",
                      data: sellingPriceData,
                      backgroundColor: "rgba(139, 92, 246, 0.8)",
                      borderColor: "rgba(139, 92, 246, 1)",
                      borderWidth: 1,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "top" as const,
                      labels: {
                        color: colors.text,
                      },
                    },
                    title: {
                      display: false,
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        color: colors.text,
                      },
                      grid: {
                        color: colors.icon + "20",
                      },
                    },
                    x: {
                      ticks: {
                        color: colors.text,
                      },
                      grid: {
                        color: colors.icon + "20",
                      },
                    },
                  },
                }}
                style={{ height: "300px" }}
              />
            </div>
            <div className="chart-legend">
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: "#10B981" }}></div>
                <span className="legend-text" style={{ color: colors.text }}>
                  Đã thực hiện: {weekData.reduce((sum, w) => sum + w.auditedCount, 0)}
                </span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: "#F59E0B" }}></div>
                <span className="legend-text" style={{ color: colors.text }}>
                  Chưa thực hiện: {weekData.reduce((sum, w) => sum + w.notAuditedCount, 0)}
                </span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: "#3B82F6" }}></div>
                <span className="legend-text" style={{ color: colors.text }}>
                  Tổng giá mua: {weekData.reduce((sum, w) => sum + w.totalPurchasePrice, 0).toLocaleString("vi-VN")} VNĐ
                </span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: "#8B5CF6" }}></div>
                <span className="legend-text" style={{ color: colors.text }}>
                  Tổng giá bán: {weekData.reduce((sum, w) => sum + w.totalSellingPrice, 0).toLocaleString("vi-VN")} VNĐ
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="chart-section" style={{ borderColor: colors.icon + "20" }}>
            <h3 className="section-title" style={{ color: colors.text }}>
              Thống kê cửa hàng theo tuần
            </h3>
            <p className="no-data-text" style={{ color: colors.icon }}>
              Chưa có dữ liệu.
            </p>
          </div>
        )}

        {/* Survey Details Bar Chart - Only show if has survey data */}
        {hasSurveyData && allStoreDetails.length > 0 && (
          <div className="chart-section" style={{ borderColor: colors.icon + "20" }}>
            <h3 className="section-title" style={{ color: colors.text }}>
              Chi tiết khảo sát cửa hàng
            </h3>
            <div className="chart-container">
              <Bar
                data={{
                  labels: allStoreDetails.map((s) => s.StoreName.length > 10 ? s.StoreName.substring(0, 10) + "..." : s.StoreName),
                  datasets: [
                    {
                      label: "Giá mua (nghìn VNĐ)",
                      data: allStoreDetails.map((s) => s.PurchasePrice ? Math.round(s.PurchasePrice / 1000) : 0),
                      backgroundColor: "rgba(59, 130, 246, 0.8)",
                      borderColor: "rgba(59, 130, 246, 1)",
                      borderWidth: 1,
                    },
                    {
                      label: "Giá bán (nghìn VNĐ)",
                      data: allStoreDetails.map((s) => s.SellingPrice ? Math.round(s.SellingPrice / 1000) : 0),
                      backgroundColor: "rgba(139, 92, 246, 0.8)",
                      borderColor: "rgba(139, 92, 246, 1)",
                      borderWidth: 1,
                    },
                    {
                      label: "Tồn bình quân (tấn)",
                      data: allStoreDetails.map((s) => s.AverageStockQuantity || 0),
                      backgroundColor: "rgba(16, 185, 129, 0.8)",
                      borderColor: "rgba(16, 185, 129, 1)",
                      borderWidth: 1,
                    },
                    {
                      label: "Sản lượng (tấn)",
                      data: allStoreDetails.map((s) => s.QuantityReceived || 0),
                      backgroundColor: "rgba(245, 158, 11, 0.8)",
                      borderColor: "rgba(245, 158, 11, 1)",
                      borderWidth: 1,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "top" as const,
                      labels: {
                        color: colors.text,
                      },
                    },
                    title: {
                      display: false,
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        color: colors.text,
                      },
                      grid: {
                        color: colors.icon + "20",
                      },
                    },
                    x: {
                      ticks: {
                        color: colors.text,
                        maxRotation: 45,
                        minRotation: 45,
                      },
                      grid: {
                        color: colors.icon + "20",
                      },
                    },
                  },
                }}
                style={{ height: "300px" }}
              />
            </div>
            <div className="chart-legend">
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: "#3B82F6" }}></div>
                <span className="legend-text" style={{ color: colors.text }}>
                  Giá mua (nghìn VNĐ)
                </span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: "#8B5CF6" }}></div>
                <span className="legend-text" style={{ color: colors.text }}>
                  Giá bán (nghìn VNĐ)
                </span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: "#10B981" }}></div>
                <span className="legend-text" style={{ color: colors.text }}>
                  Tồn bình quân (tấn)
                </span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: "#F59E0B" }}></div>
                <span className="legend-text" style={{ color: colors.text }}>
                  Sản lượng (tấn)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Territory Picker Modal */}
      {showTerritoryModal && (
        <div className="modal-overlay" onClick={() => {
          setShowTerritoryModal(false);
          setTerritorySearch("");
        }}>
          <div className="modal-content" style={{ backgroundColor: colors.background }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 className="modal-title" style={{ color: colors.text, margin: 0 }}>
                Chọn địa bàn
              </h3>
              <button
                onClick={() => {
                  setShowTerritoryModal(false);
                  setTerritorySearch("");
                }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "24px", color: colors.icon }}
              >
                ×
              </button>
            </div>
            <input
              type="text"
              className="modal-search-input"
              style={{
                backgroundColor: colors.background,
                color: colors.text,
                borderColor: colors.icon + "40",
                marginBottom: "12px",
              }}
              value={territorySearch}
              onChange={(e) => setTerritorySearch(e.target.value)}
              placeholder="Tìm kiếm địa bàn"
            />
            <div className="modal-scroll-view">
              <div
                className="modal-option"
                style={{
                  backgroundColor: !selectedTerritory ? colors.primary + "20" : "transparent",
                  cursor: "pointer",
                }}
                onClick={() => {
                  setSelectedTerritory("");
                  setShowTerritoryModal(false);
                  setTerritorySearch("");
                }}
              >
                <span className="modal-option-text" style={{ color: colors.text }}>
                  Tất cả
                </span>
              </div>
              {territories
                .filter((territory) =>
                  territory.TerritoryName.toLowerCase().includes(
                    territorySearch.toLowerCase()
                  )
                )
                .map((territory) => (
                  <div
                    key={territory.Id}
                    className="modal-option"
                    style={{
                      backgroundColor:
                        selectedTerritory === territory.Id.toString()
                          ? colors.primary + "20"
                          : "transparent",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      setSelectedTerritory(territory.Id.toString());
                      setShowTerritoryModal(false);
                      setTerritorySearch("");
                    }}
                  >
                    <span className="modal-option-text" style={{ color: colors.text }}>
                      {territory.TerritoryName}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

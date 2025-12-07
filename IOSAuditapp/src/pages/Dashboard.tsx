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

interface Store {
  Id: number;
  StoreCode: string;
  StoreName: string;
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
  IsAudited: boolean;
}

interface DayData {
  date: string;
  dateLabel: string;
  auditedCount: number;
  notAuditedCount: number;
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

// Helper function to get all dates in selected weeks
const getDatesInWeeks = (weeks: number[], year: number, month: number): string[] => {
  const dates: string[] = [];
  
  weeks.forEach((week) => {
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
      endDay = new Date(year, month + 1, 0).getDate();
    }
    
    for (let day = startDay; day <= endDay; day++) {
      const date = new Date(year, month, day);
      dates.push(date.toISOString().split("T")[0]);
    }
  });
  
  return dates.sort();
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedTerritory, setSelectedTerritory] = useState<string>("");
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [showTerritoryModal, setShowTerritoryModal] = useState(false);
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [territorySearch, setTerritorySearch] = useState("");
  const [storeSearch, setStoreSearch] = useState("");
  
  // Week filter - default to current week
  const now = new Date();
  const currentWeek = getWeekInMonth(now);
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>([currentWeek]);
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  
  // Chart data - by day instead of week
  const [dayData, setDayData] = useState<DayData[]>([]);
  const [hasSurveyData, setHasSurveyData] = useState(false);

  useEffect(() => {
    fetchTerritories();
    fetchStores();
  }, []);

  useEffect(() => {
    if (selectedWeeks.length > 0) {
      fetchDayData();
    }
  }, [selectedWeeks, selectedMonth, selectedYear, selectedTerritory, selectedStore]);

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

  const fetchStores = async () => {
    try {
      const response = await api.get("/stores", {
        params: { page: 1, pageSize: 1000 },
      });
      const data = response.data?.data || response.data || [];
      setStores(
        data.map((s: { Id: number; StoreCode?: string; StoreName?: string }) => ({
          Id: s.Id,
          StoreCode: s.StoreCode || "",
          StoreName: s.StoreName || "",
        }))
      );
    } catch (error) {
      console.error("Error fetching stores:", error);
      setStores([]);
    }
  };

  const fetchDayData = async () => {
    try {
      const dates = getDatesInWeeks(selectedWeeks, selectedYear, selectedMonth);
      const allDayData: DayData[] = [];
      let hasAnySurveyData = false;

      for (const date of dates) {
        const params: any = {
          startDate: date,
          endDate: date,
        };
        if (selectedTerritory) params.territoryId = selectedTerritory;
        if (selectedStore) params.storeId = selectedStore;

        // Fetch stores by date for counts
        const storesResponse = await api.get("/dashboard/stores-by-date", { params });
        const storesData = storesResponse.data?.success 
          ? storesResponse.data.data || []
          : storesResponse.data || [];

        let auditedCount = 0;
        let notAuditedCount = 0;

        storesData.forEach((item: StoresByDate) => {
          if (item.AuditDate === date) {
            auditedCount += item.AuditedCount || 0;
            notAuditedCount += item.NotAuditedCount || 0;
          }
        });

        // Fetch stores with audit status for this date
        const auditStatusParams = { ...params };
        const auditStatusResponse = await api.get("/dashboard/stores-with-audit-status", { params: auditStatusParams }).catch(() => null);
        
        // Fetch survey details for this date
        const surveyParams = { ...params };
        const surveyResponse = await api.get("/dashboard/store-survey-details", { params: surveyParams }).catch(() => null);
        
        const storeDetails: StoreSurveyDetail[] = [];
        const surveyDataMap = new Map<number, any>();

        if (surveyResponse?.data?.success && surveyResponse.data.data) {
          hasAnySurveyData = true;
          surveyResponse.data.data.forEach((store: any) => {
            surveyDataMap.set(store.StoreId, store);
          });
        }

        // Combine audit status with survey data
        if (auditStatusResponse?.data?.success && auditStatusResponse.data.data) {
          auditStatusResponse.data.data.forEach((store: any) => {
            const surveyData = surveyDataMap.get(store.StoreId);
            storeDetails.push({
              StoreId: store.StoreId,
              StoreName: store.StoreName,
              PurchasePrice: surveyData?.PurchasePrice || null,
              SellingPrice: surveyData?.SellingPrice || null,
              AverageStockQuantity: surveyData?.AverageStockQuantity || null,
              QuantityReceived: surveyData?.QuantityReceived || null,
              IsAudited: store.IsAudited,
            });
          });
        }

        const dateObj = new Date(date);
        allDayData.push({
          date,
          dateLabel: `${dateObj.getDate()}/${dateObj.getMonth() + 1}`,
          auditedCount,
          notAuditedCount,
          storeDetails,
        });
      }

      setHasSurveyData(hasAnySurveyData);
      setDayData(allDayData);
    } catch (error) {
      console.error("Error fetching day data:", error);
      setDayData([]);
      setHasSurveyData(false);
    }
  };

  const toggleWeek = (week: number) => {
    setSelectedWeeks((prev) => {
      if (prev.includes(week)) {
        if (prev.length === 1) return prev;
        return prev.filter((w) => w !== week);
      } else {
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

  // Prepare chart data - by day
  const chartLabels = dayData.map((d) => d.dateLabel);
  const auditedData = dayData.map((d) => d.auditedCount);
  const notAuditedData = dayData.map((d) => d.notAuditedCount);

  // Get all store details for charts
  const allStoreDetails = dayData.flatMap((d) => d.storeDetails);
  
  // Separate stores by audit status
  const auditedStores = allStoreDetails.filter((s) => s.IsAudited);
  const notAuditedStores = allStoreDetails.filter((s) => !s.IsAudited);
  
  // For store detail chart - show audited vs not audited
  const storeDetailLabels = allStoreDetails.map((s) => 
    s.StoreName.length > 10 ? s.StoreName.substring(0, 10) + "..." : s.StoreName
  );
  const storeAuditedData = allStoreDetails.map((s) => s.IsAudited ? 1 : 0);
  const storeNotAuditedData = allStoreDetails.map((s) => s.IsAudited ? 0 : 1);

  // Filter stores
  const filteredStores = stores.filter((store) =>
    store.StoreName.toLowerCase().includes(storeSearch.toLowerCase()) ||
    store.StoreCode.toLowerCase().includes(storeSearch.toLowerCase())
  );

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

          {/* Store Filter */}
          <div className="filter-row">
            <div style={{ flex: 1 }}>
              <label className="filter-label" style={{ color: colors.text }}>
                Cửa hàng:
              </label>
            </div>
            <div
              className="dropdown"
              style={{ borderColor: colors.icon + "40", backgroundColor: colors.background, cursor: "pointer" }}
              onClick={() => setShowStoreModal(true)}
            >
              <span className="dropdown-text" style={{ color: colors.text }}>
                {selectedStore
                  ? stores.find((s) => s.Id.toString() === selectedStore)?.StoreName || "Tất cả"
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

        {/* Main Bar Chart - Stores by Day (Đã/Chưa thực hiện) */}
        {dayData.length > 0 ? (
          <div className="chart-section" style={{ borderColor: colors.icon + "20" }}>
            <h3 className="section-title" style={{ color: colors.text }}>
              Thống kê cửa hàng theo ngày
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
                  Đã thực hiện: {dayData.reduce((sum, d) => sum + d.auditedCount, 0)}
                </span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: "#F59E0B" }}></div>
                <span className="legend-text" style={{ color: colors.text }}>
                  Chưa thực hiện: {dayData.reduce((sum, d) => sum + d.notAuditedCount, 0)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="chart-section" style={{ borderColor: colors.icon + "20" }}>
            <h3 className="section-title" style={{ color: colors.text }}>
              Thống kê cửa hàng theo ngày
            </h3>
            <p className="no-data-text" style={{ color: colors.icon }}>
              Chưa có dữ liệu.
            </p>
          </div>
        )}

        {/* Store Details Bar Chart - Đã/Chưa thực hiện */}
        {allStoreDetails.length > 0 && (
          <div className="chart-section" style={{ borderColor: colors.icon + "20" }}>
            <h3 className="section-title" style={{ color: colors.text }}>
              Chi tiết cửa hàng
            </h3>
            <div className="chart-container">
              <Bar
                data={{
                  labels: storeDetailLabels,
                  datasets: [
                    {
                      label: "Đã thực hiện",
                      data: storeAuditedData,
                      backgroundColor: "rgba(16, 185, 129, 0.8)",
                      borderColor: "rgba(16, 185, 129, 1)",
                      borderWidth: 1,
                    },
                    {
                      label: "Chưa thực hiện",
                      data: storeNotAuditedData,
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
                <div className="legend-color" style={{ backgroundColor: "#10B981" }}></div>
                <span className="legend-text" style={{ color: colors.text }}>
                  Đã thực hiện: {auditedStores.length}
                </span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: "#F59E0B" }}></div>
                <span className="legend-text" style={{ color: colors.text }}>
                  Chưa thực hiện: {notAuditedStores.length}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Survey Details Bar Chart - Tách nhiều cột */}
        {hasSurveyData && auditedStores.length > 0 && (
          <div className="chart-section" style={{ borderColor: colors.icon + "20" }}>
            <h3 className="section-title" style={{ color: colors.text }}>
              Chi tiết khảo sát cửa hàng
            </h3>
            <div className="chart-container">
              <Bar
                data={{
                  labels: auditedStores.map((s) => s.StoreName.length > 10 ? s.StoreName.substring(0, 10) + "..." : s.StoreName),
                  datasets: [
                    {
                      label: "Giá mua (nghìn VNĐ)",
                      data: auditedStores.map((s) => s.PurchasePrice ? Math.round(s.PurchasePrice / 1000) : 0),
                      backgroundColor: "rgba(59, 130, 246, 0.8)",
                      borderColor: "rgba(59, 130, 246, 1)",
                      borderWidth: 1,
                    },
                    {
                      label: "Giá bán (nghìn VNĐ)",
                      data: auditedStores.map((s) => s.SellingPrice ? Math.round(s.SellingPrice / 1000) : 0),
                      backgroundColor: "rgba(139, 92, 246, 0.8)",
                      borderColor: "rgba(139, 92, 246, 1)",
                      borderWidth: 1,
                    },
                    {
                      label: "Tồn bình quân (tấn)",
                      data: auditedStores.map((s) => s.AverageStockQuantity || 0),
                      backgroundColor: "rgba(16, 185, 129, 0.8)",
                      borderColor: "rgba(16, 185, 129, 1)",
                      borderWidth: 1,
                    },
                    {
                      label: "Sản lượng (tấn)",
                      data: auditedStores.map((s) => s.QuantityReceived || 0),
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

      {/* Store Picker Modal */}
      {showStoreModal && (
        <div className="modal-overlay" onClick={() => {
          setShowStoreModal(false);
          setStoreSearch("");
        }}>
          <div className="modal-content" style={{ backgroundColor: colors.background }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 className="modal-title" style={{ color: colors.text, margin: 0 }}>
                Chọn cửa hàng
              </h3>
              <button
                onClick={() => {
                  setShowStoreModal(false);
                  setStoreSearch("");
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
              value={storeSearch}
              onChange={(e) => setStoreSearch(e.target.value)}
              placeholder="Tìm kiếm cửa hàng"
            />
            <div className="modal-scroll-view">
              <div
                className="modal-option"
                style={{
                  backgroundColor: !selectedStore ? colors.primary + "20" : "transparent",
                  cursor: "pointer",
                }}
                onClick={() => {
                  setSelectedStore("");
                  setShowStoreModal(false);
                  setStoreSearch("");
                }}
              >
                <span className="modal-option-text" style={{ color: colors.text }}>
                  Tất cả
                </span>
              </div>
              {filteredStores.map((store) => (
                <div
                  key={store.Id}
                  className="modal-option"
                  style={{
                    backgroundColor:
                      selectedStore === store.Id.toString()
                        ? colors.primary + "20"
                        : "transparent",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setSelectedStore(store.Id.toString());
                    setShowStoreModal(false);
                    setStoreSearch("");
                  }}
                >
                  <span className="modal-option-text" style={{ color: colors.text }}>
                    {store.StoreName} ({store.StoreCode})
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

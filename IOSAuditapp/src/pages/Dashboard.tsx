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

// Helper function to get week dates (7 days) for a given month and week number
const getWeekDates = (year: number, month: number, weekNumber: number): string[] => {
  // Month is 1-indexed (1 = January, 12 = December)
  const monthIndex = month - 1;
  
  // Calculate start day of the week
  // Week 1: days 1-7, Week 2: days 8-14, Week 3: days 15-21, Week 4: days 22-end
  let startDay: number;
  if (weekNumber === 1) {
    startDay = 1;
  } else if (weekNumber === 2) {
    startDay = 8;
  } else if (weekNumber === 3) {
    startDay = 15;
  } else {
    startDay = 22;
  }
  
  const dates: string[] = [];
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  
  for (let i = 0; i < 7; i++) {
    const day = startDay + i;
    if (day <= daysInMonth) {
      const date = new Date(year, monthIndex, day);
      dates.push(date.toISOString().split("T")[0]);
    } else {
      // If week extends beyond month, use last day of month
      const date = new Date(year, monthIndex, daysInMonth);
      dates.push(date.toISOString().split("T")[0]);
      break;
    }
  }
  
  return dates;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [selectedTerritory, setSelectedTerritory] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [showTerritoryModal, setShowTerritoryModal] = useState(false);
  const [territorySearch, setTerritorySearch] = useState("");

  // Chart data
  const [storesByDate, setStoresByDate] = useState<StoresByDate[]>([]);

  useEffect(() => {
    fetchTerritories();
  }, []);

  useEffect(() => {
    fetchStoresByDate();
  }, [selectedMonth, selectedYear, selectedWeek, selectedTerritory]);

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

  const fetchStoresByDate = async () => {
    try {
      const weekDates = getWeekDates(selectedYear, selectedMonth, selectedWeek);
      if (weekDates.length === 0) {
        setStoresByDate([]);
        return;
      }
      
      const startDate = weekDates[0];
      const endDate = weekDates[weekDates.length - 1];
      
      const params: any = {
        startDate,
        endDate,
      };
      if (selectedTerritory) params.territoryId = selectedTerritory;

      const response = await api.get("/dashboard/stores-by-date", { params });
      
      // Create a map of dates from API response
      // Normalize dates to YYYY-MM-DD format for comparison
      const normalizeDate = (dateStr: string | Date): string => {
        if (!dateStr) return "";
        const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
        if (isNaN(date.getTime())) return "";
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };
      
      const dataMap = new Map<string, StoresByDate>();
      const responseData = response.data?.success ? response.data.data : response.data || [];
      
      console.log("API Response data:", responseData);
      console.log("Week dates:", weekDates);
      
      responseData.forEach((item: StoresByDate) => {
        const normalizedDate = normalizeDate(item.AuditDate);
        if (normalizedDate) {
          dataMap.set(normalizedDate, {
            ...item,
            AuditDate: normalizedDate,
          });
        }
      });
      
      // Fill in all 7 days of the week, even if no data
      const filledData: StoresByDate[] = weekDates.map((date) => {
        const existing = dataMap.get(date);
        return existing || {
          AuditDate: date,
          AuditedCount: 0,
          NotAuditedCount: 0,
        };
      });
      
      console.log("Filled data:", filledData);
      setStoresByDate(filledData);
    } catch (error) {
      console.error("Error fetching stores by date:", error);
      setStoresByDate([]);
    }
  };

  const getMonthName = (month: number): string => {
    const months = [
      "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
      "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
    ];
    return months[month - 1] || "";
  };

  const getWeekLabel = (week: number): string => {
    return `Tuần ${week}`;
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
        {/* Filters Section */}
        <div className="filter-section" style={{ borderColor: colors.icon + "20", backgroundColor: colors.secondary }}>
          <h3 className="section-title" style={{ color: colors.text }}>Bộ lọc</h3>
          
          {/* Territory Filter */}
          <div className="filter-row">
            <label className="filter-label" style={{ color: colors.text }}>
              Địa bàn:
            </label>
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

          {/* Month Filter */}
          <div className="filter-row">
            <label className="filter-label" style={{ color: colors.text }}>
              Tháng:
            </label>
            <div className="month-year-container">
              <button
                className="month-button"
                style={{ backgroundColor: colors.background, borderColor: colors.icon + "40" }}
                onClick={() => {
                  if (selectedMonth > 1) {
                    setSelectedMonth(selectedMonth - 1);
                  } else {
                    setSelectedMonth(12);
                    setSelectedYear(selectedYear - 1);
                  }
                }}
              >
                ←
              </button>
              <span className="month-year-text" style={{ color: colors.text }}>
                {getMonthName(selectedMonth)} {selectedYear}
              </span>
              <button
                className="month-button"
                style={{ backgroundColor: colors.background, borderColor: colors.icon + "40" }}
                onClick={() => {
                  if (selectedMonth < 12) {
                    setSelectedMonth(selectedMonth + 1);
                  } else {
                    setSelectedMonth(1);
                    setSelectedYear(selectedYear + 1);
                  }
                }}
              >
                →
              </button>
            </div>
          </div>

          {/* Week Filter */}
          <div className="filter-row">
            <label className="filter-label" style={{ color: colors.text }}>
              Tuần:
            </label>
            <div className="week-container">
              {[1, 2, 3, 4].map((week) => (
                <button
                  key={week}
                  className="week-button"
                  style={{
                    backgroundColor: selectedWeek === week ? colors.primary : colors.background,
                    borderColor: colors.icon + "40",
                    color: selectedWeek === week ? "#fff" : colors.text,
                  }}
                  onClick={() => setSelectedWeek(week)}
                >
                  {getWeekLabel(week)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bar Chart Section */}
        {storesByDate.length > 0 ? (
          <div className="chart-section" style={{ borderColor: colors.icon + "20", backgroundColor: colors.secondary }}>
            <h3 className="section-title" style={{ color: colors.text }}>
              Thống kê cửa hàng theo tuần
            </h3>
            <p className="chart-subtitle" style={{ color: colors.icon }}>
              {getWeekLabel(selectedWeek)} - {getMonthName(selectedMonth)} {selectedYear}
            </p>
            <div className="chart-container">
              <Bar
                data={{
                  labels: storesByDate.map((item) => {
                    const date = new Date(item.AuditDate);
                    const dayName = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][date.getDay()];
                    return `${dayName}\n${date.getDate()}/${date.getMonth() + 1}`;
                  }),
                  datasets: [
                    {
                      label: "Đã thực hiện",
                      data: storesByDate.map((item) => item.AuditedCount),
                      backgroundColor: "rgba(16, 185, 129, 0.8)", // Emerald green
                      borderColor: "rgba(16, 185, 129, 1)",
                      borderWidth: 1,
                    },
                    {
                      label: "Chưa thực hiện",
                      data: storesByDate.map((item) => item.NotAuditedCount),
                      backgroundColor: "rgba(245, 158, 11, 0.8)", // Amber
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
                        padding: 15,
                        font: {
                          size: 13,
                        },
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
                        stepSize: 1,
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
                        display: false,
                      },
                    },
                  },
                  barPercentage: 0.7,
                  categoryPercentage: 0.8,
                }}
                style={{ height: "350px" }}
              />
            </div>
            <div className="chart-legend">
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: "#10B981" }}></div>
                <span className="legend-text" style={{ color: colors.text }}>
                  Đã thực hiện: {storesByDate.reduce((sum, item) => sum + item.AuditedCount, 0)}
                </span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: "#F59E0B" }}></div>
                <span className="legend-text" style={{ color: colors.text }}>
                  Chưa thực hiện: {storesByDate.reduce((sum, item) => sum + item.NotAuditedCount, 0)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="chart-section" style={{ borderColor: colors.icon + "20", backgroundColor: colors.secondary }}>
            <h3 className="section-title" style={{ color: colors.text }}>
              Thống kê cửa hàng theo tuần
            </h3>
            <p className="no-data-text" style={{ color: colors.icon }}>
              Chưa có dữ liệu.
            </p>
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

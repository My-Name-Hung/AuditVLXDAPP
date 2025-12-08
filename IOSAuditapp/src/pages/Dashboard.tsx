import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from "chart.js";
import { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import { useNavigate } from "react-router-dom";
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

interface TerritorySummary {
  TerritoryId: number;
  TerritoryName: string;
  StoresChecked: number;
  CheckinDays: number;
}

interface TerritorySummaryResponse {
  territories: TerritorySummary[];
  totals: {
    StoresChecked: number;
    CheckinDays: number;
  };
}

// Helper function to get week dates (7 days) for a given month and week number
const getWeekDates = (
  year: number,
  month: number,
  weekNumber: number
): string[] => {
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

// Helper function to get month start and end dates
const getMonthDates = (
  year: number,
  month: number
): { startDate: string; endDate: string } => {
  const monthIndex = month - 1;
  const startDate = new Date(year, monthIndex, 1);
  const endDate = new Date(year, monthIndex + 1, 0); // Last day of month

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
  };
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [selectedTerritory, setSelectedTerritory] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<number>(
    new Date().getMonth() + 1
  );
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear()
  );
  const [selectedWeek, setSelectedWeek] = useState<number>(0); // 0 = Tất cả, 1-4 = Tuần 1-4
  const [showTerritoryModal, setShowTerritoryModal] = useState(false);
  const [territorySearch, setTerritorySearch] = useState("");

  // Chart data
  const [territorySummary, setTerritorySummary] =
    useState<TerritorySummaryResponse | null>(null);

  const fetchTerritories = async () => {
    try {
      const response = await api.get("/territories");
      if (
        response.data &&
        response.data.success &&
        Array.isArray(response.data.data)
      ) {
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

  const fetchStoresByTerritory = async () => {
    try {
      let startDate: string;
      let endDate: string;

      // Nếu selectedWeek = 0 (Tất cả), dùng date range của cả tháng
      // Nếu selectedWeek > 0, dùng date range của tuần đó
      if (selectedWeek === 0) {
        const monthDates = getMonthDates(selectedYear, selectedMonth);
        startDate = monthDates.startDate;
        endDate = monthDates.endDate;
      } else {
        const weekDates = getWeekDates(
          selectedYear,
          selectedMonth,
          selectedWeek
        );
        if (weekDates.length === 0) {
          setTerritorySummary(null);
          return;
        }
        startDate = weekDates[0];
        endDate = weekDates[weekDates.length - 1];
      }

      const params: {
        startDate: string;
        endDate: string;
        territoryId?: string;
      } = {
        startDate,
        endDate,
      };

      // Thêm filter theo địa bàn nếu có
      if (selectedTerritory) {
        params.territoryId = selectedTerritory;
      }

      const response = await api.get("/dashboard/stores-by-territory", {
        params,
      });

      console.log("Territory summary response:", response.data);

      if (response.data.success) {
        setTerritorySummary(response.data.data);
        console.log("Territory summary set:", response.data.data);
      } else {
        setTerritorySummary(null);
      }
    } catch (error) {
      console.error("Error fetching stores by territory:", error);
      setTerritorySummary(null);
    }
  };

  const getMonthName = (month: number): string => {
    const months = [
      "Tháng 1",
      "Tháng 2",
      "Tháng 3",
      "Tháng 4",
      "Tháng 5",
      "Tháng 6",
      "Tháng 7",
      "Tháng 8",
      "Tháng 9",
      "Tháng 10",
      "Tháng 11",
      "Tháng 12",
    ];
    return months[month - 1] || "";
  };

  const getWeekLabel = (week: number): string => {
    return `Tuần ${week}`;
  };

  useEffect(() => {
    fetchTerritories();
  }, []);

  useEffect(() => {
    fetchStoresByTerritory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear, selectedWeek, selectedTerritory]);

  if (loading) {
    return (
      <div
        className="dashboard-container"
        style={{ backgroundColor: colors.background }}
      >
        <Header title="Dashboard" />
        <div className="loading-container">
          <div
            className="spinner"
            style={{ borderTopColor: colors.primary }}
          ></div>
        </div>
      </div>
    );
  }

    return (
    <div
      className="dashboard-container"
      style={{ backgroundColor: colors.background }}
    >
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
        <div
          className="filter-section"
          style={{
            borderColor: colors.icon + "20",
            backgroundColor: colors.secondary,
          }}
        >
          <h3 className="section-title" style={{ color: colors.text }}>
            Bộ lọc
          </h3>

          {/* Territory Filter */}
          <div className="filter-row">
              <label className="filter-label" style={{ color: colors.text }}>
                Địa bàn:
              </label>
            <div
              className="dropdown"
              style={{
                borderColor: colors.icon + "40",
                backgroundColor: colors.background,
                cursor: "pointer",
              }}
              onClick={() => setShowTerritoryModal(true)}
            >
              <span className="dropdown-text" style={{ color: colors.text }}>
                {selectedTerritory
                  ? territories.find(
                      (t) => t.Id.toString() === selectedTerritory
                    )?.TerritoryName || "Tất cả"
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
                style={{
                  backgroundColor: colors.background,
                  borderColor: colors.icon + "40",
                }}
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
                style={{
                  backgroundColor: colors.background,
                  borderColor: colors.icon + "40",
                }}
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
              <button
                className="week-button"
                style={{
                  backgroundColor:
                    selectedWeek === 0 ? colors.primary : colors.background,
                  borderColor: colors.icon + "40",
                  color: selectedWeek === 0 ? "#fff" : colors.text,
                }}
                onClick={() => setSelectedWeek(0)}
              >
                Tất cả
              </button>
              {[1, 2, 3, 4].map((week) => (
                <button
                  key={week}
                  className="week-button"
                  style={{
                    backgroundColor:
                      selectedWeek === week
                        ? colors.primary
                        : colors.background,
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

        {/* Bar Chart Section - Luôn hiển thị theo địa bàn */}
        {territorySummary &&
        territorySummary.territories &&
        territorySummary.territories.length > 0 ? (
          <div
            className="chart-section"
            style={{
              borderColor: colors.icon + "20",
              backgroundColor: colors.secondary,
            }}
          >
            <h3 className="section-title" style={{ color: colors.text }}>
              Thống kê theo địa bàn
            </h3>
            <p className="chart-subtitle" style={{ color: colors.icon }}>
              {selectedWeek === 0
                ? `${getMonthName(selectedMonth)} ${selectedYear}`
                : `${getWeekLabel(selectedWeek)} - ${getMonthName(
                    selectedMonth
                  )} ${selectedYear}`}
            </p>
            <div className="chart-container">
              <Bar
                data={{
                  labels: territorySummary.territories.map(
                    (item) => item.TerritoryName
                  ),
                  datasets: [
                    {
                      label: "Số cửa hàng checkin",
                      data: territorySummary.territories.map(
                        (item) => item.StoresChecked || 0
                      ),
                      backgroundColor: "rgba(16, 185, 129, 0.8)", // Emerald green
                      borderColor: "rgba(16, 185, 129, 1)",
                      borderWidth: 1,
                    },
                    {
                      label: "Số ngày checkin",
                      data: territorySummary.territories.map(
                        (item) => item.CheckinDays || 0
                      ),
                      backgroundColor: "rgba(245, 158, 11, 0.8)", // Amber
                      borderColor: "rgba(245, 158, 11, 1)",
                      borderWidth: 1,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: {
                    mode: "index" as const,
                    intersect: false,
                  },
                  plugins: {
                    legend: {
                      position: "top" as const,
                      labels: {
                        color: colors.text,
                        padding: 15,
                        font: {
                          size: 13,
                        },
                        usePointStyle: true,
                        pointStyle: "rect",
                      },
                    },
                    title: {
                      display: false,
                    },
                    tooltip: {
                      enabled: true,
                      mode: "index" as const,
                      intersect: false,
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        color: colors.text,
                        stepSize: 1,
                        precision: 0,
                      },
                      grid: {
                        color: colors.icon + "20",
                      },
                    },
                    x: {
                      ticks: {
                        color: colors.text,
                        maxRotation: 0,
                        minRotation: 0,
                      },
                      grid: {
                        display: false,
                      },
                    },
                  },
                }}
                style={{ height: "380px" }}
              />
            </div>
            <div className="chart-legend">
              <div className="legend-item">
                <div
                  className="legend-color"
                  style={{ backgroundColor: "#10B981" }}
                ></div>
                <span className="legend-text" style={{ color: colors.text }}>
                  Số cửa hàng checkin:{" "}
                  {territorySummary.totals?.StoresChecked || 0}
                </span>
              </div>
              <div className="legend-item">
                <div
                  className="legend-color"
                  style={{ backgroundColor: "#F59E0B" }}
                ></div>
                <span className="legend-text" style={{ color: colors.text }}>
                  Số ngày checkin: {territorySummary.totals?.CheckinDays || 0}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="chart-section"
            style={{
              borderColor: colors.icon + "20",
              backgroundColor: colors.secondary,
            }}
          >
            <h3 className="section-title" style={{ color: colors.text }}>
              Thống kê theo địa bàn
            </h3>
            <p className="chart-subtitle" style={{ color: colors.icon }}>
              {selectedWeek === 0
                ? `${getMonthName(selectedMonth)} ${selectedYear}`
                : `${getWeekLabel(selectedWeek)} - ${getMonthName(
                    selectedMonth
                  )} ${selectedYear}`}
            </p>
            <p className="no-data-text" style={{ color: colors.icon }}>
              Chưa có dữ liệu.
            </p>
          </div>
        )}

        {/* Territory Summary Table */}
        {territorySummary && (
          <div
            className="chart-section"
            style={{
              borderColor: colors.icon + "20",
              backgroundColor: colors.secondary,
              marginTop: "16px",
            }}
          >
            <h3
              className="section-title"
              style={{ color: colors.text, marginBottom: "12px" }}
            >
              Tổng hợp theo địa bàn
            </h3>
            <p
              className="chart-subtitle"
              style={{ color: colors.icon, marginBottom: "12px" }}
            >
              {getMonthName(selectedMonth)} {selectedYear}
            </p>
            <div className="table-container">
              <table className="territory-table">
                <thead>
                  <tr
                    className="table-header-row"
                    style={{ backgroundColor: colors.primary + "15" }}
                  >
                    <th
                      className="table-header-cell"
                      style={{ color: colors.text, width: "10%" }}
                    >
                      STT
                    </th>
                    <th
                      className="table-header-cell"
                      style={{ color: colors.text, width: "40%" }}
                    >
                      Địa bàn
                    </th>
                    <th
                      className="table-header-cell"
                      style={{
                        color: colors.text,
                        width: "25%",
                        textAlign: "center",
                      }}
                    >
                      Số cửa hàng checkin
                    </th>
                    <th
                      className="table-header-cell"
                      style={{
                          color: colors.text,
                        width: "25%",
                        textAlign: "center",
                      }}
                    >
                      Số ngày checkin
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {territorySummary.territories &&
                  territorySummary.territories.length > 0 ? (
                    territorySummary.territories.map((item, index) => (
                      <tr key={item.TerritoryId} className="table-row">
                        <td
                          className="table-cell"
                          style={{ color: colors.text, textAlign: "center" }}
                        >
                          {index + 1}
                        </td>
                        <td
                          className="table-cell"
                          style={{ color: colors.text }}
                        >
                          {item.TerritoryName}
                        </td>
                        <td
                          className="table-cell"
                          style={{
                            color: "#10B981",
                            textAlign: "center",
                            fontWeight: "600",
                          }}
                        >
                          {item.StoresChecked}
                        </td>
                        <td
                          className="table-cell"
                          style={{
                            color: "#F59E0B",
                            textAlign: "center",
                            fontWeight: "600",
                          }}
                        >
                          {item.CheckinDays}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr className="table-row">
                      <td
                        colSpan={4}
                        className="table-cell"
                        style={{
                          color: colors.icon,
                          textAlign: "center",
                          padding: "20px",
                        }}
                      >
                        Chưa có dữ liệu
                      </td>
                    </tr>
                  )}
                </tbody>
                {territorySummary.totals && (
                  <tfoot>
                    <tr
                      className="table-footer-row"
                      style={{
                        backgroundColor: colors.primary + "10",
                        borderTop: `2px solid ${colors.primary}`,
                      }}
                    >
                      <td
                        className="table-footer-cell"
                        style={{
                          color: colors.text,
                          fontWeight: "600",
                          textAlign: "center",
                        }}
                      ></td>
                      <td
                        className="table-footer-cell"
                        style={{ color: colors.text, fontWeight: "600" }}
                      >
                        Tổng
                      </td>
                      <td
                        className="table-footer-cell"
                        style={{
                          color: "#10B981",
                          fontWeight: "700",
                          textAlign: "center",
                        }}
                      >
                        {territorySummary.totals.StoresChecked}
                      </td>
                      <td
                        className="table-footer-cell"
                        style={{
                          color: "#F59E0B",
                          fontWeight: "700",
                          textAlign: "center",
                        }}
                      >
                        {territorySummary.totals.CheckinDays}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
              </div>
          )}
      </div>

      {/* Territory Picker Modal */}
      {showTerritoryModal && (
        <div
          className="modal-overlay"
          onClick={() => {
          setShowTerritoryModal(false);
          setTerritorySearch("");
          }}
        >
          <div
            className="modal-content"
            style={{ backgroundColor: colors.background }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <h3
                className="modal-title"
                style={{ color: colors.text, margin: 0 }}
              >
                Chọn địa bàn
              </h3>
              <button
                onClick={() => {
                  setShowTerritoryModal(false);
                  setTerritorySearch("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "24px",
                  color: colors.icon,
                }}
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
                  backgroundColor: !selectedTerritory
                    ? colors.primary + "20"
                    : "transparent",
                  cursor: "pointer",
                }}
                onClick={() => {
                  setSelectedTerritory("");
                  setShowTerritoryModal(false);
                  setTerritorySearch("");
                }}
              >
                <span
                  className="modal-option-text"
                  style={{ color: colors.text }}
                >
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
                    <span
                      className="modal-option-text"
                      style={{ color: colors.text }}
                    >
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

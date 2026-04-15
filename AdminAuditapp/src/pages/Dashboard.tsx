import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from "chart.js";
import { useEffect, useRef, useState } from "react";
import { Bar } from "react-chartjs-2";
import { HiArrowDownTray } from "react-icons/hi2";
import { useNavigate } from "react-router-dom";
import LoadingModal from "../components/LoadingModal";
import MultiSelect from "../components/MultiSelect";
import api from "../services/api";
import "./Dashboard.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

interface Territory {
  Id: number;
  TerritoryName: string;
}

interface DashboardSummaryItem {
  UserId: number;
  FullName: string;
  TerritoryId: number;
  TerritoryName: string;
  TotalCheckinDays: number;
  TotalStoresChecked: number;
}

interface DashboardDetailItem {
  CheckinDate: string;
  CheckinTime: string | null;
  StoreName: string;
  TerritoryName?: string;
  Address: string | null;
  Notes: string | null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [selectedTerritories, setSelectedTerritories] = useState<number[]>([]);
  const [summaryData, setSummaryData] = useState<DashboardSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState<"day" | "month" | "week">(
    "month",
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(
      2,
      "0",
    )}`,
  );
  const [weekOptions, setWeekOptions] = useState<
    Array<{ label: string; startDate: string; endDate: string }>
  >([]);
  const [selectedWeek, setSelectedWeek] = useState<{
    label: string;
    startDate: string;
    endDate: string;
  } | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<number[]>([]);
  const [allEmployees, setAllEmployees] = useState<
    Array<{ userId: number; fullName: string }>
  >([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const isInitialMount = useRef(true);

  // Generate week options for the selected month
  const generateWeekOptions = (yearMonth: string) => {
    const [year, month] = yearMonth.split("-").map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const weeks: Array<{ label: string; startDate: string; endDate: string }> =
      [];
    let weekStart = new Date(firstDay);

    // Adjust to Monday if first day is not Monday
    while (weekStart.getDay() !== 1) {
      weekStart = new Date(weekStart.getTime());
      weekStart.setDate(weekStart.getDate() - 1);
    }

    while (weekStart <= lastDay) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (weekEnd > lastDay) weekEnd.setTime(lastDay.getTime());

      const formatD = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      const label = `T${Math.ceil(
        ((weekStart.getTime() - firstDay.getTime()) / 86400000 + 1) / 7,
      )} (${formatD(weekStart)} - ${formatD(weekEnd)})`;

      weeks.push({
        label,
        startDate: formatD(weekStart),
        endDate: formatD(weekEnd),
      });

      weekStart = new Date(weekStart.getTime());
      weekStart.setDate(weekStart.getDate() + 7);
    }

    return weeks;
  };

  // Generate weeks whenever month changes
  useEffect(() => {
    const currentYearMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    const opts = generateWeekOptions(
      dateFilter === "week" ? selectedMonth : currentYearMonth,
    );
    setWeekOptions(opts);
    if (dateFilter === "week" && opts.length > 0) {
      const currentWeek = opts.find(
        (w) =>
          w.startDate <= new Date().toISOString().split("T")[0] &&
          w.endDate >= new Date().toISOString().split("T")[0],
      );
      setSelectedWeek(currentWeek || opts[opts.length - 1]);
    }
  }, [dateFilter, selectedMonth]);

  // Fetch all employees for the filter dropdown (not derived from summaryData)
  const fetchAllEmployees = async () => {
    try {
      const res = await api.get("/users", { timeout: 30000 });
      const users = res.data.data || res.data || [];
      setAllEmployees(
        users.map(
          (u: {
            UserId?: number;
            Id?: number;
            FullName?: string;
            fullName?: string;
            UserCode?: string;
            userCode?: string;
          }) => ({
            userId: u.UserId || u.Id || 0,
            fullName:
              u.FullName || u.fullName || u.UserCode || u.userCode || "",
          }),
        ),
      );
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  // uniqueEmployees comes from allEmployees (full list), not summaryData
  const uniqueEmployees = allEmployees;

  useEffect(() => {
    fetchTerritories();
    fetchAllEmployees();
    fetchSummary(); // Initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isInitialMount.current) {
      // Filter change - show loading modal (skip initial load)
      fetchSummary(true);
    } else {
      isInitialMount.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedTerritories,
    dateFilter,
    selectedDate,
    selectedMonth,
    selectedEmployee,
    selectedWeek,
  ]);

  const fetchTerritories = async () => {
    try {
      const res = await api.get("/territories");
      setTerritories(res.data.data || []);
    } catch (error) {
      console.error("Error fetching territories:", error);
    }
  };

  const fetchSummary = async (showLoading = false) => {
    try {
      if (showLoading) {
        setDataLoading(true);
      } else {
        setLoading(true);
      }

      const params: Record<string, string> = {};

      if (selectedEmployee.length > 0) {
        params.userIds = selectedEmployee.join(",");
      }

      if (selectedTerritories.length > 0) {
        params.territoryIds = selectedTerritories.join(",");
      }

      if (dateFilter === "day") {
        params.startDate = selectedDate;
        params.endDate = selectedDate;
      } else if (dateFilter === "month") {
        // Calculate start and end of month
        const [year, month] = selectedMonth.split("-");
        const startOfMonth = `${year}-${month}-01`;
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        params.startDate = startOfMonth;
        params.endDate = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
      } else if (dateFilter === "week" && selectedWeek) {
        params.startDate = selectedWeek.startDate;
        params.endDate = selectedWeek.endDate;
      }

      const res = await api.get("/dashboard/summary", {
        params,
        timeout: 65000, // 65 seconds timeout
      });

      if (res.data && res.data.success !== false) {
        setSummaryData(res.data.data || []);
      } else {
        console.error("Error in dashboard response:", res.data);
        setSummaryData([]);
      }
    } catch (error: unknown) {
      console.error("Error fetching summary:", error);
      setSummaryData([]);
      const errorMessage =
        (error as { message?: string })?.message ||
        "Lỗi khi tải dữ liệu dashboard";
      if (
        errorMessage.includes("timeout") ||
        errorMessage.includes("ETIMEOUT")
      ) {
        console.error("Dashboard query timeout - query may be too slow");
      }
    } finally {
      if (showLoading) {
        setDataLoading(false);
      } else {
        setLoading(false);
      }
    }
  };

  const handleExport = async () => {
    try {
      setExportLoading(true);
      setExportProgress(0);

      const params: Record<string, string> = {};

      if (selectedEmployee.length > 0) {
        params.userIds = selectedEmployee.join(",");
      }

      if (selectedTerritories.length > 0) {
        params.territoryIds = selectedTerritories.join(",");
      }

      if (dateFilter === "day") {
        params.startDate = selectedDate;
        params.endDate = selectedDate;
      } else if (dateFilter === "month") {
        const [year, month] = selectedMonth.split("-");
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const endDate = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
        params.startDate = startDate;
        params.endDate = endDate;
      } else if (dateFilter === "week" && selectedWeek) {
        params.startDate = selectedWeek.startDate;
        params.endDate = selectedWeek.endDate;
      }

      setExportProgress(20);
      // Fetch export data for details
      const res = await api.get("/dashboard/export", { params });
      setExportProgress(50);

      // Use summaryData from state (which matches the UI) instead of data from export API
      // This ensures the summary table in Excel matches what's shown on the UI
      await generateExcel(
        {
          summary: summaryData, // Use state data that matches UI
          details: res.data.data.details || {},
        },
        setExportProgress,
      );
      setExportProgress(100);

      // Delay a bit to show 100% before closing
      setTimeout(() => {
        setExportLoading(false);
        setExportProgress(0);
      }, 500);
    } catch (error) {
      console.error("Error exporting:", error);
      setExportLoading(false);
      setExportProgress(0);
      alert("Lỗi khi xuất báo cáo. Vui lòng thử lại.");
    }
  };

  const generateExcel = async (
    data: {
      summary: DashboardSummaryItem[];
      details: Record<string, DashboardDetailItem[]>;
    },
    progressCallback?: (progress: number) => void,
  ) => {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();

    if (progressCallback) progressCallback(60);

    // Sheet Tổng hợp
    const summarySheet = workbook.addWorksheet("Tổng hợp");

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
    summarySheet.mergeCells("A1:E1");
    summarySheet.getCell("A1").value = "CÔNG TY CỔ PHẦN XI MĂNG TÂY ĐÔ";
    summarySheet.getCell("A1").font = { bold: true, size: 14 };
    summarySheet.getCell("A1").alignment = { horizontal: "center" };

    summarySheet.mergeCells("A2:E2");
    summarySheet.getCell("A2").value =
      "BẢNG TỔNG HỢP CHECKIN CỬA HÀNG THEO THÁNG";
    summarySheet.getCell("A2").font = { bold: true, size: 12 };
    summarySheet.getCell("A2").alignment = { horizontal: "center" };

    // Headers
    summarySheet.getRow(4).values = [
      "Stt",
      "Họ tên",
      "Địa bàn phụ trách",
      "Tổng số ngày checkin",
      "Tổng số cửa hàng checkin",
    ];
    summarySheet.getRow(4).eachCell((cell) => {
      cell.style = headerStyle;
    });

    // Data
    data.summary.forEach((item, index) => {
      const row = summarySheet.addRow([
        index + 1,
        item.FullName,
        item.TerritoryName,
        item.TotalCheckinDays,
        item.TotalStoresChecked,
      ]);
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    // Total row
    const totalRow = summarySheet.addRow([
      "TỔNG CỘNG",
      "",
      "",
      data.summary.reduce((sum, item) => sum + item.TotalCheckinDays, 0),
      data.summary.reduce((sum, item) => sum + item.TotalStoresChecked, 0),
    ]);
    totalRow.getCell(1).font = { bold: true };
    totalRow.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    });

    // Set column widths
    summarySheet.columns = [
      { width: 10 },
      { width: 30 },
      { width: 30 },
      { width: 25 },
      { width: 25 },
    ];

    // Detail sheets - group by UserId so mỗi user có 1 sheet
    const userGroupMap = new Map<
      number,
      {
        user: DashboardSummaryItem;
        territories: Array<{ territoryId: number; territoryName: string }>;
      }
    >();

    data.summary.forEach((item) => {
      const existing = userGroupMap.get(item.UserId);
      if (existing) {
        existing.territories.push({
          territoryId: item.TerritoryId,
          territoryName: item.TerritoryName,
        });
      } else {
        userGroupMap.set(item.UserId, {
          user: item,
          territories: [
            {
              territoryId: item.TerritoryId,
              territoryName: item.TerritoryName,
            },
          ],
        });
      }
    });

    const groupedUsers = Array.from(userGroupMap.values());

    groupedUsers.forEach((group, index) => {
      const { user, territories } = group;
      const sheetName = `Chi tiết ${user.FullName}`;

      const detailSheet = workbook.addWorksheet(sheetName);

      if (progressCallback) {
        const progress = 60 + Math.floor((index / groupedUsers.length) * 30);
        progressCallback(progress);
      }

      detailSheet.mergeCells("A1:G1");
      detailSheet.getCell("A1").value = "CÔNG TY CỔ PHẦN XI MĂNG TÂY ĐÔ";
      detailSheet.getCell("A1").font = { bold: true, size: 14 };
      detailSheet.getCell("A1").alignment = { horizontal: "center" };

      detailSheet.mergeCells("A2:G2");
      detailSheet.getCell("A2").value =
        "BẢNG TỔNG HỢP CHECKIN CỬA HÀNG THEO THÁNG";
      detailSheet.getCell("A2").font = { bold: true, size: 12 };
      detailSheet.getCell("A2").alignment = { horizontal: "center" };

      detailSheet.getRow(4).values = [
        "STT",
        "Ngày",
        "Thời Gian Checkin",
        "NPP/Cửa hàng",
        "Địa bàn phụ trách",
        "Địa chỉ cửa hàng",
        "Ghi chú",
      ];
      detailSheet.getRow(4).eachCell((cell) => {
        cell.style = headerStyle;
      });

      let rowIndex = 0;
      territories.forEach(({ territoryId, territoryName }) => {
        const detailKey = `${user.UserId}-${territoryId}`;
        const userDetails = data.details[detailKey] || [];

        userDetails.forEach((detail) => {
          const checkinDate = new Date(detail.CheckinDate);
          const checkinTime = detail.CheckinTime
            ? new Date(detail.CheckinTime)
            : null;

          // Format date and time using UTC timezone to match UI display
          const formattedDate = checkinDate.toLocaleDateString("vi-VN", {
            timeZone: "UTC",
          });
          const formattedTime = checkinTime
            ? checkinTime.toLocaleTimeString("vi-VN", {
                hour12: false,
                timeZone: "UTC",
              })
            : "";

          detailSheet.addRow([
            ++rowIndex,
            formattedDate,
            formattedTime,
            detail.StoreName,
            detail.TerritoryName || territoryName || "",
            detail.Address || "",
            detail.Notes || "",
          ]);
        });
      });

      detailSheet.columns = [
        { width: 10 },
        { width: 15 },
        { width: 20 },
        { width: 25 },
        { width: 30 },
        { width: 40 },
        { width: 30 },
      ];
    });

    // Download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `BaoCaoCheckin_${
      new Date().toISOString().split("T")[0]
    }.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  // Count how many times each FullName appears with different territories
  const nameCountMap = new Map<string, number>();
  summaryData.forEach((item) => {
    const count = nameCountMap.get(item.FullName) || 0;
    nameCountMap.set(item.FullName, count + 1);
  });

  // Generate labels: if user appears multiple times, show "FullName - TerritoryName", otherwise just "FullName"
  const chartLabels = summaryData.map((item) => {
    const nameCount = nameCountMap.get(item.FullName) || 0;
    return nameCount > 1
      ? `${item.FullName} - ${item.TerritoryName}`
      : item.FullName;
  });

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: "Số ngày checkin",
        data: summaryData.map((item) => item.TotalCheckinDays),
        backgroundColor: "rgba(1, 56, 195, 0.8)",
      },
      {
        label: "Số cửa hàng checkin",
        data: summaryData.map((item) => item.TotalStoresChecked),
        backgroundColor: "rgba(1, 56, 195, 0.5)",
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  if (loading && summaryData.length === 0) {
    return <div className="loading">Đang tải dữ liệu...</div>;
  }

  return (
    <div className="dashboard">
      <LoadingModal
        isOpen={dataLoading}
        message="Đang tải dữ liệu..."
        progress={0}
      />
      <div className="dashboard-header">
        <div>
          <p className="page-kicker">Thống kê</p>
          <h2>Tổng quan hoạt động</h2>
        </div>
        <button className="btn-export-dashboard" onClick={handleExport}>
          <HiArrowDownTray />
          Xuất báo cáo
        </button>
      </div>

      <div className="dashboard-filters">
        <div className="filter-group">
          <label>Tên nhân viên</label>
          <MultiSelect
            options={uniqueEmployees.map((e) => ({
              id: e.userId,
              name: e.fullName,
            }))}
            selected={selectedEmployee}
            onChange={setSelectedEmployee}
            placeholder="Chọn nhân viên..."
            itemLabel="nhân viên"
            searchPlaceholder="Tìm kiếm nhân viên..."
            enableSelectAll={true}
            selectAllLabel="Chọn tất cả"
          />
        </div>

        <div className="filter-group">
          <label>Địa bàn phụ trách</label>
          <MultiSelect
            options={territories.map((t) => ({
              id: t.Id,
              name: t.TerritoryName,
            }))}
            selected={selectedTerritories}
            onChange={setSelectedTerritories}
          />
        </div>

        <div className="filter-group">
          <label>Thời gian</label>
          <select
            value={dateFilter}
            onChange={(e) =>
              setDateFilter(e.target.value as "day" | "month" | "week")
            }
            className="filter-select"
          >
            <option value="month">Theo tháng</option>
            <option value="week">Theo tuần</option>
            <option value="day">Theo ngày</option>
          </select>
        </div>

        <div className="filter-group">
          {dateFilter === "day" ? (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="filter-input"
            />
          ) : dateFilter === "week" ? (
            <div className="week-filter-container">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="filter-input"
              />
              <select
                value={selectedWeek?.startDate || ""}
                onChange={(e) => {
                  const w = weekOptions.find(
                    (wo) => wo.startDate === e.target.value,
                  );
                  if (w) setSelectedWeek(w);
                }}
                className="filter-input week-select"
              >
                {weekOptions.map((w) => (
                  <option key={w.startDate} value={w.startDate}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="filter-input"
            />
          )}
        </div>
      </div>

      {summaryData.length > 0 && (
        <>
          <div className="chart-container">
            <Bar data={chartData} options={chartOptions} />
          </div>

          <div className="table-container">
            <table className="summary-table">
              <thead>
                <tr>
                  <th>Stt</th>
                  <th>Họ tên</th>
                  <th>Địa bàn phụ trách</th>
                  <th>Tổng số ngày checkin</th>
                  <th>Tổng số cửa hàng checkin</th>
                </tr>
              </thead>
              <tbody>
                {summaryData.map((item, index) => (
                  <tr key={`${item.UserId}-${item.TerritoryId}-${index}`}>
                    <td>{index + 1}</td>
                    <td>
                      <button
                        className="user-name-link"
                        onClick={() =>
                          navigate(
                            `/dashboard/user/${item.UserId}?territoryId=${
                              item.TerritoryId
                            }&territoryName=${encodeURIComponent(
                              item.TerritoryName || "",
                            )}`,
                          )
                        }
                      >
                        {item.FullName}
                      </button>
                    </td>
                    <td>{item.TerritoryName}</td>
                    <td>{item.TotalCheckinDays}</td>
                    <td>{item.TotalStoresChecked}</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td colSpan={3}>
                    <strong>TỔNG CỘNG</strong>
                  </td>
                  <td>
                    <strong>
                      {summaryData.reduce(
                        (sum, item) => sum + item.TotalCheckinDays,
                        0,
                      )}
                    </strong>
                  </td>
                  <td>
                    <strong>
                      {summaryData.reduce(
                        (sum, item) => sum + item.TotalStoresChecked,
                        0,
                      )}
                    </strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && summaryData.length === 0 && (
        <div className="no-data">Không có dữ liệu</div>
      )}

      <LoadingModal
        isOpen={exportLoading}
        message="Đang tạo báo cáo Excel..."
        progress={exportProgress}
      />
    </div>
  );
}

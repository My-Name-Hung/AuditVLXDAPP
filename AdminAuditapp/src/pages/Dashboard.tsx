import { useEffect, useState, useRef } from "react";
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
import api from "../services/api";
import MultiSelect from "../components/MultiSelect";
import LoadingModal from "../components/LoadingModal";
import "./Dashboard.css";

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

interface DashboardSummaryItem {
  UserId: number;
  FullName: string;
  TerritoryId: number;
  TerritoryName: string;
  TotalCheckinDays: number;
  TotalStoresChecked: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [selectedTerritories, setSelectedTerritories] = useState<number[]>([]);
  const [summaryData, setSummaryData] = useState<DashboardSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState<"day" | "month">("month");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`
  );
  const [exportLoading, setExportLoading] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const isInitialMount = useRef(true);

  useEffect(() => {
    fetchTerritories();
    fetchSummary(); // Initial load
  }, []);

  useEffect(() => {
    if (!isInitialMount.current) {
      // Filter change - show loading modal (skip initial load)
      fetchSummary(true);
    } else {
      isInitialMount.current = false;
    }
  }, [selectedTerritories, dateFilter, selectedDate, selectedMonth]);

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
      
      const params: any = {};

      if (selectedTerritories.length > 0) {
        params.territoryIds = selectedTerritories.join(",");
      }

      if (dateFilter === "day") {
        params.startDate = selectedDate;
        params.endDate = selectedDate;
      } else {
        const [year, month] = selectedMonth.split("-");
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const endDate = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
        params.startDate = startDate;
        params.endDate = endDate;
      }

      // Add timestamp to prevent caching
      const res = await api.get("/dashboard/summary", { 
        params: { ...params, _t: Date.now() }
      });
      setSummaryData(res.data.data || []);
    } catch (error) {
      console.error("Error fetching summary:", error);
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

      const params: any = {};

      if (selectedTerritories.length > 0) {
        params.territoryIds = selectedTerritories.join(",");
      }

      if (dateFilter === "day") {
        params.startDate = selectedDate;
        params.endDate = selectedDate;
      } else {
        const [year, month] = selectedMonth.split("-");
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const endDate = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
        params.startDate = startDate;
        params.endDate = endDate;
      }

      setExportProgress(20);
      const res = await api.get("/dashboard/export", { params });
      setExportProgress(50);
      await generateExcel(res.data.data, setExportProgress);
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
    data: { summary: DashboardSummaryItem[]; details: Record<number, any[]> },
    progressCallback?: (progress: number) => void
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
    summarySheet.getCell("A2").value = "BẢNG TỔNG HỢP CHECKIN CỬA HÀNG THEO THÁNG";
    summarySheet.getCell("A2").font = { bold: true, size: 12 };
    summarySheet.getCell("A2").alignment = { horizontal: "center" };

    // Headers
    summarySheet.getRow(4).values = ["Stt", "Họ tên", "Địa bàn phụ trách", "Tổng số ngày checkin", "Tổng số cửa hàng checkin"];
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

    // Detail sheets
    const totalUsers = data.summary.length;
    for (let i = 0; i < data.summary.length; i++) {
      const user = data.summary[i];
      const detailSheet = workbook.addWorksheet(`Chi tiết ${user.FullName}`);
      const userDetails = data.details[user.UserId] || [];
      
      // Update progress for each user sheet
      if (progressCallback) {
        const progress = 60 + Math.floor((i / totalUsers) * 30);
        progressCallback(progress);
      }

      // Title
      detailSheet.mergeCells("A1:F1");
      detailSheet.getCell("A1").value = "CÔNG TY CỔ PHẦN XI MĂNG TÂY ĐÔ";
      detailSheet.getCell("A1").font = { bold: true, size: 14 };
      detailSheet.getCell("A1").alignment = { horizontal: "center" };

      detailSheet.mergeCells("A2:F2");
      detailSheet.getCell("A2").value = "BẢNG TỔNG HỢP CHECKIN CỬA HÀNG THEO THÁNG";
      detailSheet.getCell("A2").font = { bold: true, size: 12 };
      detailSheet.getCell("A2").alignment = { horizontal: "center" };

      // Headers
      detailSheet.getRow(4).values = ["Ngày", "STT", "NPP/Cửa hàng", "Địa chỉ cửa hàng", "Thời Gian Checkin", "Ghi chú"];
      detailSheet.getRow(4).eachCell((cell) => {
        cell.style = headerStyle;
      });

      // Data
      userDetails.forEach((detail, index) => {
        const checkinDate = new Date(detail.CheckinDate);
        const checkinTime = detail.CheckinTime ? new Date(detail.CheckinTime) : null;
        
        detailSheet.addRow([
          checkinDate.toLocaleDateString("vi-VN"),
          index + 1,
          detail.StoreName,
          detail.Address || "",
          checkinTime ? checkinTime.toLocaleTimeString("vi-VN") : "",
          detail.Notes || "",
        ]);
      });

      // Set column widths
      detailSheet.columns = [
        { width: 15 },
        { width: 10 },
        { width: 25 },
        { width: 40 },
        { width: 20 },
        { width: 30 },
      ];
    }

    // Download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `BaoCaoCheckin_${new Date().toISOString().split("T")[0]}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const chartData = {
    labels: summaryData.map((item) => item.FullName),
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
        <button className="btn-export" onClick={handleExport}>
          Tải báo cáo
        </button>
      </div>

      <div className="dashboard-filters">
        <div className="filter-group">
          <label>Địa bàn phụ trách</label>
          <MultiSelect
            options={territories.map((t) => ({ id: t.Id, name: t.TerritoryName }))}
            selected={selectedTerritories}
            onChange={setSelectedTerritories}
          />
        </div>

        <div className="filter-group">
          <label>Thời gian</label>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as "day" | "month")}
            className="filter-select"
          >
            <option value="month">Theo tháng</option>
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
                  <tr key={item.UserId}>
                    <td>{index + 1}</td>
                    <td>
                      <button
                        className="user-name-link"
                        onClick={() => navigate(`/dashboard/user/${item.UserId}`)}
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
                  <td colSpan={3}><strong>TỔNG CỘNG</strong></td>
                  <td>
                    <strong>
                      {summaryData.reduce((sum, item) => sum + item.TotalCheckinDays, 0)}
                    </strong>
                  </td>
                  <td>
                    <strong>
                      {summaryData.reduce((sum, item) => sum + item.TotalStoresChecked, 0)}
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

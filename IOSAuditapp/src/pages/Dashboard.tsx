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
import { HiArrowDownTray } from "react-icons/hi2";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { useAuth } from "../contexts/AuthContext";
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
  const { user } = useAuth();
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
  const [exportLoading, setExportLoading] = useState(false);

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

  // Helper functions for Excel export
  const formatVND = (value: number | null): string => {
    if (value === null || value === undefined) return "";
    return value.toLocaleString("vi-VN");
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN");
  };

  // Calculate week numbers from a specific date
  const calculateWeekNumbers = (date: Date) => {
    const year = date.getFullYear();
    const day = date.getDate();

    // Week number in month (1-5): which week of the month (1-7, 8-14, 15-21, 22-28, 29+)
    const weekNumberInMonth = Math.ceil(day / 7);

    // Week number in year: calculate from January 1st
    const januaryFirst = new Date(year, 0, 1);
    const firstDayOfWeek = januaryFirst.getDay();
    const firstMondayOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    const daysSinceYearStart = Math.floor(
      (date.getTime() - januaryFirst.getTime()) / (1000 * 60 * 60 * 24)
    );

    const weekNumberInYear = Math.ceil(
      (daysSinceYearStart + firstMondayOffset + 1) / 7
    );

    return { weekNumberInMonth, weekNumberInYear, year };
  };

  // Check if a date is in a specific week
  const isDateInWeek = (
    dateString: string | null,
    weekNumber: number,
    year: number
  ): boolean => {
    if (!dateString || weekNumber === 0) return true;
    const date = new Date(dateString);

    const januaryFirst = new Date(year, 0, 1);
    const firstDayOfWeek = januaryFirst.getDay();
    const firstMondayOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    const weekStartDays = (weekNumber - 1) * 7 - firstMondayOffset;
    const weekStart = new Date(januaryFirst);
    weekStart.setDate(januaryFirst.getDate() + weekStartDays);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    return date >= weekStart && date <= weekEnd;
  };

  const handleExportExcel = async () => {
    if (!user?.id) {
      alert("Vui lòng đăng nhập để xuất báo cáo");
      return;
    }

    try {
      setExportLoading(true);
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();

      // Calculate date range based on filters
      let startDate: string;
      let endDate: string;
      let weekNumberInMonth: number = 0;
      let weekNumberInYear: number = 0;
      let year: number = selectedYear;
      let exportDateFrom: string | null = null;
      let exportMonthLabel: string | null = null;

      if (selectedWeek === 0) {
        const monthDates = getMonthDates(selectedYear, selectedMonth);
        startDate = monthDates.startDate;
        endDate = monthDates.endDate;
        exportMonthLabel = `${selectedMonth}/${selectedYear}`;
      } else {
        const weekDates = getWeekDates(
          selectedYear,
          selectedMonth,
          selectedWeek
        );
        if (weekDates.length === 0) {
          alert("Không có dữ liệu để xuất");
          setExportLoading(false);
          return;
        }
        startDate = weekDates[0];
        endDate = weekDates[weekDates.length - 1];
        const weekStart = new Date(startDate);
        const weekNumbers = calculateWeekNumbers(weekStart);
        weekNumberInMonth = weekNumbers.weekNumberInMonth || 0;
        weekNumberInYear = weekNumbers.weekNumberInYear || 0;
        year = weekNumbers.year || selectedYear;
        exportDateFrom = startDate;
      }

      // Fetch surveys with filters
      const params: Record<string, string | number> = {
        page: 1,
        pageSize: 10000,
        includeProducts: "true",
        dateFrom: startDate,
        dateTo: endDate,
        userId: user.id, // Filter by current user
      };

      if (selectedTerritory) {
        params.territoryId = selectedTerritory;
      }

      const res = await api.get("/store-surveys", { params });

      // Interface for survey data
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
        TimeToSellNewProduct?: string | null;
        NewProductImportQuantity?: string | null;
        ImportedBySalesperson?: string | null;
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
          ImportedFromNPP: string | null;
          DiscountPromotion: string | null;
          AverageStockQuantity: number | null;
        }>;
      }

      // Fetch products for each survey if not included
      const surveysWithProducts = await Promise.all(
        res.data.map(async (survey: StoreSurveyListItem) => {
          try {
            let products: StoreSurveyListItem["products"] =
              survey.products || [];

            if (!products || products.length === 0) {
              const productsRes = await api.get(
                `/store-survey-products/survey/${survey.Id}`
              );
              products = productsRes.data || [];
            }

            return { ...survey, products: products };
          } catch (error) {
            console.error(
              `Error fetching products for survey ${survey.Id}:`,
              error
            );
            return { ...survey, products: [] };
          }
        })
      );

      // Filter only XMTĐ products
      let xmtdSurveys = surveysWithProducts.filter(
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

      // Create sheets for each territory
      territoryGroups.forEach((territorySurveys, territoryName) => {
        if (!territorySurveys || territorySurveys.length === 0) {
          return;
        }

        const sanitizeSheetName = (name: string): string => {
          let sanitized = name.replace(/[\\/?:*[\]]/g, "");
          if (sanitized.length > 31) {
            sanitized = sanitized.substring(0, 31);
          }
          if (!sanitized.trim()) {
            sanitized = "Chua xac dinh";
          }
          return sanitized;
        };

        const sheetName = sanitizeSheetName(territoryName || "Chưa xác định");
        const sheet = workbook.addWorksheet(sheetName);

        sheet.addRow([]);
        sheet.addRow([]);
        sheet.addRow([]);

        // Title rows
        try {
          sheet.mergeCells("A1:O1");
        } catch (e) {
          console.warn("Error merging A1:O1:", e);
        }
        const mainTitle =
          selectedWeek === 0
            ? "BÁO CÁO THĂM CỬA HÀNG"
            : `BÁO CÁO THĂM CỬA HÀNG TUẦN ${weekNumberInMonth || ""}`;
        sheet.getCell("A1").value = mainTitle || "";
        sheet.getCell("A1").font = { bold: true, size: 14 };
        sheet.getCell("A1").alignment = { horizontal: "center" };

        try {
          sheet.mergeCells("A2:O2");
        } catch (e) {
          console.warn("Error merging A2:O2:", e);
        }
        sheet.getCell("A2").value = `Địa bàn: ${
          territoryName || "Chưa xác định"
        }`;
        sheet.getCell("A2").font = { bold: true, size: 12 };
        sheet.getCell("A2").alignment = { horizontal: "center" };

        try {
          sheet.mergeCells("A3:O3");
        } catch (e) {
          console.warn("Error merging A3:O3:", e);
        }
        let reportTitle = "";
        if (selectedWeek === 0) {
          reportTitle = `1. BÁO CÁO THỰC TẾ THĂM CỬA HÀNG THÁNG ${exportMonthLabel}`;
        } else {
          reportTitle = `1. BÁO CÁO THỰC TẾ THĂM CỬA HÀNG TUẦN ${
            weekNumberInYear || ""
          }/${year}`;
        }
        sheet.getCell("A3").value = reportTitle || "";
        sheet.getCell("A3").font = { bold: true, size: 12 };
        sheet.getCell("A3").alignment = { horizontal: "left" };

        // Table 1 headers
        const headers = [
          "Stt",
          "Tên Cửa hàng",
          "Ngày thăm",
          "Tên + SDT",
          "Tên sản phẩm",
          "Loại XM",
          "Giá mua",
          "Giá bán",
          "Phí VC đường bộ",
          "Phí VC đường thủy",
          "Sản lượng bình quân (tấn/tháng)",
          "Nhập từ NPP",
          "Chương trình chiết khấu - khuyến mãi",
          "Ý kiến/Ghi chú",
        ];

        sheet.getRow(5).values = headers;
        sheet.getRow(5).height = 40;
        sheet.getRow(5).eachCell((cell) => {
          cell.style = {
            ...headerStyle,
            alignment: {
              ...headerStyle.alignment,
              wrapText: true,
            },
          };
        });

        // Data rows - Group by store
        let sttCounter = 1;
        const storeGroups = new Map<number, StoreSurveyListItem[]>();
        territorySurveys.forEach((survey) => {
          if (!storeGroups.has(survey.StoreId)) {
            storeGroups.set(survey.StoreId, []);
          }
          storeGroups.get(survey.StoreId)!.push(survey);
        });

        storeGroups.forEach((storeSurveys) => {
          const sortedSurveys = [...storeSurveys].sort((a, b) => {
            const dateA = a.AuditDate ? new Date(a.AuditDate).getTime() : 0;
            const dateB = b.AuditDate ? new Date(b.AuditDate).getTime() : 0;
            return dateA - dateB;
          });

          const hasProducts = sortedSurveys.some(
            (survey) =>
              survey.products &&
              Array.isArray(survey.products) &&
              survey.products.length > 0
          );

          if (!hasProducts) {
            return;
          }

          let isFirstRow = true;
          let totalAverageStockQuantity = 0;
          const storeName = sortedSurveys[0]?.StoreName || "";

          sortedSurveys.forEach((survey) => {
            if (
              survey.products &&
              Array.isArray(survey.products) &&
              survey.products.length > 0
            ) {
              survey.products.forEach((product) => {
                if (!product) return;

                const purchasePrice = product.PurchasePrice || 0;
                const sellingPrice = product.SellingPrice || 0;
                const roadTransportFee = product.RoadTransportFee || 0;
                const waterTransportFee = product.WaterTransportFee || 0;
                const averageStockQuantity = product.AverageStockQuantity || 0;

                totalAverageStockQuantity += averageStockQuantity;

                try {
                  const row = sheet.addRow([
                    isFirstRow ? sttCounter : "",
                    storeName || "",
                    formatDate(survey.AuditDate) || "",
                    (product.ContactPersonPhone || "").toString(),
                    (product.ProductType || "").toString(),
                    (product.CementProductName || "").toString(),
                    formatVND(purchasePrice) || "",
                    formatVND(sellingPrice) || "",
                    formatVND(roadTransportFee) || "",
                    formatVND(waterTransportFee) || "",
                    (averageStockQuantity || "").toString(),
                    (product.ImportedFromNPP || "").toString(),
                    (product.DiscountPromotion || "").toString(),
                    isFirstRow ? (survey.StoreComment || "").toString() : "",
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
                } catch (error) {
                  console.error("Error adding row for product:", error);
                }
              });
            }
          });

          if (!isFirstRow) {
            try {
              const summaryRow = sheet.addRow([
                "",
                "",
                "",
                "",
                "",
                "TỔNG CỘNG",
                "",
                "",
                "",
                "",
                (totalAverageStockQuantity || "").toString(),
                "",
                "",
                "",
              ]);

              summaryRow.eachCell((cell) => {
                cell.border = {
                  top: { style: "thin" },
                  bottom: { style: "thin" },
                  left: { style: "thin" },
                  right: { style: "thin" },
                };
                cell.alignment = { vertical: "middle" };
              });

              summaryRow.getCell(6).font = { bold: true };
              summaryRow.getCell(11).font = { bold: true };
              summaryRow.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFF0F7FF" },
              };
            } catch (error) {
              console.error("Error adding summary row:", error);
            }
          }

          sttCounter++;
        });

        // Column widths
        sheet.columns = [
          { width: 8 },
          { width: 25 },
          { width: 12 },
          { width: 20 },
          { width: 18 },
          { width: 20 },
          { width: 12 },
          { width: 12 },
          { width: 15 },
          { width: 15 },
          { width: 20 },
          { width: 18 },
          { width: 25 },
          { width: 30 },
          { width: 30 },
        ];

        // Add spacing between tables
        sheet.addRow([]);
        sheet.addRow([]);

        // Table 2: Khảo sát sản phẩm XMTĐ
        const title2Surveys = territorySurveys.filter((survey) => {
          const weekMatch =
            selectedWeek === 0
              ? true
              : isDateInWeek(survey.AuditDate, selectedWeek, selectedYear);
          return (
            weekMatch &&
            (survey.WhyNotSellNewProduct ||
              survey.TimeToSellNewProduct ||
              survey.NewProductImportQuantity ||
              survey.SupplierName ||
              survey.ImportedBySalesperson ||
              survey.StoreComment)
          );
        });

        if (title2Surveys.length > 0) {
          const title2Row = sheet.rowCount + 1;
          try {
            sheet.mergeCells(`A${title2Row}:I${title2Row}`);
          } catch (e) {
            console.warn(`Error merging A${title2Row}:I${title2Row}:`, e);
          }
          sheet.getCell(`A${title2Row}`).value = `2. KHẢO SÁT SẢN PHẨM XMTĐ`;
          sheet.getCell(`A${title2Row}`).font = { bold: true, size: 12 };
          sheet.getCell(`A${title2Row}`).alignment = { horizontal: "left" };

          const headers2 = [
            "Stt",
            "Tên Cửa hàng",
            "Ngày thăm",
            "Tại sao không bán sản phẩm mới",
            "Thời gian để bán sản phẩm mới",
            "Tên sản phẩm muốn nhập – Số lượng",
            "Mua qua NPP",
            "Nhập bởi thương vụ",
            "Ý kiến/Ghi chú",
          ];

          const headerRow2 = sheet.addRow(headers2);
          headerRow2.height = 40;
          headerRow2.eachCell((cell) => {
            cell.style = {
              ...headerStyle,
              alignment: {
                ...headerStyle.alignment,
                wrapText: true,
              },
            };
          });

          let sttCounter2 = 1;
          title2Surveys.forEach((survey) => {
            const row2 = sheet.addRow([
              sttCounter2,
              (survey.StoreName || "").toString(),
              formatDate(survey.AuditDate) || "",
              (survey.WhyNotSellNewProduct || "").toString(),
              survey.TimeToSellNewProduct
                ? formatDate(survey.TimeToSellNewProduct) || ""
                : "",
              (survey.NewProductImportQuantity || "").toString(),
              (survey.SupplierName || "").toString(),
              (survey.ImportedBySalesperson || "").toString(),
              (survey.StoreComment || "").toString(),
            ]);

            row2.eachCell((cell) => {
              cell.border = {
                top: { style: "thin" },
                bottom: { style: "thin" },
                left: { style: "thin" },
                right: { style: "thin" },
              };
              cell.alignment = { vertical: "middle", wrapText: true };
            });
            sttCounter2++;
          });
        }
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
        <button
          className="btn-export-report"
          onClick={handleExportExcel}
          disabled={exportLoading || !user?.id}
          style={{
            backgroundColor: "#3D805F",
            color: "white",
            border: "none",
            padding: "8px 16px",
            borderRadius: "6px",
            cursor: exportLoading || !user?.id ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "14px",
            fontWeight: "500",
            opacity: exportLoading || !user?.id ? 0.6 : 1,
          }}
        >
          <HiArrowDownTray size={18} />
          {exportLoading ? "Đang xuất..." : "Tải báo cáo"}
        </button>
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
                          <span
                            style={{
                              color: colors.primary,
                              textDecoration: "underline",
                              cursor: "pointer",
                            }}
                            onClick={() => {
                              navigate(
                                `/territory-detail/${
                                  item.TerritoryId
                                }?territoryName=${encodeURIComponent(
                                  item.TerritoryName
                                )}`
                              );
                            }}
                          >
                            {item.TerritoryName}
                          </span>
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

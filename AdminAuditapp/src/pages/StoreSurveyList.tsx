import { useEffect, useState } from "react";
import { HiEye } from "react-icons/hi";
import { HiArrowDownTray } from "react-icons/hi2";
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

interface Territory {
  Id: number;
  TerritoryName: string;
}

export default function StoreSurveyList() {
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState<StoreSurveyListItem[]>([]);
  const [allSurveys, setAllSurveys] = useState<StoreSurveyListItem[]>([]); // Store all surveys for client-side filtering
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);

  // Users and Cement Products for filters
  const [users, setUsers] = useState<User[]>([]);
  const [cementProducts, setCementProducts] = useState<CementProduct[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [cementSearch, setCementSearch] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showCementDropdown, setShowCementDropdown] = useState(false);

  // Filter states
  const [filters, setFilters] = useState({
    storeName: "",
    userName: "",
    cementProductName: "",
    territoryName: "",
    priceFrom: "",
    priceTo: "",
  });

  // Week filter state
  const [selectedWeek, setSelectedWeek] = useState<string>("all");
  const [currentYear, setCurrentYear] = useState<number>(
    new Date().getFullYear()
  );

  useEffect(() => {
    fetchSurveys();
    fetchUsers();
    fetchCementProducts();
    fetchTerritories();
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
    } catch (error) {
      console.error("Error fetching territories:", error);
      setTerritories([]);
    }
  };

  const fetchSurveys = async () => {
    await fetchSurveysWithFilters(filters);
  };

  // Client-side filtering function
  const filterSurveys = (
    surveysToFilter: StoreSurveyListItem[],
    filterValues: typeof filters = filters
  ) => {
    return surveysToFilter.filter((survey) => {
      // Filter by week
      if (selectedWeek !== "all") {
        const weekNumber = parseInt(selectedWeek, 10);
        if (!isDateInWeek(survey.AuditDate, weekNumber, currentYear)) {
          return false;
        }
      }
      // Filter by store name
      if (
        filterValues.storeName &&
        !survey.StoreName?.toLowerCase().includes(
          filterValues.storeName.toLowerCase()
        )
      ) {
        return false;
      }

      // Filter by user name
      if (
        filterValues.userName &&
        !survey.UserFullName?.toLowerCase().includes(
          filterValues.userName.toLowerCase()
        ) &&
        !survey.UserCode?.toLowerCase().includes(
          filterValues.userName.toLowerCase()
        )
      ) {
        return false;
      }

      // Filter by cement product name (check in products)
      if (filterValues.cementProductName) {
        const hasMatchingProduct = survey.products?.some(
          (product) =>
            product.CementProductName?.toLowerCase().includes(
              filterValues.cementProductName.toLowerCase()
            ) ||
            product.CementProductCode?.toLowerCase().includes(
              filterValues.cementProductName.toLowerCase()
            )
        );
        if (!hasMatchingProduct) {
          return false;
        }
      }

      // Filter by territory name
      if (
        filterValues.territoryName &&
        !survey.TerritoryName?.toLowerCase().includes(
          filterValues.territoryName.toLowerCase()
        )
      ) {
        return false;
      }

      // Filter by price range (check in products)
      if (filterValues.priceFrom || filterValues.priceTo) {
        const priceFromValue = filterValues.priceFrom
          ? parseFloat(filterValues.priceFrom.replace(/[^\d]/g, ""))
          : null;
        const priceToValue = filterValues.priceTo
          ? parseFloat(filterValues.priceTo.replace(/[^\d]/g, ""))
          : null;

        const hasMatchingPrice = survey.products?.some((product) => {
          const sellingPrice = product.SellingPrice || 0;
          const purchasePrice = product.PurchasePrice || 0;
          const price = sellingPrice || purchasePrice;

          if (priceFromValue !== null && price < priceFromValue) {
            return false;
          }
          if (priceToValue !== null && price > priceToValue) {
            return false;
          }
          return true;
        });

        // Also check survey-level prices if no products
        if (
          !hasMatchingPrice &&
          (!survey.products || survey.products.length === 0)
        ) {
          const surveyPrice =
            survey.NewProductSellingPrice || survey.SellingPrice || 0;
          if (priceFromValue !== null && surveyPrice < priceFromValue) {
            return false;
          }
          if (priceToValue !== null && surveyPrice > priceToValue) {
            return false;
          }
        } else if (!hasMatchingPrice) {
          return false;
        }
      }

      return true;
    });
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleApplyFilters = () => {
    // Apply client-side filters to already fetched data
    const filtered = filterSurveys(allSurveys);
    setSurveys(filtered);
  };

  // Apply filters when filters or selectedWeek change (if data is already loaded)
  useEffect(() => {
    if (allSurveys.length > 0) {
      const filtered = filterSurveys(allSurveys, filters);
      setSurveys(filtered);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, allSurveys, selectedWeek, currentYear]);

  const handleResetFilters = () => {
    const emptyFilters = {
      storeName: "",
      userName: "",
      cementProductName: "",
      territoryName: "",
      priceFrom: "",
      priceTo: "",
    };
    setFilters(emptyFilters);
    setUserSearch("");
    setCementSearch("");
    setSelectedWeek("all");
    // Fetch with empty filters immediately
    fetchSurveysWithFilters(emptyFilters);
  };

  const fetchSurveysWithFilters = async (filterValues: typeof filters) => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = {
        page: 1,
        pageSize: 1000,
      };

      if (filterValues.storeName) params.storeName = filterValues.storeName;
      if (filterValues.userName) params.userName = filterValues.userName;
      if (filterValues.cementProductName)
        params.cementProductName = filterValues.cementProductName;
      if (filterValues.territoryName)
        params.territoryName = filterValues.territoryName;
      if (filterValues.priceFrom) {
        const priceFromValue = filterValues.priceFrom.replace(/[^\d]/g, "");
        if (priceFromValue) params.priceFrom = priceFromValue;
      }
      if (filterValues.priceTo) {
        const priceToValue = filterValues.priceTo.replace(/[^\d]/g, "");
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

      setAllSurveys(surveysWithProducts);
      // Apply client-side filters
      const filtered = filterSurveys(surveysWithProducts, filterValues);
      setSurveys(filtered);
    } catch (error) {
      console.error("Error fetching surveys:", error);
    } finally {
      setLoading(false);
    }
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
  const filteredUsers = users.filter(
    (user) =>
      user.FullName.toLowerCase().includes(userSearch.toLowerCase()) ||
      user.UserCode.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredCementProducts = cementProducts.filter(
    (product) =>
      product.Name.toLowerCase().includes(cementSearch.toLowerCase()) ||
      product.Code.toLowerCase().includes(cementSearch.toLowerCase())
  );

  // Helper function to calculate week numbers from a specific date
  const calculateWeekNumbers = (date: Date) => {
    const year = date.getFullYear();
    const day = date.getDate();

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
      (date.getTime() - januaryFirst.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate week number: (days + offset to first Monday) / 7, rounded up
    const weekNumberInYear = Math.ceil(
      (daysSinceYearStart + firstMondayOffset + 1) / 7
    );

    return { weekNumberInMonth, weekNumberInYear, year };
  };

  // Helper function to get all weeks in the current year
  const getWeeksInYear = (
    year: number
  ): Array<{ value: string; label: string }> => {
    const weeks: Array<{ value: string; label: string }> = [];

    // Get the first day of the year
    const januaryFirst = new Date(year, 0, 1);
    const firstDayOfWeek = januaryFirst.getDay();
    const firstMondayOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    // Get the last day of the year
    const decemberLast = new Date(year, 11, 31);
    const daysInYear =
      Math.floor(
        (decemberLast.getTime() - januaryFirst.getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1;

    // Calculate total weeks
    const totalWeeks = Math.ceil((daysInYear + firstMondayOffset) / 7);

    for (let week = 1; week <= totalWeeks; week++) {
      // Calculate week start date (Monday)
      const weekStartDays = (week - 1) * 7 - firstMondayOffset;
      const weekStart = new Date(januaryFirst);
      weekStart.setDate(januaryFirst.getDate() + weekStartDays);

      // Calculate week end date (Sunday)
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const startDateStr = weekStart.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
      });
      const endDateStr = weekEnd.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
      });

      weeks.push({
        value: week.toString(),
        label: `Tuần ${week} (${startDateStr} - ${endDateStr})`,
      });
    }

    return weeks;
  };

  // Helper function to check if a date is in a specific week
  const isDateInWeek = (
    dateString: string | null,
    weekNumber: number,
    year: number
  ): boolean => {
    if (!dateString || weekNumber === 0) return true; // "all" weeks
    const date = new Date(dateString);

    // Get the first day of the year
    const januaryFirst = new Date(year, 0, 1);
    const firstDayOfWeek = januaryFirst.getDay();
    const firstMondayOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    // Calculate week start date (Monday)
    const weekStartDays = (weekNumber - 1) * 7 - firstMondayOffset;
    const weekStart = new Date(januaryFirst);
    weekStart.setDate(januaryFirst.getDate() + weekStartDays);
    weekStart.setHours(0, 0, 0, 0);

    // Calculate week end date (Sunday)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Check if date is within the week
    return date >= weekStart && date <= weekEnd;
  };

  // Get weeks list for current year
  const weeksList = getWeeksInYear(currentYear);

  // Reset week filter when year changes
  useEffect(() => {
    const checkYear = () => {
      const now = new Date();
      const year = now.getFullYear();
      if (year !== currentYear) {
        setCurrentYear(year);
        setSelectedWeek("all");
      }
    };

    // Check on mount and set interval to check daily
    checkYear();
    const interval = setInterval(checkYear, 24 * 60 * 60 * 1000); // Check every 24 hours

    return () => clearInterval(interval);
  }, [currentYear]);

  const handleExportExcel = async () => {
    try {
      setExportLoading(true);
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();

      // Calculate week number from selected week or current date
      let weekNumberInMonth: number;
      let weekNumberInYear: number;
      let year: number;

      if (selectedWeek !== "all") {
        // Use selected week
        const weekNumber = parseInt(selectedWeek, 10);
        // Find a date in the selected week to calculate week numbers
        const januaryFirst = new Date(currentYear, 0, 1);
        const firstDayOfWeek = januaryFirst.getDay();
        const firstMondayOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
        const weekStartDays = (weekNumber - 1) * 7 - firstMondayOffset;
        const weekStart = new Date(januaryFirst);
        weekStart.setDate(januaryFirst.getDate() + weekStartDays);

        const weekNumbers = calculateWeekNumbers(weekStart);
        weekNumberInMonth = weekNumbers.weekNumberInMonth;
        weekNumberInYear = weekNumbers.weekNumberInYear;
        year = weekNumbers.year;
      } else {
        // Use current date for year
        year = currentYear;
        weekNumberInMonth = 0; // Not used when "all"
        weekNumberInYear = 0; // Not used when "all"
      }

      // When selectedWeek === "all", fetch all data without week filter
      // When selectedWeek !== "all", use surveys (already filtered by week)
      let surveysToExport: StoreSurveyListItem[];

      if (selectedWeek === "all") {
        // Fetch all surveys without week filter for export
        // This ensures we get all data from all weeks, not just current week
        const params: Record<string, string | number> = {
          page: 1,
          pageSize: 10000, // Large page size to get all data
        };

        if (filters.storeName) params.storeName = filters.storeName;
        if (filters.userName) params.userName = filters.userName;
        if (filters.cementProductName)
          params.cementProductName = filters.cementProductName;
        if (filters.territoryName) params.territoryName = filters.territoryName;
        if (filters.priceFrom) {
          const priceFromValue = filters.priceFrom.replace(/[^\d]/g, "");
          if (priceFromValue) params.priceFrom = priceFromValue;
        }
        if (filters.priceTo) {
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

        surveysToExport = surveysWithProducts;
      } else {
        surveysToExport = surveys;
      }

      // Filter only XMTĐ products (Title 2 + 3)
      const xmtdSurveys = surveysToExport.filter(
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

      // Create sheets for each territory (gộp 2 bảng vào 1 sheet)
      territoryGroups.forEach((territorySurveys, territoryName) => {
        // Single sheet with both tables
        const sheet = workbook.addWorksheet(
          `${territoryName || "Chưa xác định"}`
        );

        // Title rows
        sheet.mergeCells("A1:O1");
        const mainTitle =
          selectedWeek === "all"
            ? "BÁO CÁO THĂM CỬA HÀNG"
            : `BÁO CÁO THĂM CỬA HÀNG TUẦN ${weekNumberInMonth}`;
        sheet.getCell("A1").value = mainTitle;
        sheet.getCell("A1").font = { bold: true, size: 14 };
        sheet.getCell("A1").alignment = { horizontal: "center" };

        sheet.mergeCells("A2:O2");
        sheet.getCell("A2").value = `Địa bàn: ${
          territoryName || "Chưa xác định"
        }`;
        sheet.getCell("A2").font = { bold: true, size: 12 };
        sheet.getCell("A2").alignment = { horizontal: "center" };

        sheet.mergeCells("A3:O3");
        const reportTitle =
          selectedWeek === "all"
            ? `1. BÁO CÁO THỰC TẾ THĂM CỬA HÀNG NĂM ${year}`
            : `1. BÁO CÁO THỰC TẾ THĂM CỬA HÀNG TUẦN ${weekNumberInYear}/${year}`;
        sheet.getCell("A3").value = reportTitle;
        sheet.getCell("A3").font = { bold: true, size: 12 };
        sheet.getCell("A3").alignment = { horizontal: "left" };

        // Table headers
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
          "SL nhập hàng bình quân (tấn/tháng)",
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
          // Sort surveys by AuditDate to ensure consistent ordering
          const sortedSurveys = [...storeSurveys].sort((a, b) => {
            const dateA = a.AuditDate ? new Date(a.AuditDate).getTime() : 0;
            const dateB = b.AuditDate ? new Date(b.AuditDate).getTime() : 0;
            return dateA - dateB;
          });

          let isFirstRow = true;
          let totalPurchasePrice = 0;
          let totalSellingPrice = 0;
          let totalRoadTransportFee = 0;
          let totalWaterTransportFee = 0;
          let totalQuantityReceived = 0;
          let totalAverageStockQuantity = 0;
          const storeName = sortedSurveys[0]?.StoreName || "";

          // Show products from Title 3 - iterate through ALL surveys for this store
          sortedSurveys.forEach((survey) => {
            if (survey.products && survey.products.length > 0) {
              survey.products.forEach((product) => {
                totalPurchasePrice += product.PurchasePrice || 0;
                totalSellingPrice += product.SellingPrice || 0;
                totalRoadTransportFee += product.RoadTransportFee || 0;
                totalWaterTransportFee += product.WaterTransportFee || 0;
                totalQuantityReceived += product.QuantityReceived || 0;
                totalAverageStockQuantity += product.AverageStockQuantity || 0;

                const row = sheet.addRow([
                  isFirstRow ? sttCounter : "",
                  storeName,
                  formatDate(survey.AuditDate),
                  product.ContactPersonPhone || "",
                  product.ProductType || "",
                  product.CementProductName || "",
                  formatVND(product.PurchasePrice),
                  formatVND(product.SellingPrice),
                  formatVND(product.RoadTransportFee),
                  formatVND(product.WaterTransportFee),
                  product.QuantityReceived || "",
                  product.AverageStockQuantity || "",
                  product.ImportedFromNPP || "",
                  product.DiscountPromotion || "",
                  isFirstRow ? survey.StoreComment || "" : "",
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
          });

          // Add summary row only if there are products
          if (!isFirstRow) {
            const summaryRow = sheet.addRow([
              "",
              "",
              "",
              "",
              "",
              `Tổng sản lượng bình quân của cửa hàng: ${storeName}`,
              formatVND(totalPurchasePrice),
              formatVND(totalSellingPrice),
              formatVND(totalRoadTransportFee),
              formatVND(totalWaterTransportFee),
              totalQuantityReceived,
              totalAverageStockQuantity,
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

            // Style summary row
            summaryRow.getCell(6).font = { bold: true };
            summaryRow.getCell(7).font = { bold: true };
            summaryRow.getCell(8).font = { bold: true };
            summaryRow.getCell(9).font = { bold: true };
            summaryRow.getCell(10).font = { bold: true };
            summaryRow.getCell(11).font = { bold: true };
            summaryRow.getCell(12).font = { bold: true };
            summaryRow.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF0F7FF" },
            };
          }

          sttCounter++;
        });

        // Column widths for Title 3 table
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

        // Table 2: Khảo sát sản phẩm XMTĐ (Title 2) - Below Title 3
        // Filter by selected week to match the week number in the title
        const title2Surveys = territorySurveys.filter((survey) => {
          const weekMatch =
            selectedWeek === "all"
              ? true
              : isDateInWeek(
                  survey.AuditDate,
                  parseInt(selectedWeek, 10),
                  currentYear
                );
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
          // Title for Table 2
          const title2Row = sheet.rowCount + 1;
          sheet.mergeCells(`A${title2Row}:I${title2Row}`);
          sheet.getCell(`A${title2Row}`).value = `2. KHẢO SÁT SẢN PHẨM XMTĐ`;
          sheet.getCell(`A${title2Row}`).font = { bold: true, size: 12 };
          sheet.getCell(`A${title2Row}`).alignment = { horizontal: "left" };

          // Table headers for Title 2
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

          // Data rows for Title 2
          let sttCounter2 = 1;
          title2Surveys.forEach((survey) => {
            const row2 = sheet.addRow([
              sttCounter2,
              survey.StoreName || "",
              formatDate(survey.AuditDate),
              survey.WhyNotSellNewProduct || "",
              survey.TimeToSellNewProduct
                ? formatDate(survey.TimeToSellNewProduct)
                : "",
              survey.NewProductImportQuantity || "",
              survey.SupplierName || "",
              survey.ImportedBySalesperson || "",
              survey.StoreComment || "",
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

  if (loading) {
    return <div className="loading">Đang tải dữ liệu...</div>;
  }

  return (
    <div className="store-survey-list">
      <div className="store-survey-list-header">
        <h1>Danh sách khảo sát</h1>
        <button
          className="btn-export-survey"
          onClick={handleExportExcel}
          disabled={exportLoading}
        >
          <HiArrowDownTray />
          {exportLoading ? "Đang xuất..." : "Xuất Excel"}
        </button>
      </div>

      {/* Filter Section */}
      <div className="filter-section">
        <h3>Bộ lọc</h3>
        <div className="filter-grid">
          <div className="filter-item">
            <label>Tuần:</label>
            <select
              value={selectedWeek}
              onChange={(e) => {
                setSelectedWeek(e.target.value);
              }}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontSize: "14px",
                backgroundColor: "#fff",
                cursor: "pointer",
                height: "40px",
              }}
            >
              <option value="all">Tất cả tuần</option>
              {weeksList.map((week) => (
                <option key={week.value} value={week.value}>
                  {week.label}
                </option>
              ))}
            </select>
          </div>
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
            <label>Địa bàn:</label>
            <select
              value={filters.territoryName || ""}
              onChange={(e) =>
                handleFilterChange("territoryName", e.target.value)
              }
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontSize: "14px",
                backgroundColor: "#fff",
                cursor: "pointer",
              }}
            >
              <option value="">Tất cả</option>
              {territories.map((territory) => (
                <option key={territory.Id} value={territory.TerritoryName}>
                  {territory.TerritoryName}
                </option>
              ))}
            </select>
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

      {/* Tables - Chỉ hiển thị Thông tin bán hàng */}
      {/* Thông tin bán hàng (Title 3) */}
      {surveys.filter((survey) => survey.products && survey.products.length > 0)
        .length > 0 && (
        <div className="table-container">
          <h3 className="table-section-title">Thông tin bán hàng</h3>
          <table className="survey-list-table">
            <thead>
              <tr>
                <th>Stt</th>
                <th>Tên cửa hàng</th>
                <th>Ngày thăm</th>
                <th>Người tiếp xúc</th>
                <th>Tên sản phẩm</th>
                <th>Loại XM</th>
                <th>Giá mua</th>
                <th>Giá bán</th>
                <th>Sản lượng bình quân (tấn/tháng)</th>
                <th>Mua qua NPP</th>
                <th>Chương trình chiết khấu - khuyến mãi</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const allItems = surveys
                  .filter(
                    (survey) => survey.products && survey.products.length > 0
                  )
                  .flatMap((survey) =>
                    survey.products.map((product, productIndex) => ({
                      survey,
                      product,
                      productIndex,
                    }))
                  );

                // Group items by store
                const storeGroups = new Map<
                  number,
                  Array<{
                    survey: StoreSurveyListItem;
                    product: StoreSurveyListItem["products"][0];
                    productIndex: number;
                  }>
                >();

                allItems.forEach((item) => {
                  const { survey } = item;
                  if (!storeGroups.has(survey.StoreId)) {
                    storeGroups.set(survey.StoreId, []);
                  }
                  storeGroups.get(survey.StoreId)!.push(item);
                });

                // Render rows grouped by store
                let globalIndex = 0;
                const rows: React.ReactElement[] = [];

                storeGroups.forEach((items, storeId) => {
                  const firstItem = items[0];
                  const storeName = firstItem.survey.StoreName || "-";

                  // Calculate totals for this store
                  let totalPurchasePrice = 0;
                  let totalSellingPrice = 0;
                  let totalAverageStockQuantity = 0;

                  // Add product rows for this store
                  items.forEach((item) => {
                    const { survey, product } = item;
                    totalPurchasePrice += product?.PurchasePrice || 0;
                    totalSellingPrice += product?.SellingPrice || 0;
                    totalAverageStockQuantity +=
                      product?.AverageStockQuantity || 0;

                    globalIndex++;
                    rows.push(
                      <tr key={`${survey.Id}-${product.Id}-${globalIndex}`}>
                        <td>{globalIndex}</td>
                        <td>{survey.StoreName || "-"}</td>
                        <td>{formatDate(survey.AuditDate) || "-"}</td>
                        <td>{product?.ContactPersonPhone || "-"}</td>
                        <td>{product?.ProductType || "-"}</td>
                        <td>{product?.CementProductName || "-"}</td>
                        <td>
                          {formatVND(product?.PurchasePrice || null) || "-"}
                        </td>
                        <td>
                          {formatVND(product?.SellingPrice || null) || "-"}
                        </td>
                        <td>{product?.AverageStockQuantity ?? "-"}</td>
                        <td>{product?.ImportedFromNPP || "-"}</td>
                        <td>{product?.DiscountPromotion || "-"}</td>
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
                  });

                  // Add summary row for this store
                  rows.push(
                    <tr
                      key={`total-${storeId}`}
                      className="summary-row"
                      style={{
                        backgroundColor: "#f0f7ff",
                        fontWeight: "bold",
                      }}
                    >
                      <td colSpan={6} style={{ textAlign: "right" }}>
                        Tổng sản lượng bình quân của cửa hàng: {storeName}
                      </td>
                      <td>{formatVND(totalPurchasePrice)}</td>
                      <td>{formatVND(totalSellingPrice)}</td>
                      <td>{totalAverageStockQuantity}</td>
                      <td colSpan={2}></td>
                    </tr>
                  );
                });

                return <>{rows}</>;
              })()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

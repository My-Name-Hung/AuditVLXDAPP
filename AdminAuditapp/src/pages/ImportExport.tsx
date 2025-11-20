import { useEffect, useRef, useState } from "react";
import {
  HiArrowDownTray,
  HiArrowUpTray,
  HiDocumentText,
} from "react-icons/hi2";
import LoadingModal from "../components/LoadingModal";
import NotificationModal from "../components/NotificationModal";
import api from "../services/api";
import "./ImportExport.css";

interface ImportHistory {
  Id: number;
  Type: string;
  Total: number;
  SuccessCount: number;
  ErrorCount: number;
  UserFullName: string;
  UserCode: string;
  CreatedAt: string;
}

interface ImportResult {
  success: Array<{
    row: number;
    storeName?: string;
    storeCode?: string;
    link?: string;
    username?: string;
    userCode?: string;
    fullName?: string;
  }>;
  errors: Array<{
    row: number;
    storeName?: string;
    username?: string;
    error: string;
  }>;
  total: number;
  successCount: number;
  errorCount: number;
}

interface Store {
  Id: number;
  StoreCode: string;
  StoreName: string;
  Address: string;
  Phone: string;
  Email: string;
  Status: string;
  Rank: number | null;
  TaxCode: string | null;
  PartnerName: string | null;
  TerritoryName: string | null;
  UserFullName: string | null;
  UserCode: string | null;
  Latitude: number | null;
  Longitude: number | null;
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
  AuditId: number;
  StoreName: string;
  Address: string;
  CheckinTime: string | null;
  Notes: string | null;
}

type TabType = "import-stores" | "import-users" | "export-reports";

export default function ImportExport() {
  const [activeTab, setActiveTab] = useState<TabType>("import-stores");
  const [storesFile, setStoresFile] = useState<File | null>(null);
  const [usersFile, setUsersFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [storesHistory, setStoresHistory] = useState<ImportHistory[]>([]);
  const [usersHistory, setUsersHistory] = useState<ImportHistory[]>([]);
  const [importResults, setImportResults] = useState<ImportResult | null>(null);
  const [notification, setNotification] = useState<{
    isOpen: boolean;
    type: "success" | "error";
    message: string;
  }>({
    isOpen: false,
    type: "success",
    message: "",
  });
  const storesFileInputRef = useRef<HTMLInputElement>(null);
  const usersFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchImportHistory("stores");
    fetchImportHistory("users");
  }, []);

  const fetchImportHistory = async (type: string) => {
    try {
      const res = await api.get("/import/history", { params: { type } });
      if (type === "stores") {
        setStoresHistory(res.data || []);
      } else {
        setUsersHistory(res.data || []);
      }
    } catch (error) {
      console.error("Error fetching import history:", error);
    }
  };

  const downloadTemplate = async (type: "stores" | "users") => {
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Template");

      if (type === "stores") {
        // Template for stores
        sheet.getRow(1).values = [
          "Tên cửa hàng",
          "Địa chỉ",
          "Số điện thoại",
          "Email",
          "Cấp cửa hàng (1 hoặc 2)",
          "Mã số thuế",
          "Tên đối tác",
          "Địa bàn phụ trách",
          "User phụ trách (có thể nhiều, phân cách bằng dấu phẩy: User1, User2, User3)",
          "Ghi chú",
        ];

        // Add sample data row
        sheet.getRow(2).values = [
          "Cửa hàng mẫu",
          "123 Đường ABC, Quận XYZ",
          "0123456789",
          "store@example.com",
          1,
          "1234567890",
          "Đối tác ABC",
          "TPHCM",
          "U000001, U000002, username3",
          "Bắt buộc địa bàn phụ trách phải đúng. User phụ trách: có thể nhập 1 hoặc nhiều users phân cách bằng dấu phẩy. User đầu tiên là user chính. Có thể dùng UserCode (U000001), Username (username1) hoặc FullName (Nguyễn Văn A)",
        ];
      } else {
        // Template for users
        sheet.getRow(1).values = [
          "Tên đăng nhập",
          "Tên nhân viên",
          "Email",
          "Số điện thoại",
          "Vai trò (admin hoặc sales)",
          "Chức vụ",
        ];

        // Add sample data row
        sheet.getRow(2).values = [
          "username1",
          "Nguyễn Văn A",
          "user@example.com",
          "0123456789",
          "sales",
          "Nhân viên Thị Trường",
        ];
      }

      // Style header
      sheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF0138C3" },
        };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      // Set column widths
      if (type === "stores") {
        sheet.columns = [
          { width: 30 },
          { width: 40 },
          { width: 15 },
          { width: 25 },
          { width: 20 },
          { width: 15 },
          { width: 30 },
          { width: 20 },
          { width: 30 },
          { width: 40 },
        ];
      } else {
        sheet.columns = [
          { width: 20 },
          { width: 30 },
          { width: 30 },
          { width: 15 },
          { width: 20 },
          { width: 25 },
        ];
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Template_${type === "stores" ? "CuaHang" : "NhanVien"}_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error generating template:", error);
      setNotification({
        isOpen: true,
        type: "error",
        message: "Lỗi khi tạo template Excel",
      });
    }
  };

  const handleImportStores = async () => {
    if (!storesFile) {
      setNotification({
        isOpen: true,
        type: "error",
        message: "Vui lòng chọn file Excel",
      });
      return;
    }

    try {
      setImportLoading(true);
      setImportProgress(0);

      const formData = new FormData();
      formData.append("file", storesFile);

      setImportProgress(30);
      const res = await api.post("/import/stores", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setImportProgress(100);
      setImportResults(res.data.results);

      if (res.data.results.errorCount > 0) {
        setNotification({
          isOpen: true,
          type: "error",
          message: `Import hoàn tất với ${res.data.results.successCount} thành công và ${res.data.results.errorCount} lỗi`,
        });
      } else {
        setNotification({
          isOpen: true,
          type: "success",
          message: `Import thành công ${res.data.results.successCount} cửa hàng`,
        });
      }

      setStoresFile(null);
      if (storesFileInputRef.current) {
        storesFileInputRef.current.value = "";
      }
      fetchImportHistory("stores");

      setTimeout(() => {
        setImportLoading(false);
        setImportProgress(0);
      }, 500);
    } catch (error: unknown) {
      console.error("Error importing stores:", error);
      setImportLoading(false);
      setImportProgress(0);
      const errorMessage =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Lỗi khi import cửa hàng";
      setNotification({
        isOpen: true,
        type: "error",
        message: errorMessage,
      });
    }
  };

  const handleImportUsers = async () => {
    if (!usersFile) {
      setNotification({
        isOpen: true,
        type: "error",
        message: "Vui lòng chọn file Excel",
      });
      return;
    }

    try {
      setImportLoading(true);
      setImportProgress(0);

      const formData = new FormData();
      formData.append("file", usersFile);

      setImportProgress(30);
      const res = await api.post("/import/users", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setImportProgress(100);
      setImportResults(res.data.results);

      if (res.data.results.errorCount > 0) {
        setNotification({
          isOpen: true,
          type: "error",
          message: `Import hoàn tất với ${res.data.results.successCount} thành công và ${res.data.results.errorCount} lỗi`,
        });
      } else {
        setNotification({
          isOpen: true,
          type: "success",
          message: `Import thành công ${res.data.results.successCount} nhân viên`,
        });
      }

      setUsersFile(null);
      if (usersFileInputRef.current) {
        usersFileInputRef.current.value = "";
      }
      fetchImportHistory("users");

      setTimeout(() => {
        setImportLoading(false);
        setImportProgress(0);
      }, 500);
    } catch (error: unknown) {
      console.error("Error importing users:", error);
      setImportLoading(false);
      setImportProgress(0);
      const errorMessage =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Lỗi khi import nhân viên";
      setNotification({
        isOpen: true,
        type: "error",
        message: errorMessage,
      });
    }
  };

  // Helper functions for stores export
  const getRankLabel = (rank: number | null) => {
    if (rank === 1) return "Đơn vị, tổ chức";
    if (rank === 2) return "Cá nhân";
    return "-";
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      not_audited: "Chưa thực hiện",
      audited: "Đã thực hiện",
      passed: "Đạt",
      failed: "Không đạt",
    };
    return labels[status] || status;
  };

  const handleExportReport = async (type: "dashboard" | "stores" | "users") => {
    try {
      setExportLoading(true);
      setExportProgress(0);

      if (type === "dashboard") {
        // Export dashboard report - use same logic as Dashboard.tsx
        setExportProgress(20);
        const res = await api.get("/dashboard/export");
        setExportProgress(50);
        await generateDashboardExcel(res.data.data, setExportProgress);
        setExportProgress(100);
      } else if (type === "stores") {
        // Export stores list - use same logic as Stores.tsx
        setExportProgress(20);
        const res = await api.get("/stores", {
          params: { page: 1, pageSize: 10000 },
        });
        setExportProgress(50);
        await generateStoresExcel(res.data.data || [], setExportProgress);
        setExportProgress(100);
      } else {
        // Export users list
        setExportProgress(20);
        const res = await api.get("/users", {
          params: { page: 1, pageSize: 10000 },
        });
        setExportProgress(50);

        const ExcelJS = (await import("exceljs")).default;
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Danh sách nhân viên");

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
        };

        sheet.mergeCells("A1:F1");
        sheet.getCell("A1").value = "CÔNG TY CỔ PHẦN XI MĂNG TÂY ĐÔ";
        sheet.getCell("A1").font = { bold: true, size: 14 };
        sheet.getCell("A1").alignment = { horizontal: "center" };

        sheet.mergeCells("A2:F2");
        sheet.getCell("A2").value = "DANH SÁCH NHÂN VIÊN";
        sheet.getCell("A2").font = { bold: true, size: 12 };
        sheet.getCell("A2").alignment = { horizontal: "center" };

        const headers = [
          "STT",
          "Mã nhân viên",
          "Tên nhân viên",
          "Email",
          "Số điện thoại",
          "Vai trò",
        ];
        sheet.getRow(4).values = headers;
        sheet.getRow(4).eachCell((cell) => {
          cell.style = headerStyle;
        });

        res.data.data.forEach(
          (
            user: {
              UserCode: string;
              FullName: string;
              Email: string | null;
              Phone: string | null;
              Role: string;
            },
            index: number
          ) => {
            const row = sheet.addRow([
              index + 1,
              user.UserCode,
              user.FullName,
              user.Email || "",
              user.Phone || "",
              user.Role === "admin" ? "Admin" : "Sales",
            ]);
            row.eachCell((cell) => {
              cell.border = {
                top: { style: "thin" },
                bottom: { style: "thin" },
                left: { style: "thin" },
                right: { style: "thin" },
              };
            });
          }
        );

        sheet.columns = [
          { width: 10 },
          { width: 15 },
          { width: 30 },
          { width: 30 },
          { width: 15 },
          { width: 15 },
        ];

        setExportProgress(90);
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `DanhSachNhanVien_${
          new Date().toISOString().split("T")[0]
        }.xlsx`;
        link.click();
        window.URL.revokeObjectURL(url);
      }

      setTimeout(() => {
        setExportLoading(false);
        setExportProgress(0);
      }, 500);
    } catch (error) {
      console.error("Error exporting report:", error);
      setExportLoading(false);
      setExportProgress(0);
      setNotification({
        isOpen: true,
        type: "error",
        message: "Lỗi khi xuất báo cáo",
      });
    }
  };

  // Generate Stores Excel - same logic as Stores.tsx
  const generateStoresExcel = async (
    storesData: Store[],
    progressCallback?: (progress: number) => void
  ) => {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();

    if (progressCallback) progressCallback(60);

    const sheet = workbook.addWorksheet("Danh sách cửa hàng");

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
    sheet.mergeCells("A1:P1");
    sheet.getCell("A1").value = "CÔNG TY CỔ PHẦN XI MĂNG TÂY ĐÔ";
    sheet.getCell("A1").font = { bold: true, size: 14 };
    sheet.getCell("A1").alignment = { horizontal: "center" };

    sheet.mergeCells("A2:P2");
    sheet.getCell("A2").value = "DANH SÁCH CỬA HÀNG";
    sheet.getCell("A2").font = { bold: true, size: 12 };
    sheet.getCell("A2").alignment = { horizontal: "center" };

    // Headers
    const headers = [
      "STT",
      "Mã cửa hàng",
      "Tên cửa hàng",
      "Loại đối tượng",
      "Địa chỉ",
      "Mã số thuế",
      "Tên đối tác",
      "Số điện thoại",
      "Email",
      "Trạng thái",
      "Địa bàn phụ trách",
      "User phụ trách",
      "Link chi tiết",
      "Latitude",
      "Longitude",
      "Xem trên Google Maps",
    ];
    sheet.getRow(4).values = headers;
    sheet.getRow(4).eachCell((cell) => {
      cell.style = headerStyle;
    });

    // Data
    if (progressCallback) progressCallback(70);
    storesData.forEach((store, index) => {
      const row = sheet.addRow([
        index + 1,
        store.StoreCode,
        store.StoreName,
        getRankLabel(store.Rank),
        store.Address || "",
        store.TaxCode || "",
        store.PartnerName || "",
        store.Phone || "",
        store.Email || "",
        getStatusLabel(store.Status),
        store.TerritoryName || "",
        store.UserFullName
          ? `${store.UserFullName} (${store.UserCode || ""})`
          : "",
        "", // Link chi tiết - will be set as hyperlink
        store.Latitude || "",
        store.Longitude || "",
        "", // Google Maps link - will be set as hyperlink
      ]);

      // Set hyperlink for "Link chi tiết"
      const detailLinkCell = row.getCell(13);
      detailLinkCell.value = {
        text: "Link chi tiết",
        hyperlink: `https://ximang.netlify.app/stores/${store.Id}`,
      };
      detailLinkCell.font = { color: { argb: "FF0000FF" }, underline: true };

      // Set hyperlink for "Xem trên Google Maps" (only if has coordinates)
      const mapLinkCell = row.getCell(16);
      if (store.Latitude && store.Longitude) {
        mapLinkCell.value = {
          text: "Xem trên Google Maps",
          hyperlink: `https://www.google.com/maps?q=${store.Latitude},${store.Longitude}`,
        };
        mapLinkCell.font = { color: { argb: "FF0000FF" }, underline: true };
      }

      // Add borders to all cells
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    // Set column widths
    sheet.columns = [
      { width: 10 }, // STT
      { width: 15 }, // Mã cửa hàng
      { width: 30 }, // Tên cửa hàng
      { width: 20 }, // Loại đối tượng
      { width: 40 }, // Địa chỉ
      { width: 15 }, // Mã số thuế
      { width: 25 }, // Tên đối tác
      { width: 15 }, // Số điện thoại
      { width: 25 }, // Email
      { width: 15 }, // Trạng thái
      { width: 25 }, // Địa bàn phụ trách
      { width: 30 }, // User phụ trách
      { width: 20 }, // Link chi tiết
      { width: 15 }, // Latitude
      { width: 15 }, // Longitude
      { width: 25 }, // Xem trên Google Maps
    ];

    if (progressCallback) progressCallback(90);

    // Generate Excel file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `DanhSachCuaHang_${
      new Date().toISOString().split("T")[0]
    }.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  // Generate Dashboard Excel - same logic as Dashboard.tsx
  const generateDashboardExcel = async (
    data: {
      summary: DashboardSummaryItem[];
      details: Record<string, DashboardDetailItem[]>;
    },
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

    // Detail sheets
    const totalUsers = data.summary.length;

    // Count how many times each FullName appears
    const nameCountMap = new Map<string, number>();
    data.summary.forEach((user) => {
      const count = nameCountMap.get(user.FullName) || 0;
      nameCountMap.set(user.FullName, count + 1);
    });

    for (let i = 0; i < data.summary.length; i++) {
      const user = data.summary[i];
      // If multiple users have the same FullName, include territory name
      // Otherwise, just use FullName
      const nameCount = nameCountMap.get(user.FullName) || 0;
      const sheetName =
        nameCount > 1
          ? `Chi tiết ${user.FullName} - ${user.TerritoryName}`
          : `Chi tiết ${user.FullName}`;

      const detailSheet = workbook.addWorksheet(sheetName);
      // Use combination key: UserId-TerritoryId to get correct data
      const detailKey = `${user.UserId}-${user.TerritoryId}`;
      const userDetails = data.details[detailKey] || [];

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
      detailSheet.getCell("A2").value =
        "BẢNG TỔNG HỢP CHECKIN CỬA HÀNG THEO THÁNG";
      detailSheet.getCell("A2").font = { bold: true, size: 12 };
      detailSheet.getCell("A2").alignment = { horizontal: "center" };

      // Headers
      detailSheet.getRow(4).values = [
        "Ngày",
        "STT",
        "NPP/Cửa hàng",
        "Địa chỉ cửa hàng",
        "Thời Gian Checkin",
        "Ghi chú",
      ];
      detailSheet.getRow(4).eachCell((cell) => {
        cell.style = headerStyle;
      });

      // Data
      userDetails.forEach((detail, index) => {
        const checkinDate = new Date(detail.CheckinDate);
        const checkinTime = detail.CheckinTime
          ? new Date(detail.CheckinTime)
          : null;

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="import-export-container">
      <div className="import-export-header">
        <h1>Import / Export</h1>
      </div>

      {/* Tabs */}
      <div className="import-export-tabs">
        <button
          className={`tab ${activeTab === "import-stores" ? "active" : ""}`}
          onClick={() => setActiveTab("import-stores")}
        >
          <HiArrowUpTray /> Import Cửa hàng
        </button>
        <button
          className={`tab ${activeTab === "import-users" ? "active" : ""}`}
          onClick={() => setActiveTab("import-users")}
        >
          <HiArrowUpTray /> Import Nhân viên
        </button>
        <button
          className={`tab ${activeTab === "export-reports" ? "active" : ""}`}
          onClick={() => setActiveTab("export-reports")}
        >
          <HiArrowDownTray /> Xuất báo cáo
        </button>
      </div>

      {/* Tab Content */}
      <div className="import-export-content">
        {/* Import Stores Tab */}
        {activeTab === "import-stores" && (
          <div className="import-tab">
            <div className="import-section">
              <h2>Import Cửa hàng</h2>
              <div className="import-actions">
                <button
                  className="btn-secondary"
                  onClick={() => downloadTemplate("stores")}
                >
                  <HiDocumentText /> Tải template Excel
                </button>
              </div>

              <div className="upload-area">
                <input
                  ref={storesFileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setStoresFile(e.target.files?.[0] || null)}
                  hidden
                />
                <label
                  htmlFor="storesFile"
                  className="upload-box"
                  onClick={() => storesFileInputRef.current?.click()}
                >
                  <HiArrowUpTray className="upload-icon" />
                  <div>
                    <strong>
                      {storesFile
                        ? storesFile.name
                        : "Chọn file Excel để import"}
                    </strong>
                    <p>Chỉ chấp nhận file .xlsx, .xls</p>
                  </div>
                </label>
                <button
                  className="btn-primary"
                  onClick={handleImportStores}
                  disabled={!storesFile || importLoading}
                >
                  Bắt đầu import
                </button>
              </div>

              {importResults && importResults.errors.length > 0 && (
                <div className="import-errors">
                  <h3>Lỗi import ({importResults.errors.length} dòng)</h3>
                  <div className="errors-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Dòng</th>
                          <th>Tên cửa hàng</th>
                          <th>Lỗi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResults.errors.map((error, index) => (
                          <tr key={index}>
                            <td>{error.row}</td>
                            <td>{error.storeName || ""}</td>
                            <td className="error-text">{error.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="history-section">
              <h2>Lịch sử import</h2>
              <div className="history-list">
                {storesHistory.length === 0 ? (
                  <p className="no-history">Chưa có lịch sử import</p>
                ) : (
                  storesHistory.map((history) => (
                    <div key={history.Id} className="history-item">
                      <div className="history-info">
                        <strong>Import cửa hàng</strong>
                        <p>
                          {formatDate(history.CreatedAt)} - {history.Total} bản
                          ghi
                        </p>
                        <p className="history-stats">
                          ✅ {history.SuccessCount} thành công | ❌{" "}
                          {history.ErrorCount} lỗi
                        </p>
                      </div>
                      <span
                        className={`status ${
                          history.ErrorCount === 0 ? "success" : "warning"
                        }`}
                      >
                        {history.ErrorCount === 0 ? "Thành công" : "Có lỗi"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Import Users Tab */}
        {activeTab === "import-users" && (
          <div className="import-tab">
            <div className="import-section">
              <h2>Import Nhân viên</h2>
              <div className="import-actions">
                <button
                  className="btn-secondary"
                  onClick={() => downloadTemplate("users")}
                >
                  <HiDocumentText /> Tải template Excel
                </button>
              </div>

              <div className="upload-area">
                <input
                  ref={usersFileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setUsersFile(e.target.files?.[0] || null)}
                  hidden
                />
                <label
                  htmlFor="usersFile"
                  className="upload-box"
                  onClick={() => usersFileInputRef.current?.click()}
                >
                  <HiArrowUpTray className="upload-icon" />
                  <div>
                    <strong>
                      {usersFile ? usersFile.name : "Chọn file Excel để import"}
                    </strong>
                    <p>Chỉ chấp nhận file .xlsx, .xls</p>
                  </div>
                </label>
                <button
                  className="btn-primary"
                  onClick={handleImportUsers}
                  disabled={!usersFile || importLoading}
                >
                  Bắt đầu import
                </button>
              </div>

              {importResults && importResults.errors.length > 0 && (
                <div className="import-errors">
                  <h3>Lỗi import ({importResults.errors.length} dòng)</h3>
                  <div className="errors-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Dòng</th>
                          <th>Tên đăng nhập</th>
                          <th>Lỗi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResults.errors.map((error, index) => (
                          <tr key={index}>
                            <td>{error.row}</td>
                            <td>{error.username || ""}</td>
                            <td className="error-text">{error.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="history-section">
              <h2>Lịch sử import</h2>
              <div className="history-list">
                {usersHistory.length === 0 ? (
                  <p className="no-history">Chưa có lịch sử import</p>
                ) : (
                  usersHistory.map((history) => (
                    <div key={history.Id} className="history-item">
                      <div className="history-info">
                        <strong>Import nhân viên</strong>
                        <p>
                          {formatDate(history.CreatedAt)} - {history.Total} bản
                          ghi
                        </p>
                        <p className="history-stats">
                          ✅ {history.SuccessCount} thành công | ❌{" "}
                          {history.ErrorCount} lỗi
                        </p>
                      </div>
                      <span
                        className={`status ${
                          history.ErrorCount === 0 ? "success" : "warning"
                        }`}
                      >
                        {history.ErrorCount === 0 ? "Thành công" : "Có lỗi"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Export Reports Tab */}
        {activeTab === "export-reports" && (
          <div className="export-tab">
            <h2>Xuất báo cáo</h2>
            <div className="export-cards">
              <div className="export-card">
                <HiDocumentText className="export-icon" />
                <h3>Báo cáo tổng hợp</h3>
                <p>Xuất báo cáo từ Dashboard</p>
                <button
                  className="btn-primary"
                  onClick={() => handleExportReport("dashboard")}
                  disabled={exportLoading}
                >
                  <HiArrowDownTray /> Xuất Excel
                </button>
              </div>

              <div className="export-card">
                <HiDocumentText className="export-icon" />
                <h3>Danh sách cửa hàng</h3>
                <p>Xuất toàn bộ danh sách cửa hàng</p>
                <button
                  className="btn-primary"
                  onClick={() => handleExportReport("stores")}
                  disabled={exportLoading}
                >
                  <HiArrowDownTray /> Xuất Excel
                </button>
              </div>

              <div className="export-card">
                <HiDocumentText className="export-icon" />
                <h3>Danh sách nhân viên</h3>
                <p>Xuất toàn bộ danh sách nhân viên</p>
                <button
                  className="btn-primary"
                  onClick={() => handleExportReport("users")}
                  disabled={exportLoading}
                >
                  <HiArrowDownTray /> Xuất Excel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Loading Modals */}
      <LoadingModal
        isOpen={importLoading}
        message="Đang import dữ liệu..."
        progress={importProgress}
      />
      <LoadingModal
        isOpen={exportLoading}
        message="Đang tạo báo cáo Excel..."
        progress={exportProgress}
      />

      {/* Notification Modal */}
      <NotificationModal
        isOpen={notification.isOpen}
        type={notification.type}
        message={notification.message}
        onClose={() => setNotification({ ...notification, isOpen: false })}
      />
    </div>
  );
}

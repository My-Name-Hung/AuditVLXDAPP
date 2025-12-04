import { useEffect, useState } from "react";
import { HiArrowLeft } from "react-icons/hi2";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../services/api";
import "./StoreSurveyDetail.css";

interface StoreSurvey {
  Id: number;
  StoreId: number;
  AuditId: number;
  UserId: number;
  StoreCode: string;
  StoreName: string;
  TerritoryName?: string;
  UserFullName: string;
  UserCode: string;
  CementProductCode: string | null;
  CementProductName: string | null;
  ContactPerson: string | null;
  PurchasePrice: number | null;
  SellingPrice: number | null;
  SupplierName: string | null;
  RoadTransportFee: number | null;
  WaterTransportFee: number | null;
  ImportExportQuantity: string | null;
  StockQuantity: string | null;
  ConsumptionArea: string | null;
  DebtPeriod: string | null;
  WhyNotSellNewProduct: string | null;
  TimeToSellNewProduct: string | null;
  NewProductImportQuantity: number | null;
  ImportedBySalesperson: string | null;
  NewProductSellingPrice: number | null;
  FutureImportPrediction: number | null;
  AuditDate: string | null;
  AuditNotes: string | null;
  AverageMonthlyConsumption: number | null;
  StoreComment: string | null;
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

export default function StoreSurveyDetail() {
  const { storeId } = useParams<{ storeId: string }>();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get("userId");
  const auditId = searchParams.get("auditId");
  const navigate = useNavigate();

  const [survey, setSurvey] = useState<StoreSurvey | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    fetchSurvey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, auditId, userId]);

  const fetchSurvey = async () => {
    try {
      if (auditId) {
        const res = await api.get(`/store-surveys/audit/${auditId}`);
        setSurvey(res.data);
      } else if (storeId && userId) {
        const res = await api.get(`/store-surveys/store/${storeId}`, {
          params: { userId },
        });
        if (res.data && res.data.length > 0) {
          setSurvey(res.data[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching survey:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Đang tải dữ liệu...</div>;
  }

  if (!survey) {
    return (
      <div className="store-survey-detail">
        <div className="store-survey-detail-header">
          <button className="back-button" onClick={() => navigate(-1)}>
            <HiArrowLeft /> Quay lại
          </button>
          <h1>Thông tin khảo sát</h1>
        </div>
        <div className="no-data">Không tìm thấy thông tin khảo sát</div>
      </div>
    );
  }

  const handleExportExcel = async () => {
    if (!survey) return;

    try {
      setExportLoading(true);
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();

      // Calculate week number in month and week number in year
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const day = now.getDate();
      
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
        (now.getTime() - januaryFirst.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      // Calculate week number: (days + offset to first Monday) / 7, rounded up
      const weekNumberInYear = Math.ceil((daysSinceYearStart + firstMondayOffset + 1) / 7);

      const sheet = workbook.addWorksheet("Báo cáo khảo sát");

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

      // Title rows - Layout: Title 1 (top), Territory (middle), Title 2 (below)
      sheet.mergeCells("A1:M1");
      sheet.getCell("A1").value = `BÁO CÁO THĂM CỬA HÀNG TUẦN ${weekNumberInMonth}`;
      sheet.getCell("A1").font = { bold: true, size: 14 };
      sheet.getCell("A1").alignment = { horizontal: "center" };

      sheet.mergeCells("A2:M2");
      sheet.getCell("A2").value = `Địa bàn: ${
        survey.TerritoryName || "Chưa xác định"
      }`;
      sheet.getCell("A2").font = { bold: true, size: 12 };
      sheet.getCell("A2").alignment = { horizontal: "center" };

      sheet.mergeCells("A3:M3");
      sheet.getCell("A3").value = `1. BÁO CÁO THỰC TẾ THĂM CỬA HÀNG TUẦN ${weekNumberInYear}/${year}`;
      sheet.getCell("A3").font = { bold: true, size: 12 };
      sheet.getCell("A3").alignment = { horizontal: "left" };

      // Table headers
      const headers = [
        "Stt",
        "Tên Cửa hàng",
        "Ngày thăm",
        "Tên + SDT",
        "Loại XM",
        "Giá mua",
        "Giá bán",
        "Phí VC đường bộ",
        "Phí VC đường thủy",
        "SL nhận hàng (tấn/tháng)",
        "Nhập từ NPP",
        "Số lượng tồn bình quân (tấn/tháng)",
        "Ý kiến CH",
      ];

      sheet.getRow(5).values = headers;
      sheet.getRow(5).eachCell((cell) => {
        cell.style = headerStyle;
      });

      // Data rows - Show products from Title 3
      if (survey.products && survey.products.length > 0) {
        survey.products.forEach((product, index) => {
          const row = sheet.addRow([
            index + 1,
            survey.StoreName || "",
            formatDate(survey.AuditDate),
            product.ContactPersonPhone || "",
            product.CementProductName || "",
            formatVND(product.PurchasePrice),
            formatVND(product.SellingPrice),
            formatVND(product.RoadTransportFee),
            formatVND(product.WaterTransportFee),
            product.QuantityReceived || "",
            product.ImportedFromNPP || "",
            product.AverageStockQuantity || "",
            survey.StoreComment || "",
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
        });
      } else {
        // Fallback if no products
        const row = sheet.addRow([
          1,
          survey.StoreName || "",
          formatDate(survey.AuditDate),
          "",
          "",
          "",
          formatVND(survey.NewProductSellingPrice),
          "",
          "",
          "",
          "",
          survey.AverageMonthlyConsumption || "",
          survey.StoreComment || "",
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
      }

      // Column widths
      sheet.columns = [
        { width: 8 },
        { width: 25 },
        { width: 12 },
        { width: 20 },
        { width: 20 },
        { width: 12 },
        { width: 12 },
        { width: 15 },
        { width: 15 },
        { width: 20 },
        { width: 18 },
        { width: 25 },
        { width: 30 },
      ];

      // Export
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `BaoCaoKhaoSat_${survey.StoreCode}_${
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

  return (
    <div className="store-survey-detail">
      <div className="store-survey-detail-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <HiArrowLeft /> Quay lại
        </button>
        <h1>Thông tin khảo sát</h1>
        <button
          className="btn-export"
          onClick={handleExportExcel}
          disabled={exportLoading}
        >
          {exportLoading ? "Đang xuất..." : "Xuất Excel"}
        </button>
      </div>

      <div className="store-survey-detail-content">
        {/* Store Info */}
        <div className="survey-section">
          <h2>Thông tin cửa hàng</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>Mã cửa hàng:</label>
              <span>{survey.StoreCode}</span>
            </div>
            <div className="info-item">
              <label>Tên cửa hàng:</label>
              <span>{survey.StoreName}</span>
            </div>
            <div className="info-item">
              <label>Người thực hiện:</label>
              <span>
                {survey.UserFullName} ({survey.UserCode})
              </span>
            </div>
            <div className="info-item">
              <label>Ngày thăm:</label>
              <span>{formatDate(survey.AuditDate)}</span>
            </div>
            {survey.AuditNotes && (
              <div className="info-item">
                <label>Ý kiến cửa hàng:</label>
                <span>{survey.AuditNotes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Sản phẩm của XMTĐ (Title 2 + 3) */}
        {(survey.WhyNotSellNewProduct ||
          (survey.products && survey.products.length > 0)) && (
          <div className="survey-section">
            <h2>Sản phẩm của XMTĐ</h2>
            <div className="survey-table-container">
              <table className="survey-table">
                <thead>
                  <tr>
                    <th>Stt</th>
                    <th>Tên Cửa hàng</th>
                    <th>Ngày thăm</th>
                    <th>Tên + SDT</th>
                    <th>Loại XM</th>
                    <th>Giá mua</th>
                    <th>Giá bán</th>
                    <th>Phí VC đường bộ</th>
                    <th>Phí VC đường thủy</th>
                    <th>SL nhận hàng (tấn/tháng)</th>
                    <th>Nhập từ NPP</th>
                    <th>Số lượng tồn bình quân (tấn/tháng)</th>
                    <th>Ý kiến CH</th>
                  </tr>
                </thead>
                <tbody>
                  {survey.products && survey.products.length > 0 ? (
                    survey.products.map((product, index) => (
                      <tr key={product.Id}>
                        <td>{index + 1}</td>
                        <td>{survey.StoreName}</td>
                        <td>{formatDate(survey.AuditDate)}</td>
                        <td>{product.ContactPersonPhone || ""}</td>
                        <td>{product.CementProductName || ""}</td>
                        <td>{formatVND(product.PurchasePrice)}</td>
                        <td>{formatVND(product.SellingPrice)}</td>
                        <td>{formatVND(product.RoadTransportFee)}</td>
                        <td>{formatVND(product.WaterTransportFee)}</td>
                        <td>{product.QuantityReceived || ""}</td>
                        <td>{product.ImportedFromNPP || ""}</td>
                        <td>{product.AverageStockQuantity || ""}</td>
                        <td>{survey.StoreComment || ""}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td>1</td>
                      <td>{survey.StoreName}</td>
                      <td>{formatDate(survey.AuditDate)}</td>
                      <td>-</td>
                      <td>-</td>
                      <td>-</td>
                      <td>{formatVND(survey.NewProductSellingPrice)}</td>
                      <td>-</td>
                      <td>-</td>
                      <td>-</td>
                      <td>-</td>
                      <td>{survey.AverageMonthlyConsumption || ""}</td>
                      <td>{survey.StoreComment || ""}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

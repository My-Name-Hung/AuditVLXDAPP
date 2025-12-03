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
    SellingPrice: number | null;
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

      // Get current week number
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const pastDaysOfYear = (now.getTime() - startOfYear.getTime()) / 86400000;
      const weekNumber = Math.ceil(
        (pastDaysOfYear + startOfYear.getDay() + 1) / 7
      );

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

      // Title rows
      sheet.mergeCells("A1:K1");
      sheet.getCell("A1").value =
        "1. BÁO CÁO THỰC TẾ THĂM CỬA HÀNG TUẦN 20/2025";
      sheet.getCell("A1").font = { bold: true, size: 12 };
      sheet.getCell("A1").alignment = { horizontal: "left" };

      sheet.mergeCells("A2:K2");
      sheet.getCell("A2").value = `BÁO CÁO THĂM CỬA HÀNG TUẦN ${weekNumber}`;
      sheet.getCell("A2").font = { bold: true, size: 14 };
      sheet.getCell("A2").alignment = { horizontal: "center" };

      sheet.mergeCells("A3:K3");
      sheet.getCell("A3").value = "Địa bàn: An Giang";
      sheet.getCell("A3").font = { bold: true, size: 12 };
      sheet.getCell("A3").alignment = { horizontal: "center" };

      // Table headers
      const headers = [
        "Stt",
        "Tên Cửa hàng",
        "Ngày thăm",
        "Người tiếp xúc",
        "Loại XM",
        "Giá mua",
        "Giá bán",
        "SLTTBQ (tấn/tháng)",
        "Mua qua NPP",
        "Ý kiến CH",
      ];

      sheet.getRow(5).values = headers;
      sheet.getRow(5).eachCell((cell) => {
        cell.style = headerStyle;
      });

      // Data row
      const row = sheet.addRow([
        1,
        survey.StoreName || "",
        formatDate(survey.AuditDate),
        survey.ContactPerson || "",
        survey.CementProductName || "",
        formatVND(survey.PurchasePrice),
        formatVND(survey.SellingPrice),
        survey.ImportExportQuantity || "",
        survey.SupplierName || "",
        survey.AuditNotes || "",
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

      // Column widths
      sheet.columns = [
        { width: 8 },
        { width: 25 },
        { width: 12 },
        { width: 18 },
        { width: 20 },
        { width: 12 },
        { width: 12 },
        { width: 18 },
        { width: 18 },
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

        {/* Bảng 1: Không phải sản phẩm XMTĐ (Title 1) */}
        {survey.CementProductCode && (
          <div className="survey-section">
            <h2>Cửa hàng bán sản phẩm không phải của Xi Măng Tây Đô</h2>
            <div className="survey-table-container">
              <table className="survey-table">
                <thead>
                  <tr>
                    <th>Stt</th>
                    <th>Tên Cửa hàng</th>
                    <th>Ngày thăm</th>
                    <th>Người tiếp xúc</th>
                    <th>Loại XM</th>
                    <th>Giá mua</th>
                    <th>Giá bán</th>
                    <th>SLTTBQ (tấn/tháng)</th>
                    <th>Mua qua NPP</th>
                    <th>Ý kiến CH</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>1</td>
                    <td>{survey.StoreName}</td>
                    <td>{formatDate(survey.AuditDate)}</td>
                    <td>{survey.ContactPerson || ""}</td>
                    <td>{survey.CementProductName || ""}</td>
                    <td>{formatVND(survey.PurchasePrice)}</td>
                    <td>{formatVND(survey.SellingPrice)}</td>
                    <td>{survey.ImportExportQuantity || ""}</td>
                    <td>{survey.SupplierName || ""}</td>
                    <td>{survey.AuditNotes || ""}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Bảng 2: Sản phẩm của XMTĐ (Title 2 + 3) */}
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
                    <th>Người tiếp xúc</th>
                    <th>Loại XM</th>
                    <th>Giá mua</th>
                    <th>Giá bán</th>
                    <th>SLTTBQ (tấn/tháng)</th>
                    <th>Mua qua NPP</th>
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
                        <td>{survey.ContactPerson || ""}</td>
                        <td>{product.CementProductName || ""}</td>
                        <td>-</td>
                        <td>{formatVND(product.SellingPrice)}</td>
                        <td>{survey.AverageMonthlyConsumption || ""}</td>
                        <td>-</td>
                        <td>
                          {survey.StoreComment || survey.AuditNotes || ""}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td>1</td>
                      <td>{survey.StoreName}</td>
                      <td>{formatDate(survey.AuditDate)}</td>
                      <td>{survey.ContactPerson || ""}</td>
                      <td>-</td>
                      <td>-</td>
                      <td>{formatVND(survey.NewProductSellingPrice)}</td>
                      <td>{survey.AverageMonthlyConsumption || ""}</td>
                      <td>-</td>
                      <td>{survey.StoreComment || survey.AuditNotes || ""}</td>
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

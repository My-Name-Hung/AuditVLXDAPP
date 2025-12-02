import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { HiArrowLeft } from "react-icons/hi2";
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

  useEffect(() => {
    fetchSurvey();
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
          <button
            className="back-button"
            onClick={() => navigate(-1)}
          >
            <HiArrowLeft /> Quay lại
          </button>
          <h1>Thông tin khảo sát</h1>
        </div>
        <div className="no-data">Không tìm thấy thông tin khảo sát</div>
      </div>
    );
  }

  return (
    <div className="store-survey-detail">
      <div className="store-survey-detail-header">
        <button
          className="back-button"
          onClick={() => navigate(-1)}
        >
          <HiArrowLeft /> Quay lại
        </button>
        <h1>Thông tin khảo sát</h1>
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
              <span>{survey.UserFullName} ({survey.UserCode})</span>
            </div>
          </div>
        </div>

        {/* Title 1 */}
        <div className="survey-section">
          <h2>Cửa hàng bán sản phẩm không phải của Xi Măng Tây Đô</h2>
          <div className="survey-table-container">
            <table className="survey-table">
              <thead>
                <tr>
                  <th>Stt</th>
                  <th>Người tiếp xúc</th>
                  <th>Loại XM</th>
                  <th>Giá mua</th>
                  <th>Giá bán</th>
                  <th>Mua qua NPP</th>
                  <th>SLTTBQ (tấn/tháng)</th>
                  <th>Số lượng tồn kho</th>
                  <th>Vùng đang tiêu thụ</th>
                  <th>Công nợ bao lâu</th>
                  <th>Phí code đường bộ</th>
                  <th>Phí code đường thủy</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td>{survey.ContactPerson || ""}</td>
                  <td>
                    {survey.CementProductCode && survey.CementProductName
                      ? `${survey.CementProductCode} - ${survey.CementProductName}`
                      : ""}
                  </td>
                  <td>{formatVND(survey.PurchasePrice)}</td>
                  <td>{formatVND(survey.SellingPrice)}</td>
                  <td>{survey.SupplierName || ""}</td>
                  <td>{survey.ImportExportQuantity || ""}</td>
                  <td>{survey.StockQuantity || ""}</td>
                  <td>{survey.ConsumptionArea || ""}</td>
                  <td>{survey.DebtPeriod || ""}</td>
                  <td>{formatVND(survey.RoadTransportFee)}</td>
                  <td>{formatVND(survey.WaterTransportFee)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Title 2 */}
        <div className="survey-section">
          <h2>Khảo sát sản phẩm của XMTĐ</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>Tại sao không bán sản phẩm mới:</label>
              <span>{survey.WhyNotSellNewProduct || ""}</span>
            </div>
            <div className="info-item">
              <label>Thời gian để bán sản phẩm mới:</label>
              <span>{formatDate(survey.TimeToSellNewProduct)}</span>
            </div>
            <div className="info-item">
              <label>Số lượng nhập sản phẩm mới:</label>
              <span>{formatVND(survey.NewProductImportQuantity)}</span>
            </div>
            <div className="info-item">
              <label>Nhập bởi thương vụ:</label>
              <span>{survey.ImportedBySalesperson || ""}</span>
            </div>
            <div className="info-item">
              <label>Giá bán ra (sản phẩm mới):</label>
              <span>{formatVND(survey.NewProductSellingPrice)}</span>
            </div>
            <div className="info-item">
              <label>Dự đoán tương lai sẽ nhập bao nhiêu hàng của XMTĐ:</label>
              <span>{formatVND(survey.FutureImportPrediction)}</span>
            </div>
          </div>
        </div>

        {/* Title 3 */}
        {survey.products && survey.products.length > 0 && (
          <div className="survey-section">
            <h2>Thông tin bán hàng</h2>
            <div className="survey-table-container">
              <table className="survey-table">
                <thead>
                  <tr>
                    <th>Stt</th>
                    <th>Sản phẩm được bán</th>
                    <th>Loại XM</th>
                    <th>Giá bán ra</th>
                  </tr>
                </thead>
                <tbody>
                  {survey.products.map((product, index) => (
                    <tr key={product.Id}>
                      <td>{index + 1}</td>
                      <td>{product.ProductType}</td>
                      <td>
                        {product.CementProductCode && product.CementProductName
                          ? `${product.CementProductCode} - ${product.CementProductName}`
                          : ""}
                      </td>
                      <td>{formatVND(product.SellingPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


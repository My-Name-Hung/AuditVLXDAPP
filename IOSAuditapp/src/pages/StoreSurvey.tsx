import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import api from "../services/api";
import "./StoreSurvey.css";

interface CementProduct {
  Id: number;
  Code: string;
  Name: string;
}

interface SurveyData {
  // Title 1
  cementProductId: number | null;
  contactPerson: string;
  purchasePrice: string;
  sellingPrice: string;
  supplierName: string;
  roadTransportFee: string;
  waterTransportFee: string;
  importExportQuantity: string;
  stockQuantity: string;
  consumptionArea: string;
  debtPeriod: string;
  // Title 2
  whyNotSellNewProduct: string;
  timeToSellNewProduct: string;
  newProductImportQuantity: string;
  importedBySalesperson: string;
  newProductSellingPrice: string;
  futureImportPrediction: string;
  // Title 3
  products: Array<{
    productType: string;
    cementProductId: number | null;
    sellingPrice: string;
  }>;
}

interface LocationState {
  storeId: number;
  capturedImages: Array<{
    dataUrl: string;
    latitude: number;
    longitude: number;
    timestamp: string;
    timezoneOffset: number;
  }>;
  notes: string;
}

const PRICE_OPTIONS = [3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000];
const PRODUCT_TYPES = ["Xi măng", "Cát", "Đá"];

const formatVND = (value: string): string => {
  const num = value.replace(/,/g, "");
  if (!num) return "";
  const formatted = parseInt(num).toLocaleString("vi-VN");
  return formatted;
};

const parseVND = (value: string): number => {
  const num = value.replace(/,/g, "");
  return parseFloat(num) || 0;
};

const StoreSurvey = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { colors } = useTheme();

  const state = location.state as LocationState | null;
  const storeId = state?.storeId || (id ? parseInt(id) : 0);
  const capturedImages = state?.capturedImages || [];
  const notes = state?.notes || "";

  const [cementProducts, setCementProducts] = useState<CementProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expandedTitles, setExpandedTitles] = useState({
    title1: true,
    title2: false,
    title3: false,
  });

  const [surveyData, setSurveyData] = useState<SurveyData>({
    cementProductId: null,
    contactPerson: "",
    purchasePrice: "",
    sellingPrice: "",
    supplierName: "",
    roadTransportFee: "",
    waterTransportFee: "",
    importExportQuantity: "",
    stockQuantity: "",
    consumptionArea: "",
    debtPeriod: "",
    whyNotSellNewProduct: "",
    timeToSellNewProduct: "",
    newProductImportQuantity: "",
    importedBySalesperson: "",
    newProductSellingPrice: "",
    futureImportPrediction: "",
    products: [],
  });

  useEffect(() => {
    fetchCementProducts();
  }, []);

  useEffect(() => {
    // Auto-expand title 2 if title 1 is complete
    const title1Complete =
      surveyData.cementProductId &&
      surveyData.contactPerson &&
      surveyData.purchasePrice &&
      surveyData.sellingPrice &&
      surveyData.supplierName &&
      surveyData.roadTransportFee &&
      surveyData.waterTransportFee &&
      surveyData.importExportQuantity &&
      surveyData.stockQuantity &&
      surveyData.consumptionArea &&
      surveyData.debtPeriod;

    if (title1Complete && !expandedTitles.title2) {
      setExpandedTitles((prev) => ({ ...prev, title2: true }));
    }
  }, [surveyData, expandedTitles.title2]);

  useEffect(() => {
    // Auto-expand title 3 if title 2 is complete
    const title2Complete =
      surveyData.whyNotSellNewProduct &&
      surveyData.timeToSellNewProduct &&
      surveyData.newProductImportQuantity &&
      surveyData.importedBySalesperson &&
      surveyData.newProductSellingPrice;

    if (title2Complete && !expandedTitles.title3) {
      setExpandedTitles((prev) => ({ ...prev, title3: true }));
    }
  }, [surveyData, expandedTitles.title3]);

  const fetchCementProducts = async () => {
    try {
      const response = await api.get("/cement-products");
      setCementProducts(response.data);
    } catch (error) {
      console.error("Error fetching cement products:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTitle = (title: "title1" | "title2" | "title3") => {
    setExpandedTitles((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  const handleInputChange = (
    field: keyof SurveyData,
    value: string | number | null
  ) => {
    setSurveyData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePriceChange = (field: "purchasePrice" | "sellingPrice" | "newProductSellingPrice" | "roadTransportFee" | "waterTransportFee" | "newProductImportQuantity", value: string) => {
    const formatted = formatVND(value);
    handleInputChange(field, formatted);
  };

  const handleAddProduct = () => {
    setSurveyData((prev) => ({
      ...prev,
      products: [
        ...prev.products,
        {
          productType: "",
          cementProductId: null,
          sellingPrice: "",
        },
      ],
    }));
  };

  const handleProductChange = (
    index: number,
    field: "productType" | "cementProductId" | "sellingPrice",
    value: string | number | null
  ) => {
    setSurveyData((prev) => {
      const newProducts = [...prev.products];
      newProducts[index] = {
        ...newProducts[index],
        [field]: value,
      };
      return {
        ...prev,
        products: newProducts,
      };
    });
  };

  const validateSurvey = (): string[] => {
    const errors: string[] = [];

    // Title 1 validation
    if (!surveyData.cementProductId) errors.push("Loại xi măng");
    if (!surveyData.contactPerson) errors.push("Người tiếp xúc");
    if (!surveyData.purchasePrice) errors.push("Giá mua vào");
    if (!surveyData.sellingPrice) errors.push("Giá bán ra");
    if (!surveyData.supplierName) errors.push("Nhập NPP nào");
    if (!surveyData.roadTransportFee) errors.push("Phí code đường bộ");
    if (!surveyData.waterTransportFee) errors.push("Phí code đường thủy");
    if (!surveyData.importExportQuantity) errors.push("Số lượng nhập/xuất");
    if (!surveyData.stockQuantity) errors.push("Số sản phẩm tồn kho");
    if (!surveyData.consumptionArea) errors.push("Vùng đang tiêu thụ");
    if (!surveyData.debtPeriod) errors.push("Công nợ bao lâu");

    // Title 2 validation
    if (!surveyData.whyNotSellNewProduct) errors.push("Tại sao không bán sản phẩm mới");
    if (!surveyData.timeToSellNewProduct) errors.push("Thời gian để bán sản phẩm mới");
    if (!surveyData.newProductImportQuantity) errors.push("Số lượng nhập sản phẩm mới");
    if (!surveyData.importedBySalesperson) errors.push("Nhập bởi thương vụ");
    if (!surveyData.newProductSellingPrice) errors.push("Giá bán ra (sản phẩm mới)");

    // Title 3 validation
    if (surveyData.products.length === 0) {
      errors.push("Thông tin bán hàng (ít nhất 1 sản phẩm)");
    } else {
      surveyData.products.forEach((product, index) => {
        if (!product.productType) {
          errors.push(`Sản phẩm ${index + 1}: Sản phẩm được bán`);
        }
        if (product.productType === "Xi măng" && !product.cementProductId) {
          errors.push(`Sản phẩm ${index + 1}: Loại xi măng`);
        }
        if (!product.sellingPrice) {
          errors.push(`Sản phẩm ${index + 1}: Giá bán ra`);
        }
      });
    }

    return errors;
  };

  const handleSubmit = async () => {
    const errors = validateSurvey();
    if (errors.length > 0) {
      const errorMessage = `Vui lòng điền đầy đủ các trường sau:\n${errors.join("\n")}`;
      if (confirm(errorMessage + "\n\nBạn có muốn tiếp tục hoàn thành không?")) {
        await submitSurvey();
      }
    } else {
      await submitSurvey();
    }
  };

  const submitSurvey = async () => {
    if (!user || !storeId || capturedImages.length !== 3) {
      alert("Thiếu thông tin cần thiết");
      return;
    }

    setSubmitting(true);

    try {
      // Step 1: Create audit
      const auditResponse = await api.post("/audits", {
        userId: user.id,
        storeId: storeId,
        notes: notes.trim() || null,
        auditDate: new Date().toISOString(),
      });

      const auditId = auditResponse.data.Id;

      // Step 2: Upload images
      for (let i = 0; i < capturedImages.length; i++) {
        const img = capturedImages[i];
        const formData = new FormData();
        const blob = await fetch(img.dataUrl).then((r) => r.blob());
        formData.append("image", blob, `image_${i + 1}.jpg`);
        formData.append("auditId", auditId.toString());
        formData.append("latitude", img.latitude.toString());
        formData.append("longitude", img.longitude.toString());
        formData.append("timestamp", img.timestamp);
        formData.append("timezoneOffset", img.timezoneOffset.toString());

        await api.post("/images/upload", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      }

      // Step 3: Create survey
      await api.post("/store-surveys", {
        storeId: storeId,
        auditId: auditId,
        userId: user.id,
        cementProductId: surveyData.cementProductId,
        contactPerson: surveyData.contactPerson,
        purchasePrice: parseVND(surveyData.purchasePrice),
        sellingPrice: parseVND(surveyData.sellingPrice),
        supplierName: surveyData.supplierName,
        roadTransportFee: parseVND(surveyData.roadTransportFee),
        waterTransportFee: parseVND(surveyData.waterTransportFee),
        importExportQuantity: surveyData.importExportQuantity,
        stockQuantity: surveyData.stockQuantity,
        consumptionArea: surveyData.consumptionArea,
        debtPeriod: surveyData.debtPeriod,
        whyNotSellNewProduct: surveyData.whyNotSellNewProduct,
        timeToSellNewProduct: surveyData.timeToSellNewProduct || null,
        newProductImportQuantity: parseVND(surveyData.newProductImportQuantity),
        importedBySalesperson: surveyData.importedBySalesperson,
        newProductSellingPrice: parseVND(surveyData.newProductSellingPrice),
        futureImportPrediction: surveyData.futureImportPrediction
          ? parseVND(surveyData.futureImportPrediction)
          : null,
        products: surveyData.products.map((p) => ({
          productType: p.productType,
          cementProductId: p.cementProductId,
          sellingPrice: p.sellingPrice ? parseVND(p.sellingPrice) : null,
        })),
      });

      alert("Thực thi cửa hàng thành công");
      navigate(`/stores/${storeId}`);
    } catch (error: any) {
      console.error("Error submitting survey:", error);
      const errorMessage =
        error?.response?.data?.error ||
        error?.message ||
        "Có lỗi xảy ra khi lưu khảo sát";
      alert(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          backgroundColor: colors.background,
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            border: `4px solid ${colors.icon}20`,
            borderTop: `4px solid ${colors.primary}`,
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
      </div>
    );
  }

  return (
    <div className="store-survey-container" style={{ backgroundColor: colors.background }}>
      <div className="store-survey-header">
        <button
          className="store-survey-back-button"
          onClick={() => navigate(-1)}
          style={{ color: colors.primary }}
        >
          ← Quay lại
        </button>
        <h1 className="store-survey-title" style={{ color: colors.text }}>
          Khảo sát cửa hàng
        </h1>
      </div>

      <div className="store-survey-content">
        {/* Title 1 */}
        <div className="store-survey-title-section">
          <div
            className="store-survey-title-header"
            onClick={() => toggleTitle("title1")}
            style={{ backgroundColor: colors.card }}
          >
            <h2 style={{ color: colors.text }}>
              Cửa hàng bán sản phẩm không phải của Xi Măng Tây Đô
            </h2>
            <span style={{ color: colors.icon }}>
              {expandedTitles.title1 ? "▲" : "▼"}
            </span>
          </div>

          {expandedTitles.title1 && (
            <div className="store-survey-title-content" style={{ backgroundColor: colors.card }}>
              {/* Loại xi măng */}
              <div className="store-survey-field">
                <label style={{ color: colors.text }}>Loại xi măng *</label>
                <select
                  value={surveyData.cementProductId || ""}
                  onChange={(e) =>
                    handleInputChange(
                      "cementProductId",
                      e.target.value ? parseInt(e.target.value) : null
                    )
                  }
                  style={{
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.icon + "40",
                  }}
                >
                  <option value="">Chọn loại xi măng</option>
                  {cementProducts.map((product) => (
                    <option key={product.Id} value={product.Id}>
                      {product.Code} - {product.Name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 6 trường sau khi chọn loại xi măng */}
              {surveyData.cementProductId && (
                <>
                  <div className="store-survey-field">
                    <label style={{ color: colors.text }}>Người tiếp xúc *</label>
                    <input
                      type="text"
                      value={surveyData.contactPerson}
                      onChange={(e) => handleInputChange("contactPerson", e.target.value)}
                      style={{
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderColor: colors.icon + "40",
                      }}
                    />
                  </div>

                  <div className="store-survey-field">
                    <label style={{ color: colors.text }}>Giá mua vào *</label>
                    <input
                      type="text"
                      value={surveyData.purchasePrice}
                      onChange={(e) => handlePriceChange("purchasePrice", e.target.value)}
                      placeholder="Nhập giá (VND)"
                      style={{
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderColor: colors.icon + "40",
                      }}
                    />
                  </div>

                  <div className="store-survey-field">
                    <label style={{ color: colors.text }}>Giá bán ra *</label>
                    <input
                      type="text"
                      value={surveyData.sellingPrice}
                      onChange={(e) => handlePriceChange("sellingPrice", e.target.value)}
                      placeholder="Nhập giá (VND)"
                      style={{
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderColor: colors.icon + "40",
                      }}
                    />
                  </div>

                  <div className="store-survey-field">
                    <label style={{ color: colors.text }}>Nhập NPP nào? *</label>
                    <input
                      type="text"
                      value={surveyData.supplierName}
                      onChange={(e) => handleInputChange("supplierName", e.target.value)}
                      style={{
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderColor: colors.icon + "40",
                      }}
                    />
                  </div>

                  <div className="store-survey-field">
                    <label style={{ color: colors.text }}>Phí code đường bộ *</label>
                    <input
                      type="text"
                      value={surveyData.roadTransportFee}
                      onChange={(e) => handlePriceChange("roadTransportFee", e.target.value)}
                      placeholder="Nhập giá (VND)"
                      style={{
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderColor: colors.icon + "40",
                      }}
                    />
                  </div>

                  <div className="store-survey-field">
                    <label style={{ color: colors.text }}>Phí code đường thủy *</label>
                    <input
                      type="text"
                      value={surveyData.waterTransportFee}
                      onChange={(e) => handlePriceChange("waterTransportFee", e.target.value)}
                      placeholder="Nhập giá (VND)"
                      style={{
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderColor: colors.icon + "40",
                      }}
                    />
                  </div>
                </>
              )}

              {/* Các trường khác */}
              <div className="store-survey-field">
                <label style={{ color: colors.text }}>Số lượng nhập/xuất *</label>
                <input
                  type="text"
                  value={surveyData.importExportQuantity}
                  onChange={(e) => handleInputChange("importExportQuantity", e.target.value)}
                  style={{
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.icon + "40",
                  }}
                />
              </div>

              <div className="store-survey-field">
                <label style={{ color: colors.text }}>Số sản phẩm tồn kho *</label>
                <input
                  type="text"
                  value={surveyData.stockQuantity}
                  onChange={(e) => handleInputChange("stockQuantity", e.target.value)}
                  style={{
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.icon + "40",
                  }}
                />
              </div>

              <div className="store-survey-field">
                <label style={{ color: colors.text }}>Vùng đang tiêu thụ *</label>
                <input
                  type="text"
                  value={surveyData.consumptionArea}
                  onChange={(e) => handleInputChange("consumptionArea", e.target.value)}
                  style={{
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.icon + "40",
                  }}
                />
              </div>

              <div className="store-survey-field">
                <label style={{ color: colors.text }}>Công nợ bao lâu *</label>
                <input
                  type="text"
                  value={surveyData.debtPeriod}
                  onChange={(e) => handleInputChange("debtPeriod", e.target.value)}
                  style={{
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.icon + "40",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Title 2 */}
        <div className="store-survey-title-section">
          <div
            className="store-survey-title-header"
            onClick={() => toggleTitle("title2")}
            style={{ backgroundColor: colors.card }}
          >
            <h2 style={{ color: colors.text }}>Khảo sát sản phẩm của XMTĐ</h2>
            <span style={{ color: colors.icon }}>
              {expandedTitles.title2 ? "▲" : "▼"}
            </span>
          </div>

          {expandedTitles.title2 && (
            <div className="store-survey-title-content" style={{ backgroundColor: colors.card }}>
              <div className="store-survey-field">
                <label style={{ color: colors.text }}>Tại sao không bán sản phẩm mới *</label>
                <textarea
                  value={surveyData.whyNotSellNewProduct}
                  onChange={(e) => handleInputChange("whyNotSellNewProduct", e.target.value)}
                  rows={3}
                  style={{
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.icon + "40",
                  }}
                />
              </div>

              <div className="store-survey-field">
                <label style={{ color: colors.text }}>Thời gian để bán sản phẩm mới *</label>
                <input
                  type="date"
                  value={surveyData.timeToSellNewProduct}
                  onChange={(e) => handleInputChange("timeToSellNewProduct", e.target.value)}
                  style={{
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.icon + "40",
                  }}
                />
              </div>

              <div className="store-survey-field">
                <label style={{ color: colors.text }}>Số lượng nhập sản phẩm mới *</label>
                <input
                  type="text"
                  value={surveyData.newProductImportQuantity}
                  onChange={(e) =>
                    handlePriceChange("newProductImportQuantity", e.target.value)
                  }
                  placeholder="Nhập giá (VND)"
                  style={{
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.icon + "40",
                  }}
                />
              </div>

              <div className="store-survey-field">
                <label style={{ color: colors.text }}>Nhập bởi thương vụ *</label>
                <input
                  type="text"
                  value={surveyData.importedBySalesperson}
                  onChange={(e) => handleInputChange("importedBySalesperson", e.target.value)}
                  style={{
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.icon + "40",
                  }}
                />
              </div>

              <div className="store-survey-field">
                <label style={{ color: colors.text }}>Giá bán ra (sản phẩm mới) *</label>
                <input
                  type="text"
                  value={surveyData.newProductSellingPrice}
                  onChange={(e) =>
                    handlePriceChange("newProductSellingPrice", e.target.value)
                  }
                  placeholder="Nhập giá (VND)"
                  style={{
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.icon + "40",
                  }}
                />
              </div>

              <div className="store-survey-field">
                <label style={{ color: colors.text }}>
                  Dự đoán tương lai sẽ nhập bao nhiêu hàng của XMTĐ
                </label>
                <input
                  type="text"
                  value={surveyData.futureImportPrediction}
                  onChange={(e) => handleInputChange("futureImportPrediction", e.target.value)}
                  placeholder="Nhập giá (VND) - Không bắt buộc"
                  style={{
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.icon + "40",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Title 3 */}
        <div className="store-survey-title-section">
          <div
            className="store-survey-title-header"
            onClick={() => toggleTitle("title3")}
            style={{ backgroundColor: colors.card }}
          >
            <h2 style={{ color: colors.text }}>Thông tin bán hàng</h2>
            <span style={{ color: colors.icon }}>
              {expandedTitles.title3 ? "▲" : "▼"}
            </span>
          </div>

          {expandedTitles.title3 && (
            <div className="store-survey-title-content" style={{ backgroundColor: colors.card }}>
              {surveyData.products.map((product, index) => (
                <div key={index} className="store-survey-product-item">
                  <h3 style={{ color: colors.text }}>Sản phẩm {index + 1}</h3>

                  <div className="store-survey-field">
                    <label style={{ color: colors.text }}>Sản phẩm được bán *</label>
                    <select
                      value={product.productType}
                      onChange={(e) =>
                        handleProductChange(index, "productType", e.target.value)
                      }
                      style={{
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderColor: colors.icon + "40",
                      }}
                    >
                      <option value="">Chọn sản phẩm</option>
                      {PRODUCT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  {product.productType === "Xi măng" && (
                    <div className="store-survey-field">
                      <label style={{ color: colors.text }}>Loại xi măng *</label>
                      <select
                        value={product.cementProductId || ""}
                        onChange={(e) =>
                          handleProductChange(
                            index,
                            "cementProductId",
                            e.target.value ? parseInt(e.target.value) : null
                          )
                        }
                        style={{
                          backgroundColor: colors.background,
                          color: colors.text,
                          borderColor: colors.icon + "40",
                        }}
                      >
                        <option value="">Chọn loại xi măng</option>
                        {cementProducts.map((cp) => (
                          <option key={cp.Id} value={cp.Id}>
                            {cp.Code} - {cp.Name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="store-survey-field">
                    <label style={{ color: colors.text }}>Giá bán ra *</label>
                    <input
                      type="text"
                      value={product.sellingPrice}
                      onChange={(e) => {
                        const formatted = formatVND(e.target.value);
                        handleProductChange(index, "sellingPrice", formatted);
                      }}
                      placeholder="Nhập giá (VND)"
                      style={{
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderColor: colors.icon + "40",
                      }}
                    />
                  </div>
                </div>
              ))}

              <button
                className="store-survey-add-product-button"
                onClick={handleAddProduct}
                style={{
                  backgroundColor: colors.primary,
                  color: "#fff",
                }}
              >
                + Thêm sản phẩm
              </button>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          className="store-survey-submit-button"
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            backgroundColor: submitting ? colors.icon + "40" : colors.primary,
            color: "#fff",
          }}
        >
          {submitting ? "Đang xử lý..." : "Hoàn thành"}
        </button>
      </div>
    </div>
  );
};

export default StoreSurvey;


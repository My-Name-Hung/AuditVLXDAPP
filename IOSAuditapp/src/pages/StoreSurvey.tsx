import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
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
  // Title 2
  whyNotSellNewProduct: string;
  timeToSellNewProduct: string;
  newProductImportQuantity: string;
  supplierName: string;
  importedBySalesperson: string;
  storeComment: string;
  // Title 3
  products: Array<{
    productType: string;
    cementProductId: number | null;
    contactPersonPhone: string;
    purchasePrice: string;
    sellingPrice: string;
    roadTransportFee: string;
    waterTransportFee: string;
    quantityReceived: string;
    importedFromNPP: string;
    discountPromotion: string;
    averageStockQuantity: string;
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

// Không giới hạn 1–10000, chỉ dùng format VND cho dễ đọc
const PRODUCT_TYPES = ["Xi măng", "Cát", "Đá"];

// Price suggestions (30,000 - 100,000 VND)
const PRICE_SUGGESTIONS = [
  30000, 40000, 50000, 60000, 70000, 80000, 90000, 100000,
];

const formatVND = (value: string): string => {
  // Chỉ giữ lại ký tự số, tránh lỗi khi nhập
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return "";
  const formatted = Number(digits).toLocaleString("vi-VN");
  return formatted;
};

const parseVND = (value: string): number => {
  const digits = value.replace(/[^\d]/g, "");
  return Number(digits) || 0;
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
  const [cementSearch, setCementSearch] = useState("");
  const [showAddCementModal, setShowAddCementModal] = useState(false);
  const [newCementName, setNewCementName] = useState("");

  const [salesUsers, setSalesUsers] = useState<
    Array<{ Id: number; FullName: string }>
  >([]);
  const [salesSearch, setSalesSearch] = useState("");

  const [productTypes, setProductTypes] = useState<string[]>(PRODUCT_TYPES);
  const [showAddProductTypeModal, setShowAddProductTypeModal] = useState(false);
  const [newProductTypeName, setNewProductTypeName] = useState("");
  const [showPriceSuggestions, setShowPriceSuggestions] = useState<{
    productIndex: number;
    field:
      | "purchasePrice"
      | "sellingPrice"
      | "roadTransportFee"
      | "waterTransportFee";
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expandedTitles, setExpandedTitles] = useState({
    title2: false,
    title3: false,
  });
  const [expandedProducts, setExpandedProducts] = useState<
    Record<number, boolean>
  >({});

  const [surveyData, setSurveyData] = useState<SurveyData>({
    whyNotSellNewProduct: "",
    timeToSellNewProduct: "",
    newProductImportQuantity: "",
    supplierName: "",
    importedBySalesperson: "",
    storeComment: "",
    products: [],
  });

  useEffect(() => {
    fetchCementProducts();
    fetchSalesUsers();
  }, []);

  // Autofill current user into "Nhập bởi thương vụ"
  useEffect(() => {
    if (user && user.fullName && !surveyData.importedBySalesperson) {
      handleInputChange("importedBySalesperson", user.fullName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Auto-expand title 2 on mount
  useEffect(() => {
    if (!expandedTitles.title2) {
      setExpandedTitles((prev) => ({ ...prev, title2: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Auto-expand title 3 if title 2 is complete
    const title2Complete =
      surveyData.whyNotSellNewProduct &&
      surveyData.timeToSellNewProduct &&
      surveyData.newProductImportQuantity &&
      surveyData.importedBySalesperson;

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

  const fetchSalesUsers = async () => {
    try {
      const response = await api.get("/users", {
        params: { page: 1, pageSize: 1000 },
      });
      const data = response.data?.data || [];
      setSalesUsers(
        data.map((u: { Id: number; FullName?: string; Username?: string }) => ({
          Id: u.Id,
          FullName: u.FullName || u.Username || "",
        }))
      );
    } catch (error) {
      console.error("Error fetching users for sales dropdown:", error);
    }
  };

  const filteredCementProducts = cementProducts.filter((product) =>
    product.Name.toLowerCase().includes(cementSearch.toLowerCase())
  );

  const filteredSalesUsers = salesUsers.filter((user) =>
    (user.FullName || "").toLowerCase().includes(salesSearch.toLowerCase())
  );

  const toggleTitle = (title: "title2" | "title3") => {
    setExpandedTitles((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  const toggleProduct = (index: number) => {
    setExpandedProducts((prev) => ({
      ...prev,
      [index]: !prev[index],
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

  const handleProductPriceChange = (
    index: number,
    field:
      | "purchasePrice"
      | "sellingPrice"
      | "roadTransportFee"
      | "waterTransportFee",
    value: string
  ) => {
    const formatted = formatVND(value);
    handleProductChange(index, field, formatted);
  };

  const handleAddProduct = () => {
    const newIndex = surveyData.products.length;
    setSurveyData((prev) => ({
      ...prev,
      products: [
        ...prev.products,
        {
          productType: "",
          cementProductId: null,
          contactPersonPhone: "",
          purchasePrice: "",
          sellingPrice: "",
          roadTransportFee: "",
          waterTransportFee: "",
          quantityReceived: "",
          importedFromNPP: "",
          discountPromotion: "",
          averageStockQuantity: "",
        },
      ],
    }));
    // Auto-expand new product
    setExpandedProducts((prev) => ({
      ...prev,
      [newIndex]: true,
    }));
  };

  const handleRemoveProduct = (index: number) => {
    setSurveyData((prev) => {
      const newProducts = prev.products.filter((_, i) => i !== index);
      return {
        ...prev,
        products: newProducts,
      };
    });
    // Remove from expanded state
    setExpandedProducts((prev) => {
      const newExpanded = { ...prev };
      delete newExpanded[index];
      // Reindex remaining products
      const reindexed: Record<number, boolean> = {};
      Object.keys(newExpanded).forEach((key) => {
        const oldIndex = parseInt(key);
        if (oldIndex > index) {
          reindexed[oldIndex - 1] = newExpanded[oldIndex];
        } else if (oldIndex < index) {
          reindexed[oldIndex] = newExpanded[oldIndex];
        }
      });
      return reindexed;
    });
  };

  const handleProductChange = (
    index: number,
    field:
      | "productType"
      | "cementProductId"
      | "contactPersonPhone"
      | "purchasePrice"
      | "sellingPrice"
      | "roadTransportFee"
      | "waterTransportFee"
      | "quantityReceived"
      | "importedFromNPP"
      | "discountPromotion"
      | "averageStockQuantity",
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

    // Title 2 validation
    if (!surveyData.whyNotSellNewProduct)
      errors.push("Tại sao không bán sản phẩm mới");
    if (!surveyData.timeToSellNewProduct)
      errors.push("Thời gian để bán sản phẩm mới");
    if (!surveyData.newProductImportQuantity)
      errors.push("Tên sản phẩm muốn nhập – Số lượng (nếu có)");
    if (!surveyData.supplierName) errors.push("Mua qua NPP");
    if (!surveyData.importedBySalesperson) errors.push("Nhập bởi thương vụ");

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
        if (!product.contactPersonPhone) {
          errors.push(`Sản phẩm ${index + 1}: Tên + SDT`);
        }
        if (!product.purchasePrice) {
          errors.push(`Sản phẩm ${index + 1}: Giá mua vào`);
        }
        if (!product.sellingPrice) {
          errors.push(`Sản phẩm ${index + 1}: Giá bán ra`);
        }
        if (!product.roadTransportFee) {
          errors.push(`Sản phẩm ${index + 1}: Phí vận chuyển đường bộ`);
        }
        if (!product.waterTransportFee) {
          errors.push(`Sản phẩm ${index + 1}: Phí vận chuyển đường thủy`);
        }
        if (!product.quantityReceived) {
          errors.push(`Sản phẩm ${index + 1}: Số lượng nhận hàng (tấn/tháng)`);
        }
        if (!product.importedFromNPP) {
          errors.push(`Sản phẩm ${index + 1}: Nhập từ NPP`);
        }
        if (!product.averageStockQuantity) {
          errors.push(
            `Sản phẩm ${index + 1}: Số lượng tồn bình quân (tấn/tháng)`
          );
        }
      });
    }

    return errors;
  };

  const handleSubmit = async () => {
    const errors = validateSurvey();
    if (errors.length > 0) {
      const errorMessage = `Vui lòng điền đầy đủ các trường sau:\n${errors.join(
        "\n"
      )}`;
      if (
        window.confirm(
          errorMessage + "\n\nBạn có muốn tiếp tục hoàn thành không?"
        )
      ) {
        await submitSurvey();
      }
    } else {
      await submitSurvey();
    }
  };

  const submitSurvey = async () => {
    if (!user || !storeId || !capturedImages || capturedImages.length !== 3) {
      alert("Lỗi: Thiếu thông tin cần thiết");
      return;
    }

    const parsedStoreId =
      typeof storeId === "string" ? parseInt(storeId) : storeId;
    if (isNaN(parsedStoreId)) {
      alert("Lỗi: ID cửa hàng không hợp lệ");
      return;
    }

    setSubmitting(true);

    try {
      // Step 1: Create audit
      const auditResponse = await api.post("/audits", {
        userId: user.id,
        storeId: parsedStoreId,
        notes: notes.trim() || null,
        auditDate: new Date().toISOString(),
      });

      const auditId = auditResponse.data.Id;

      // Step 2: Upload all images in parallel (much faster than sequential)
      const imagesToUpload = capturedImages.filter(
        (img): img is NonNullable<typeof img> =>
          img !== undefined && img !== null
      );

      const imageUploadPromises = imagesToUpload.map(async (img, i) => {
        const formData = new FormData();
        const blob = await fetch(img.dataUrl).then((r) => r.blob());
        formData.append("image", blob, `image_${i + 1}.jpg`);
        formData.append("auditId", auditId.toString());
        formData.append("latitude", img.latitude.toString());
        formData.append("longitude", img.longitude.toString());
        formData.append("timestamp", img.timestamp);
        formData.append("timezoneOffset", img.timezoneOffset.toString());

        return api.post("/images/upload", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      });

      // Step 3: Create survey (can run in parallel with image uploads)
      const surveyPromise = api.post("/store-surveys", {
        storeId: parsedStoreId,
        auditId: auditId,
        userId: user.id,
        whyNotSellNewProduct: surveyData.whyNotSellNewProduct,
        timeToSellNewProduct: surveyData.timeToSellNewProduct || null,
        newProductImportQuantity: parseVND(surveyData.newProductImportQuantity),
        supplierName: surveyData.supplierName,
        importedBySalesperson: surveyData.importedBySalesperson,
        storeComment: surveyData.storeComment || null,
        products: surveyData.products.map((p) => ({
          productType: p.productType,
          cementProductId: p.cementProductId,
          contactPersonPhone: p.contactPersonPhone,
          purchasePrice: p.purchasePrice ? parseVND(p.purchasePrice) : null,
          sellingPrice: p.sellingPrice ? parseVND(p.sellingPrice) : null,
          roadTransportFee: p.roadTransportFee
            ? parseVND(p.roadTransportFee)
            : null,
          waterTransportFee: p.waterTransportFee
            ? parseVND(p.waterTransportFee)
            : null,
          quantityReceived: p.quantityReceived
            ? parseFloat(p.quantityReceived)
            : null,
          importedFromNPP: p.importedFromNPP,
          discountPromotion: p.discountPromotion || null,
          averageStockQuantity: p.averageStockQuantity
            ? parseFloat(p.averageStockQuantity)
            : null,
        })),
      });

      // Execute image uploads and survey creation in parallel
      await Promise.all([...imageUploadPromises, surveyPromise]);

      // Success - navigate back to store detail
      alert("Thành công: Thực thi cửa hàng thành công");
      // Navigate back and refresh store detail to show new images
      navigate(`/stores/${parsedStoreId}`, { replace: true });
      // Small delay to ensure navigation completes before refresh
      setTimeout(() => {
        // The store detail page should automatically refresh on mount
        window.location.reload();
      }, 100);
    } catch (error: unknown) {
      console.error("Error submitting survey:", error);
      const errorMessage =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ||
        (error as { message?: string })?.message ||
        "Có lỗi xảy ra khi lưu khảo sát";
      alert(`Lỗi: ${errorMessage}`);
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
    <div
      className="store-survey-container"
      style={{ backgroundColor: colors.background }}
    >
      <div className="store-survey-header">
        <button
          className="store-survey-back-button"
          onClick={() => navigate(-1)}
          style={{ color: colors.primary }}
        >
          ← Quay lại
        </button>
        <h1 className="store-survey-title" style={{ color: colors.primary }}>
          Khảo sát cửa hàng
        </h1>
      </div>

      <div className="store-survey-content">
        {/* Title 2 */}
        <div className="store-survey-title-section">
          <div
            className="store-survey-title-header"
            onClick={() => toggleTitle("title2")}
            style={{
              background: expandedTitles.title2
                ? `linear-gradient(90deg, ${colors.primary}, ${colors.primary}CC)`
                : colors.background,
            }}
          >
            <h2 style={{ color: expandedTitles.title2 ? "#fff" : colors.text }}>
              Khảo sát sản phẩm của XMTĐ *
            </h2>
            <span
              style={{ color: expandedTitles.title2 ? "#fff" : colors.icon }}
            >
              {expandedTitles.title2 ? "▲" : "▼"}
            </span>
          </div>

          {expandedTitles.title2 && (
            <div
              className="store-survey-title-content"
              style={{ backgroundColor: colors.secondary }}
            >
              <div className="store-survey-field" style={{ marginTop: 16 }}>
                <label style={{ color: colors.text }}>
                  Tại sao không bán sản phẩm mới
                </label>
                <textarea
                  value={surveyData.whyNotSellNewProduct}
                  onChange={(e) =>
                    handleInputChange("whyNotSellNewProduct", e.target.value)
                  }
                  rows={3}
                  style={{
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.icon + "40",
                  }}
                />
              </div>

              <div className="store-survey-field">
                <label style={{ color: colors.text }}>
                  Thời gian để bán sản phẩm mới
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="date"
                    value={surveyData.timeToSellNewProduct}
                    onChange={(e) =>
                      handleInputChange("timeToSellNewProduct", e.target.value)
                    }
                    style={{
                      backgroundColor: colors.background,
                      color: colors.text,
                      borderColor: colors.icon + "40",
                      width: "100%",
                      paddingRight: 40,
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                      color: colors.icon,
                      fontSize: 18,
                    }}
                  >
                    📅
                  </span>
                </div>
              </div>

              <div className="store-survey-field">
                <label style={{ color: colors.text }}>
                  Tên sản phẩm muốn nhập – Số lượng (nếu có)
                </label>
                <input
                  type="text"
                  value={surveyData.newProductImportQuantity}
                  onChange={(e) =>
                    handleInputChange(
                      "newProductImportQuantity",
                      e.target.value
                    )
                  }
                  placeholder="Nhập tên sản phẩm và số lượng"
                  style={{
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.icon + "40",
                  }}
                />
              </div>

              <div className="store-survey-field">
                <label style={{ color: colors.text }}>Mua qua NPP</label>
                <input
                  type="text"
                  value={surveyData.supplierName}
                  onChange={(e) =>
                    handleInputChange("supplierName", e.target.value)
                  }
                  placeholder="Nhập tên NPP"
                  style={{
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.icon + "40",
                  }}
                />
              </div>

              <div className="store-survey-field">
                <label style={{ color: colors.text }}>Nhập bởi thương vụ</label>
                <input
                  type="text"
                  placeholder="Tìm kiếm thương vụ"
                  value={salesSearch}
                  onChange={(e) => setSalesSearch(e.target.value)}
                  style={{
                    marginBottom: 8,
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.icon + "40",
                  }}
                />
                <select
                  value={surveyData.importedBySalesperson}
                  onChange={(e) =>
                    handleInputChange("importedBySalesperson", e.target.value)
                  }
                  style={{
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.icon + "40",
                  }}
                >
                  <option value="">Chọn thương vụ</option>
                  {filteredSalesUsers.map((user) => (
                    <option key={user.Id} value={user.FullName}>
                      {user.FullName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="store-survey-field">
                <label style={{ color: colors.text }}>
                  Ý kiến của cửa hàng
                </label>
                <textarea
                  value={surveyData.storeComment}
                  onChange={(e) =>
                    handleInputChange("storeComment", e.target.value)
                  }
                  placeholder="Nhập ý kiến của cửa hàng (không bắt buộc)"
                  rows={3}
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
            style={{
              background: expandedTitles.title3
                ? `linear-gradient(90deg, ${colors.primary}, ${colors.primary}CC)`
                : colors.background,
            }}
          >
            <h2 style={{ color: expandedTitles.title3 ? "#fff" : colors.text }}>
              Thông tin bán hàng *
            </h2>
            <span
              style={{ color: expandedTitles.title3 ? "#fff" : colors.icon }}
            >
              {expandedTitles.title3 ? "▲" : "▼"}
            </span>
          </div>

          {expandedTitles.title3 && (
            <div
              className="store-survey-title-content"
              style={{ backgroundColor: colors.secondary, paddingTop: 16 }}
            >
              {surveyData.products.map((product, index) => (
                <div
                  key={index}
                  className="store-survey-product-item"
                  style={{
                    border: `2px solid ${colors.primary}40`,
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 16,
                    marginTop: index === 0 ? 0 : 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 16,
                    }}
                  >
                    <h3 style={{ color: colors.text, margin: 0 }}>
                      Sản phẩm {index + 1}
                    </h3>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => toggleProduct(index)}
                        style={{
                          background: "none",
                          border: "none",
                          color: colors.primary,
                          cursor: "pointer",
                          fontSize: 18,
                        }}
                      >
                        {expandedProducts[index] ? "▼" : "▶"}
                      </button>
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveProduct(index)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#ff4444",
                            cursor: "pointer",
                            fontSize: 18,
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>

                  {expandedProducts[index] !== false && (
                    <>
                      <div className="store-survey-field">
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <label style={{ color: colors.text }}>
                            Sản phẩm được bán
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setNewProductTypeName("");
                              setShowAddProductTypeModal(true);
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              color: colors.primary,
                              fontWeight: 600,
                              fontSize: 13,
                              cursor: "pointer",
                            }}
                          >
                            + Thêm sản phẩm
                          </button>
                        </div>
                        <select
                          value={product.productType}
                          onChange={(e) =>
                            handleProductChange(
                              index,
                              "productType",
                              e.target.value
                            )
                          }
                          style={{
                            backgroundColor: colors.background,
                            color: colors.text,
                            borderColor: colors.icon + "40",
                            width: "100%",
                          }}
                        >
                          <option value="">Chọn sản phẩm</option>
                          {productTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </div>

                      {product.productType === "Xi măng" && (
                        <div className="store-survey-field">
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <label style={{ color: colors.text }}>
                              Loại xi măng
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setNewCementName("");
                                setShowAddCementModal(true);
                              }}
                              style={{
                                background: "none",
                                border: "none",
                                color: colors.primary,
                                fontWeight: 600,
                                fontSize: 13,
                                cursor: "pointer",
                              }}
                            >
                              + Thêm loại xi măng
                            </button>
                          </div>
                          <input
                            type="text"
                            placeholder="Tìm kiếm loại xi măng"
                            value={cementSearch}
                            onChange={(e) => setCementSearch(e.target.value)}
                            style={{
                              marginBottom: 8,
                              backgroundColor: colors.background,
                              color: colors.text,
                              borderColor: colors.icon + "40",
                            }}
                          />
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
                              width: "100%",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={
                              product.cementProductId
                                ? cementProducts.find(
                                    (p) => p.Id === product.cementProductId
                                  )?.Name || ""
                                : ""
                            }
                          >
                            <option value="">Chọn loại xi măng</option>
                            {filteredCementProducts.map((cp) => (
                              <option key={cp.Id} value={cp.Id}>
                                {cp.Name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="store-survey-field">
                        <label style={{ color: colors.text }}>Tên + SDT</label>
                        <input
                          type="text"
                          value={product.contactPersonPhone}
                          onChange={(e) =>
                            handleProductChange(
                              index,
                              "contactPersonPhone",
                              e.target.value
                            )
                          }
                          placeholder="VD: Nguyễn A – 0909xxxx"
                          style={{
                            backgroundColor: colors.background,
                            color: colors.text,
                            borderColor: colors.icon + "40",
                          }}
                        />
                      </div>

                      <div className="store-survey-field">
                        <label style={{ color: colors.text }}>
                          Giá mua vào
                        </label>
                        <div style={{ position: "relative" }}>
                          <input
                            type="text"
                            value={product.purchasePrice}
                            onChange={(e) =>
                              handleProductPriceChange(
                                index,
                                "purchasePrice",
                                e.target.value
                              )
                            }
                            onFocus={() =>
                              setShowPriceSuggestions({
                                productIndex: index,
                                field: "purchasePrice",
                              })
                            }
                            placeholder="Nhập giá (VND)"
                            style={{
                              backgroundColor: colors.background,
                              color: colors.text,
                              borderColor: colors.icon + "40",
                              paddingRight: "40px",
                              width: "100%",
                            }}
                          />
                          <span
                            style={{
                              position: "absolute",
                              right: "12px",
                              top: "50%",
                              transform: "translateY(-50%)",
                              color: colors.icon,
                              cursor: "pointer",
                            }}
                            onClick={() =>
                              setShowPriceSuggestions(
                                showPriceSuggestions?.productIndex === index &&
                                  showPriceSuggestions?.field ===
                                    "purchasePrice"
                                  ? null
                                  : {
                                      productIndex: index,
                                      field: "purchasePrice",
                                    }
                              )
                            }
                          >
                            ▼
                          </span>
                          {showPriceSuggestions?.productIndex === index &&
                            showPriceSuggestions?.field === "purchasePrice" && (
                              <div
                                className="price-suggestions-dropdown"
                                style={{
                                  backgroundColor: colors.background,
                                  borderColor: colors.icon + "40",
                                }}
                              >
                                {PRICE_SUGGESTIONS.map((price) => (
                                  <div
                                    key={price}
                                    className="price-suggestion-item"
                                    style={{
                                      borderBottomColor: colors.icon + "20",
                                    }}
                                    onClick={() => {
                                      handleProductPriceChange(
                                        index,
                                        "purchasePrice",
                                        formatVND(price.toString())
                                      );
                                      setShowPriceSuggestions(null);
                                    }}
                                  >
                                    {price.toLocaleString("vi-VN")} VND
                                  </div>
                                ))}
                              </div>
                            )}
                        </div>
                      </div>

                      <div className="store-survey-field">
                        <label style={{ color: colors.text }}>Giá bán ra</label>
                        <div style={{ position: "relative" }}>
                          <input
                            type="text"
                            value={product.sellingPrice}
                            onChange={(e) =>
                              handleProductPriceChange(
                                index,
                                "sellingPrice",
                                e.target.value
                              )
                            }
                            onFocus={() =>
                              setShowPriceSuggestions({
                                productIndex: index,
                                field: "sellingPrice",
                              })
                            }
                            placeholder="Nhập giá (VND)"
                            style={{
                              backgroundColor: colors.background,
                              color: colors.text,
                              borderColor: colors.icon + "40",
                              paddingRight: "40px",
                              width: "100%",
                            }}
                          />
                          <span
                            style={{
                              position: "absolute",
                              right: "12px",
                              top: "50%",
                              transform: "translateY(-50%)",
                              color: colors.icon,
                              cursor: "pointer",
                            }}
                            onClick={() =>
                              setShowPriceSuggestions(
                                showPriceSuggestions?.productIndex === index &&
                                  showPriceSuggestions?.field === "sellingPrice"
                                  ? null
                                  : {
                                      productIndex: index,
                                      field: "sellingPrice",
                                    }
                              )
                            }
                          >
                            ▼
                          </span>
                          {showPriceSuggestions?.productIndex === index &&
                            showPriceSuggestions?.field === "sellingPrice" && (
                              <div
                                className="price-suggestions-dropdown"
                                style={{
                                  backgroundColor: colors.background,
                                  borderColor: colors.icon + "40",
                                }}
                              >
                                {PRICE_SUGGESTIONS.map((price) => (
                                  <div
                                    key={price}
                                    className="price-suggestion-item"
                                    style={{
                                      borderBottomColor: colors.icon + "20",
                                    }}
                                    onClick={() => {
                                      handleProductPriceChange(
                                        index,
                                        "sellingPrice",
                                        formatVND(price.toString())
                                      );
                                      setShowPriceSuggestions(null);
                                    }}
                                  >
                                    {price.toLocaleString("vi-VN")} VND
                                  </div>
                                ))}
                              </div>
                            )}
                        </div>
                      </div>

                      <div className="store-survey-field">
                        <label style={{ color: colors.text }}>
                          Phí vận chuyển đường bộ
                        </label>
                        <div style={{ position: "relative" }}>
                          <input
                            type="text"
                            value={product.roadTransportFee}
                            onChange={(e) =>
                              handleProductPriceChange(
                                index,
                                "roadTransportFee",
                                e.target.value
                              )
                            }
                            onFocus={() =>
                              setShowPriceSuggestions({
                                productIndex: index,
                                field: "roadTransportFee",
                              })
                            }
                            placeholder="Nhập giá (VND)"
                            style={{
                              backgroundColor: colors.background,
                              color: colors.text,
                              borderColor: colors.icon + "40",
                              paddingRight: "40px",
                              width: "100%",
                            }}
                          />
                          <span
                            style={{
                              position: "absolute",
                              right: "12px",
                              top: "50%",
                              transform: "translateY(-50%)",
                              color: colors.icon,
                              cursor: "pointer",
                            }}
                            onClick={() =>
                              setShowPriceSuggestions(
                                showPriceSuggestions?.productIndex === index &&
                                  showPriceSuggestions?.field ===
                                    "roadTransportFee"
                                  ? null
                                  : {
                                      productIndex: index,
                                      field: "roadTransportFee",
                                    }
                              )
                            }
                          >
                            ▼
                          </span>
                          {showPriceSuggestions?.productIndex === index &&
                            showPriceSuggestions?.field ===
                              "roadTransportFee" && (
                              <div
                                className="price-suggestions-dropdown"
                                style={{
                                  backgroundColor: colors.background,
                                  borderColor: colors.icon + "40",
                                }}
                              >
                                {PRICE_SUGGESTIONS.map((price) => (
                                  <div
                                    key={price}
                                    className="price-suggestion-item"
                                    style={{
                                      borderBottomColor: colors.icon + "20",
                                    }}
                                    onClick={() => {
                                      handleProductPriceChange(
                                        index,
                                        "roadTransportFee",
                                        formatVND(price.toString())
                                      );
                                      setShowPriceSuggestions(null);
                                    }}
                                  >
                                    {price.toLocaleString("vi-VN")} VND
                                  </div>
                                ))}
                              </div>
                            )}
                        </div>
                      </div>

                      <div className="store-survey-field">
                        <label style={{ color: colors.text }}>
                          Phí vận chuyển đường thủy
                        </label>
                        <div style={{ position: "relative" }}>
                          <input
                            type="text"
                            value={product.waterTransportFee}
                            onChange={(e) =>
                              handleProductPriceChange(
                                index,
                                "waterTransportFee",
                                e.target.value
                              )
                            }
                            onFocus={() =>
                              setShowPriceSuggestions({
                                productIndex: index,
                                field: "waterTransportFee",
                              })
                            }
                            placeholder="Nhập giá (VND)"
                            style={{
                              backgroundColor: colors.background,
                              color: colors.text,
                              borderColor: colors.icon + "40",
                              paddingRight: "40px",
                              width: "100%",
                            }}
                          />
                          <span
                            style={{
                              position: "absolute",
                              right: "12px",
                              top: "50%",
                              transform: "translateY(-50%)",
                              color: colors.icon,
                              cursor: "pointer",
                            }}
                            onClick={() =>
                              setShowPriceSuggestions(
                                showPriceSuggestions?.productIndex === index &&
                                  showPriceSuggestions?.field ===
                                    "waterTransportFee"
                                  ? null
                                  : {
                                      productIndex: index,
                                      field: "waterTransportFee",
                                    }
                              )
                            }
                          >
                            ▼
                          </span>
                          {showPriceSuggestions?.productIndex === index &&
                            showPriceSuggestions?.field ===
                              "waterTransportFee" && (
                              <div
                                className="price-suggestions-dropdown"
                                style={{
                                  backgroundColor: colors.background,
                                  borderColor: colors.icon + "40",
                                }}
                              >
                                {PRICE_SUGGESTIONS.map((price) => (
                                  <div
                                    key={price}
                                    className="price-suggestion-item"
                                    style={{
                                      borderBottomColor: colors.icon + "20",
                                    }}
                                    onClick={() => {
                                      handleProductPriceChange(
                                        index,
                                        "waterTransportFee",
                                        formatVND(price.toString())
                                      );
                                      setShowPriceSuggestions(null);
                                    }}
                                  >
                                    {price.toLocaleString("vi-VN")} VND
                                  </div>
                                ))}
                              </div>
                            )}
                        </div>
                      </div>

                      <div className="store-survey-field">
                        <label style={{ color: colors.text }}>
                          Số lượng nhận hàng (tấn/tháng)
                        </label>
                        <input
                          type="text"
                          value={product.quantityReceived}
                          onChange={(e) =>
                            handleProductChange(
                              index,
                              "quantityReceived",
                              e.target.value
                            )
                          }
                          placeholder="Nhập số lượng"
                          style={{
                            backgroundColor: colors.background,
                            color: colors.text,
                            borderColor: colors.icon + "40",
                          }}
                        />
                      </div>

                      <div className="store-survey-field">
                        <label style={{ color: colors.text }}>
                          Nhập từ NPP
                        </label>
                        <input
                          type="text"
                          value={product.importedFromNPP}
                          onChange={(e) =>
                            handleProductChange(
                              index,
                              "importedFromNPP",
                              e.target.value
                            )
                          }
                          placeholder="Nhập tên NPP"
                          style={{
                            backgroundColor: colors.background,
                            color: colors.text,
                            borderColor: colors.icon + "40",
                          }}
                        />
                      </div>

                      <div className="store-survey-field">
                        <label style={{ color: colors.text }}>
                          Chương trình chiết khấu - khuyến mãi (nếu có)
                        </label>
                        <input
                          type="text"
                          value={product.discountPromotion}
                          onChange={(e) =>
                            handleProductChange(
                              index,
                              "discountPromotion",
                              e.target.value
                            )
                          }
                          placeholder="Nhập thông tin chương trình"
                          style={{
                            backgroundColor: colors.background,
                            color: colors.text,
                            borderColor: colors.icon + "40",
                          }}
                        />
                      </div>

                      <div className="store-survey-field">
                        <label style={{ color: colors.text }}>
                          Số lượng tồn bình quân (tấn/tháng)
                        </label>
                        <input
                          type="text"
                          value={product.averageStockQuantity}
                          onChange={(e) =>
                            handleProductChange(
                              index,
                              "averageStockQuantity",
                              e.target.value
                            )
                          }
                          placeholder="Nhập số lượng tồn bình quân"
                          style={{
                            backgroundColor: colors.background,
                            color: colors.text,
                            borderColor: colors.icon + "40",
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
              ))}

              <button
                className="store-survey-add-product-button"
                onClick={handleAddProduct}
                style={{
                  backgroundColor: colors.primary,
                  color: "#fff",
                  width: "100%",
                  padding: "12px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 16,
                }}
              >
                + Thêm sản phẩm
              </button>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div
          style={{ display: "flex", justifyContent: "center", marginTop: 24 }}
        >
          <button
            className="store-survey-submit-button"
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              backgroundColor: submitting ? colors.icon + "40" : colors.primary,
              color: "#fff",
              padding: "14px 32px",
              borderRadius: 8,
              border: "none",
              cursor: submitting ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: 16,
            }}
          >
            {submitting
              ? "Đang xử lý..."
              : "Hoàn thành khảo sát & thực thi cửa hàng"}
          </button>
        </div>
      </div>

      {/* Modal thêm loại xi măng mới */}
      {showAddCementModal && (
        <div className="store-survey-modal-backdrop">
          <div className="store-survey-modal">
            <h2>Thêm loại xi măng mới</h2>
            <div className="store-survey-field">
              <label>Tên xi măng *</label>
              <input
                type="text"
                value={newCementName}
                onChange={(e) => setNewCementName(e.target.value)}
              />
            </div>
            <div className="store-survey-modal-actions">
              <button
                type="button"
                onClick={() => setShowAddCementModal(false)}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={async () => {
                  const trimmed = newCementName.trim();
                  if (!trimmed) {
                    alert("Vui lòng nhập tên xi măng");
                    return;
                  }
                  try {
                    await api.post("/cement-products", {
                      name: trimmed,
                    });
                    await fetchCementProducts();
                    setShowAddCementModal(false);
                  } catch (error: unknown) {
                    console.error("Error creating cement product:", error);
                    const message =
                      (error as { response?: { data?: { error?: string } } })
                        ?.response?.data?.error ||
                      (error as { message?: string })?.message ||
                      "Không thể thêm loại xi măng";
                    alert(message);
                  }
                }}
                style={{ backgroundColor: colors.primary, color: "#fff" }}
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal thêm sản phẩm mới (Title 3) */}
      {showAddProductTypeModal && (
        <div className="store-survey-modal-backdrop">
          <div className="store-survey-modal">
            <h2>Thêm sản phẩm mới</h2>
            <div className="store-survey-field">
              <label>Tên sản phẩm *</label>
              <input
                type="text"
                value={newProductTypeName}
                onChange={(e) => setNewProductTypeName(e.target.value)}
              />
            </div>
            <div className="store-survey-modal-actions">
              <button
                type="button"
                onClick={() => setShowAddProductTypeModal(false)}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  const trimmed = newProductTypeName.trim();
                  if (!trimmed) {
                    alert("Vui lòng nhập tên sản phẩm");
                    return;
                  }
                  setProductTypes((prev) =>
                    prev.includes(trimmed) ? prev : [...prev, trimmed]
                  );
                  setShowAddProductTypeModal(false);
                }}
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreSurvey;

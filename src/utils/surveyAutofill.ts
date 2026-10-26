/**
 * Utility cho autofill khảo sát cửa hàng (Mobile App - Expo)
 *
 * Nguồn dữ liệu mẫu: API GET /store-surveys/latest?storeId=&userId=
 * Trả về khảo sát mới nhất của cửa hàng (kèm products) để điền vào form cho tháng sau.
 */

export interface SurveyProductData {
  productType: string;
  cementProductId: number | null;
  contactPersonPhone: string;
  purchasePrice: string;
  sellingPrice: string;
  roadTransportFee: string;
  waterTransportFee: string;
  importedFromNPP: string;
  discountPromotion: string;
  averageStockQuantity: string;
}

export interface SurveyData {
  whyNotSellNewProduct: string;
  timeToSellNewProduct: string;
  newProductImportQuantity: string;
  supplierName: string;
  importedBySalesperson: string;
  storeComment: string;
  products: SurveyProductData[];
}

/** Shape dữ liệu trả về từ API (PascalCase theo SQL Server) */
export interface ApiSurvey {
  Id: number;
  StoreId: number;
  AuditId: number;
  UserId: number;
  SupplierName: string | null;
  WhyNotSellNewProduct: string | null;
  TimeToSellNewProduct: string | null;
  NewProductImportQuantity: string | null;
  ImportedBySalesperson: string | null;
  StoreComment: string | null;
  CreatedAt: string;
}

export interface ApiSurveyProduct {
  Id: number;
  StoreSurveyId: number;
  ProductType: string | null;
  CementProductId: number | null;
  ContactPersonPhone: string | null;
  PurchasePrice: number | string | null;
  SellingPrice: number | string | null;
  RoadTransportFee: number | string | null;
  WaterTransportFee: number | string | null;
  ImportedFromNPP: string | null;
  DiscountPromotion: string | null;
  AverageStockQuantity: number | string | null;
}

/**
 * Format số VND theo kiểu vi-VN (vd: 30000 -> "30,000")
 * Giống hệt logic formatVND trong trang StoreSurvey
 */
export const formatVND = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return "";
  const digits = String(value).replace(/[^\d]/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("vi-VN");
};

/**
 * Format số thập phân bỏ trailing zeros (vd: 100.00 -> "100", 12.50 -> "12.5")
 */
export const formatDecimal = (
  value: number | string | null | undefined
): string => {
  if (value === null || value === undefined) return "";
  const num = Number(value);
  if (isNaN(num)) return "";
  return String(num);
};

/**
 * Chuyển ngày giờ từ SQL Server sang ISO string cho DatePicker.
 * SQL Server trả về Date object (axios tự parse) hoặc string.
 */
const toDateString = (value: string | null | undefined): string => {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "";
  return date.toISOString();
};

/**
 * Chuyển 1 product từ API về format của form
 */
export const mapApiProductToForm = (p: ApiSurveyProduct): SurveyProductData => ({
  productType: p.ProductType || "Xi măng",
  cementProductId: p.CementProductId ?? null,
  contactPersonPhone: p.ContactPersonPhone || "",
  purchasePrice: formatVND(p.PurchasePrice),
  sellingPrice: formatVND(p.SellingPrice),
  roadTransportFee: formatVND(p.RoadTransportFee),
  waterTransportFee: formatVND(p.WaterTransportFee),
  importedFromNPP: p.ImportedFromNPP || "",
  discountPromotion: p.DiscountPromotion || "",
  averageStockQuantity: formatDecimal(p.AverageStockQuantity),
});

/**
 * Chuyển survey + products từ API về format của form.
 * Trả về null nếu không có survey nào.
 */
export const mapApiSurveyToForm = (
  survey: ApiSurvey | null,
  products: ApiSurveyProduct[] | null | undefined
): SurveyData | null => {
  if (!survey) return null;

  return {
    whyNotSellNewProduct: survey.WhyNotSellNewProduct || "",
    timeToSellNewProduct: toDateString(survey.TimeToSellNewProduct),
    newProductImportQuantity: survey.NewProductImportQuantity || "",
    supplierName: survey.SupplierName || "",
    importedBySalesperson: survey.ImportedBySalesperson || "",
    storeComment: survey.StoreComment || "",
    products: (products || []).map(mapApiProductToForm),
  };
};

/**
 * Merge nhiều survey (mới nhất trước) thành 1 form.
 *
 * Mỗi lần khảo sát user có thể chỉ điền một phần field, nên field bị trống ở
 * record mới nhất được lấp từ record cũ hơn. Field đầu tiên tìm thấy (mới nhất
 * trước) sẽ được giữ.
 *
 * - `surveys`: danh sách survey, ĐÃ SẮP XẾP MỚI NHẤT TRƯỚC
 * - `productsBySurveyId`: map StoreSurveyId -> products
 */
export const mergeApiSurveysToForm = (
  surveys: ApiSurvey[] | null | undefined,
  productsBySurveyId:
    | Record<string, ApiSurveyProduct[] | undefined>
    | null
    | undefined
): SurveyData | null => {
  if (!surveys || surveys.length === 0) return null;

  const merged: SurveyData = {
    whyNotSellNewProduct: "",
    timeToSellNewProduct: "",
    newProductImportQuantity: "",
    supplierName: "",
    importedBySalesperson: "",
    storeComment: "",
    products: [],
  };

  // Lấy products từ survey mới nhất có products
  for (const survey of surveys) {
    const products = productsBySurveyId?.[String(survey.Id)] || [];
    if (products.length > 0) {
      merged.products = products.map(mapApiProductToForm);
      break;
    }
  }

  // Lấp từng field từ survey mới nhất có giá trị
  for (const survey of surveys) {
    if (!merged.whyNotSellNewProduct && survey.WhyNotSellNewProduct) {
      merged.whyNotSellNewProduct = survey.WhyNotSellNewProduct;
    }
    if (!merged.timeToSellNewProduct && survey.TimeToSellNewProduct) {
      merged.timeToSellNewProduct = toDateString(survey.TimeToSellNewProduct);
    }
    if (
      !merged.newProductImportQuantity &&
      survey.NewProductImportQuantity
    ) {
      merged.newProductImportQuantity = survey.NewProductImportQuantity;
    }
    if (!merged.supplierName && survey.SupplierName) {
      merged.supplierName = survey.SupplierName;
    }
    if (!merged.importedBySalesperson && survey.ImportedBySalesperson) {
      merged.importedBySalesperson = survey.ImportedBySalesperson;
    }
    if (!merged.storeComment && survey.StoreComment) {
      merged.storeComment = survey.StoreComment;
    }
  }

  return merged;
};

/**
 * Key lưu trữ cờ "user đã xóa dữ liệu đã điền" -> không autofill lại từ DB
 */
export const getAutofillSkipKey = (userId: number, storeId: number): string =>
  `survey_autofill_skip_${userId}_${storeId}`;

/**
 * Key lưu trữ dữ liệu khảo sát đã điền (template)
 */
export const getSurveyDataKey = (userId: number, storeId: number): string =>
  `survey_data_${userId}_${storeId}`;

/**
 * Kiểm tra form có nội dung gì để quyết định có cần autofill từ DB không.
 *
 * `ignoreSalesperson`: bỏ qua field "Nhập bởi thương vụ" vì field này được hệ
 * thống tự điền từ user đang đăng nhập. Nếu tính field này thì form luôn được
 * coi là "đã có nội dung" và autofill từ DB sẽ không bao giờ chạy.
 */
export const hasSurveyContent = (
  data: SurveyData | null,
  options: { ignoreSalesperson?: boolean } = {}
): boolean => {
  if (!data) return false;
  const topLevel = [
    data.whyNotSellNewProduct,
    data.timeToSellNewProduct,
    data.newProductImportQuantity,
    data.supplierName,
    data.storeComment,
  ];
  if (!options.ignoreSalesperson) {
    topLevel.push(data.importedBySalesperson);
  }
  if (topLevel.some((v) => v && v.trim() !== "")) return true;

  return (data.products || []).some((p) =>
    Object.values(p || {}).some(
      (v) => v !== null && v !== undefined && `${v}`.trim() !== ""
    )
  );
};

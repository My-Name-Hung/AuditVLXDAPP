import { useAuth } from "@/src/contexts/AuthContext";
import { useSurvey } from "@/src/contexts/SurveyContext";
import { useTheme } from "@/src/contexts/ThemeContext";
import api from "@/src/services/api";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface CementProduct {
  Id: number;
  Code: string;
  Name: string;
}

interface SurveyData {
  whyNotSellNewProduct: string;
  timeToSellNewProduct: string;
  newProductImportQuantity: string;
  supplierName: string;
  importedBySalesperson: string;
  storeComment: string;
  products: {
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
  }[];
}

type PriceField =
  | "purchasePrice"
  | "sellingPrice"
  | "roadTransportFee"
  | "waterTransportFee";

const PRICE_FIELD_LABELS: Record<PriceField, string> = {
  purchasePrice: "Giá mua vào",
  sellingPrice: "Giá bán ra",
  roadTransportFee: "Phí vận chuyển đường bộ",
  waterTransportFee: "Phí vận chuyển đường thủy",
};

// Không áp ràng buộc 1–10000, chỉ format số VND cho đẹp
const PRODUCT_TYPES = ["Xi măng", "Cát", "Đá"];

// Price suggestions cho Giá mua vào / Giá bán ra (30,000 - 100,000 VND)
const PRICE_SUGGESTIONS = [
  30000, 40000, 50000, 60000, 70000, 80000, 90000, 100000,
];

// Price suggestions cho phí vận chuyển (3,000 - 10,000 VND)
const TRANSPORT_FEE_SUGGESTIONS = [
  3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000,
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

export default function StoreSurveyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const { capturedImages, notes, clearSurveyData } = useSurvey();

  const [cementProducts, setCementProducts] = useState<CementProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    current: 0,
    total: 0,
    message: "",
  });
  const [expandedTitles, setExpandedTitles] = useState({
    title2: false,
    title3: false,
  });
  const [expandedProducts, setExpandedProducts] = useState<
    Record<number, boolean>
  >({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [cementSearch, setCementSearch] = useState("");
  const [showProductTypePicker, setShowProductTypePicker] = useState<
    number | null
  >(null);
  const [showCementProductPicker, setShowCementProductPicker] = useState<
    number | null
  >(null);
  const [showAddCementModal, setShowAddCementModal] = useState(false);
  const [addCementForProductIndex, setAddCementForProductIndex] = useState<
    number | null
  >(null);
  const [newCementName, setNewCementName] = useState("");

  const [salesUsers, setSalesUsers] = useState<
    { Id: number; FullName: string }[]
  >([]);
  const [showSalesPicker, setShowSalesPicker] = useState(false);
  const [salesSearch, setSalesSearch] = useState("");

  const [productTypes, setProductTypes] = useState<string[]>(PRODUCT_TYPES);
  const [showAddProductTypeModal, setShowAddProductTypeModal] = useState(false);
  const [newProductTypeName, setNewProductTypeName] = useState("");
  const [priceOptions, setPriceOptions] = useState<number[]>(PRICE_SUGGESTIONS);
  const [transportFeeOptions, setTransportFeeOptions] = useState<number[]>(
    TRANSPORT_FEE_SUGGESTIONS
  );
  const [activePricePicker, setActivePricePicker] = useState<{
    productIndex: number;
    field: PriceField;
  } | null>(null);
  const [customPriceValue, setCustomPriceValue] = useState("");

  const [surveyData, setSurveyData] = useState<SurveyData>({
    whyNotSellNewProduct: "",
    timeToSellNewProduct: "",
    newProductImportQuantity: "",
    supplierName: "",
    importedBySalesperson: "",
    storeComment: "",
    products: [],
  });

  // Load saved survey data from AsyncStorage for autofill (form data, not audit results)
  useEffect(() => {
    const loadSavedSurveyData = async () => {
      try {
        if (user?.id) {
          const storageKey = `survey_data_${user.id}`;
          const savedData = await AsyncStorage.getItem(storageKey);
          if (savedData) {
            const parsed = JSON.parse(savedData);
            // Load form data for autofill, but clear contactPersonPhone (store-specific)
            setSurveyData({
              ...parsed,
              // Keep all form fields for autofill, only clear contactPersonPhone
              products:
                parsed.products?.map((p: any) => ({
                  ...p,
                  contactPersonPhone: "", // Clear only this field (store-specific)
                })) || [],
            });
          }
        }
      } catch (error) {
        console.error("Error loading saved survey data:", error);
      }
    };
    loadSavedSurveyData();
    fetchCementProducts();
    fetchSalesUsers();
  }, [user?.id]); // Remove id dependency to allow autofill across stores

  // Note: Auto-save removed to prevent saving store-specific data
  // Survey data is only saved after successful submission as a template

  // Autofill current user into "Nhập bởi thương vụ"
  useEffect(() => {
    if (user && user.fullName && !surveyData.importedBySalesperson) {
      handleInputChange("importedBySalesperson", user.fullName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Auto-expand title 3 on mount (after taking photos)
  useEffect(() => {
    if (!expandedTitles.title3) {
      setExpandedTitles((prev) => ({ ...prev, title3: true }));
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

  const handleAddProduct = () => {
    const newIndex = surveyData.products.length;
    // Autofill contactPersonPhone from first product if available
    const firstProductContact =
      surveyData.products[0]?.contactPersonPhone || "";
    setSurveyData((prev) => ({
      ...prev,
      products: [
        ...prev.products,
        {
          productType: "",
          cementProductId: null,
          contactPersonPhone: firstProductContact,
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

  const isTransportField = (field: PriceField) =>
    field === "roadTransportFee" || field === "waterTransportFee";

  const getOptionsForField = (field: PriceField) =>
    isTransportField(field) ? transportFeeOptions : priceOptions;

  const addCustomOption = (field: PriceField, numericValue: number) => {
    if (numericValue < 0) return;
    if (isTransportField(field)) {
      setTransportFeeOptions((prev) =>
        prev.includes(numericValue)
          ? prev
          : [...prev, numericValue].sort((a, b) => a - b)
      );
    } else {
      setPriceOptions((prev) =>
        prev.includes(numericValue)
          ? prev
          : [...prev, numericValue].sort((a, b) => a - b)
      );
    }
  };

  const openPricePicker = (productIndex: number, field: PriceField) => {
    const currentValue =
      surveyData.products[productIndex]?.[
        field as keyof SurveyData["products"][0]
      ] || "";
    setActivePricePicker({ productIndex, field });
    setCustomPriceValue(typeof currentValue === "string" ? currentValue : "");
  };

  const closePricePicker = () => {
    setActivePricePicker(null);
    setCustomPriceValue("");
  };

  const handleSelectPriceOption = (numericValue: number) => {
    if (!activePricePicker) return;
    const formatted = formatVND(numericValue.toString());
    handleProductChange(
      activePricePicker.productIndex,
      activePricePicker.field,
      formatted
    );
    closePricePicker();
  };

  const handleCustomPriceInputChange = (value: string) => {
    setCustomPriceValue(formatVND(value));
  };

  const handleCustomPriceSave = () => {
    if (!activePricePicker) {
      closePricePicker();
      return;
    }
    if (!customPriceValue.trim()) {
      Alert.alert("Thiếu dữ liệu", "Vui lòng nhập giá hợp lệ");
      return;
    }
    const numericValue = parseVND(customPriceValue);
    if (numericValue < 0) {
      Alert.alert("Giá không hợp lệ", "Vui lòng nhập số hợp lệ");
      return;
    }
    const formatted = formatVND(numericValue.toString());
    addCustomOption(activePricePicker.field, numericValue);
    handleProductChange(
      activePricePicker.productIndex,
      activePricePicker.field,
      formatted
    );
    closePricePicker();
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
          errors.push(
            `Sản phẩm ${index + 1}: Số lượng nhập hàng (tấn/đợt)`
          );
        }
        if (!product.importedFromNPP) {
          errors.push(`Sản phẩm ${index + 1}: Nhập từ NPP`);
        }
        if (!product.averageStockQuantity) {
          errors.push(`Sản phẩm ${index + 1}: Sản lượng bình quân (tấn/tháng)`);
        }
      });
    }

    return errors;
  };

  const [showValidationModal, setShowValidationModal] = useState(false);

  const handleSubmit = async () => {
    const errors = validateSurvey();
    if (errors.length > 0) {
      setShowValidationModal(true);
    } else {
      await submitSurvey();
    }
  };

  const submitSurvey = async () => {
    if (!user || !id || !capturedImages || capturedImages.length !== 3) {
      Alert.alert("Lỗi", "Thiếu thông tin cần thiết");
      return;
    }

    const storeId = parseInt(id);
    if (isNaN(storeId)) {
      Alert.alert("Lỗi", "ID cửa hàng không hợp lệ");
      return;
    }

    setSubmitting(true);
    setUploadProgress({ current: 0, total: 3, message: "Đang thực thi..." });

    try {
      // Step 1: Create audit
      setUploadProgress({ current: 0, total: 3, message: "Đang thực thi..." });
      const auditResponse = await api.post("/audits", {
        userId: user.id,
        storeId: storeId,
        notes: notes.trim() || null,
        auditDate: new Date().toISOString(),
      });

      const auditId = auditResponse.data.Id;

      // Step 2: Upload images sequentially with progress tracking
      const imagesToUpload = capturedImages.filter(
        (img): img is NonNullable<typeof img> => img !== undefined
      );

      if (imagesToUpload.length !== 3) {
        throw new Error("Vui lòng chụp đầy đủ 3 ảnh");
      }

      // Upload first 2 images in parallel
      setUploadProgress({
        current: 0,
        total: 3,
        message: "Đang tải ảnh 1 và 2...",
      });

      let completedCount = 0;
      const updateBatchProgress = () => {
        completedCount++;
        setUploadProgress({
          current: completedCount,
          total: 3,
          message:
            completedCount === 2
              ? "Đã tải xong ảnh 1 và 2, đang tải ảnh 3..."
              : `Đang tải ảnh 1 và 2... (${completedCount}/2)`,
        });
      };

      const uploadImage = async (
        img: NonNullable<(typeof capturedImages)[0]>,
        index: number
      ) => {
        const formData = new FormData();
        formData.append("image", {
          uri: img.uri,
          type: "image/jpeg",
          name: `image_${index + 1}.jpg`,
        } as any);
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
      };

      // Upload first 2 images in parallel
      const [upload1Result, upload2Result] = await Promise.allSettled([
        uploadImage(imagesToUpload[0], 0).then(() => {
          updateBatchProgress();
        }),
        uploadImage(imagesToUpload[1], 1).then(() => {
          updateBatchProgress();
        }),
      ]);

      if (upload1Result.status === "rejected") {
        throw upload1Result.reason;
      }
      if (upload2Result.status === "rejected") {
        throw upload2Result.reason;
      }

      // Upload third image
      setUploadProgress({
        current: 2,
        total: 3,
        message: "Đang tải ảnh 3/3...",
      });
      await uploadImage(imagesToUpload[2], 2);
      setUploadProgress({
        current: 3,
        total: 3,
        message: "Đang cập nhật thông tin cửa hàng...",
      });

      // Step 3: Create survey
      const newProductImportQty =
        surveyData.newProductImportQuantity?.trim() || null;

      await api.post("/store-surveys", {
        storeId: storeId,
        auditId: auditId,
        userId: user.id,
        whyNotSellNewProduct: surveyData.whyNotSellNewProduct,
        timeToSellNewProduct: surveyData.timeToSellNewProduct || null,
        newProductImportQuantity: newProductImportQty,
        supplierName: surveyData.supplierName,
        importedBySalesperson: surveyData.importedBySalesperson,
        storeComment: surveyData.storeComment || null,
        products: surveyData.products.map((p) => ({
          productType: p.productType,
          cementProductId: p.cementProductId,
          contactPersonPhone: p.contactPersonPhone,
          purchasePrice: p.purchasePrice?.trim()
            ? parseVND(p.purchasePrice)
            : null,
          sellingPrice: p.sellingPrice?.trim()
            ? parseVND(p.sellingPrice)
            : null,
          roadTransportFee: p.roadTransportFee?.trim()
            ? parseVND(p.roadTransportFee)
            : null,
          waterTransportFee: p.waterTransportFee?.trim()
            ? parseVND(p.waterTransportFee)
            : null,
          quantityReceived: p.quantityReceived?.trim()
            ? parseFloat(p.quantityReceived)
            : null,
          importedFromNPP: p.importedFromNPP,
          discountPromotion: p.discountPromotion || null,
          averageStockQuantity: p.averageStockQuantity?.trim()
            ? parseFloat(p.averageStockQuantity)
            : null,
        })),
      });

      // Update store coordinates from first image
      if (imagesToUpload[0]) {
        await api.put(`/stores/${storeId}`, {
          latitude: imagesToUpload[0].latitude,
          longitude: imagesToUpload[0].longitude,
        });
      }

      // Clear captured data (images/notes) but keep form data for autofill
      clearSurveyData();

      // Save form data for autofill next store (excluding contactPersonPhone which is store-specific)
      const nextSurveyData: SurveyData = {
        ...surveyData,
        // Clear only contactPersonPhone (store-specific), keep all other fields for autofill
        products: surveyData.products.map((p) => ({
          ...p,
          contactPersonPhone: "", // Clear only this field
        })),
      };

      setSurveyData(nextSurveyData);

      if (user?.id) {
        try {
          const storageKey = `survey_data_${user.id}`;
          await AsyncStorage.setItem(
            storageKey,
            JSON.stringify(nextSurveyData)
          );
        } catch (error) {
          console.error("Error saving survey data for next store:", error);
        }
      }

      setSubmitting(false);
      setUploadProgress({ current: 0, total: 0, message: "" });

      Alert.alert("Thành công", "Đã hoàn thành audit cửa hàng", [
        {
          text: "OK",
          onPress: () => {
            // Use push instead of replace to maintain navigation stack
            router.push(`/(tabs)/store-detail/${id}`);
          },
        },
      ]);
    } catch (error: unknown) {
      console.error("Error submitting survey:", error);
      setSubmitting(false);
      setUploadProgress({ current: 0, total: 0, message: "" });
      const errorMessage =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ||
        (error as { message?: string })?.message ||
        "Có lỗi xảy ra khi lưu khảo sát";
      Alert.alert("Lỗi", errorMessage);
    }
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            borderBottomColor: colors.icon + "20",
            backgroundColor: colors.secondary,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.primary }]}>
          Khảo sát cửa hàng
        </Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {/* Title 3 - Thông tin bán hàng (Hiển thị ở trên) */}
          <View
            style={[
              styles.titleSection,
              { backgroundColor: colors.background },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.titleHeader,
                {
                  backgroundColor: expandedTitles.title3
                    ? colors.primary
                    : colors.background,
                },
              ]}
              onPress={() => toggleTitle("title3")}
            >
              <Text
                style={[
                  styles.titleHeaderText,
                  { color: expandedTitles.title3 ? "#fff" : colors.text },
                ]}
              >
                Thông tin bán hàng <Text style={{ color: "#ff4d00" }}>*</Text>
              </Text>
              <Ionicons
                name={expandedTitles.title3 ? "chevron-up" : "chevron-down"}
                size={24}
                color={expandedTitles.title3 ? "#fff" : colors.icon}
              />
            </TouchableOpacity>

            {expandedTitles.title3 && (
              <View
                style={[
                  styles.titleContent,
                  { backgroundColor: colors.secondary, paddingTop: 16 },
                ]}
              >
                {surveyData.products.map((product, index) => (
                  <View
                    key={index}
                    style={[
                      styles.productItem,
                      {
                        borderColor: colors.primary + "40",
                        borderWidth: 2,
                        borderRadius: 8,
                        padding: 16,
                        marginBottom: 16,
                        marginTop: index === 0 ? 0 : 0,
                      },
                    ]}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 16,
                      }}
                    >
                      <Text
                        style={[
                          styles.productItemTitle,
                          { color: colors.text },
                        ]}
                      >
                        Sản phẩm {index + 1}
                      </Text>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => toggleProduct(index)}
                          style={{ padding: 4 }}
                        >
                          <Ionicons
                            name={
                              expandedProducts[index] !== false
                                ? "chevron-down"
                                : "chevron-forward"
                            }
                            size={20}
                            color={colors.primary}
                          />
                        </TouchableOpacity>
                        {index > 0 && (
                          <TouchableOpacity
                            onPress={() => handleRemoveProduct(index)}
                            style={{ padding: 4 }}
                          >
                            <Ionicons name="close" size={20} color="#ff4444" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    {expandedProducts[index] !== false && (
                      <>
                        <View style={styles.field}>
                          <View
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <Text
                              style={[styles.label, { color: colors.text }]}
                            >
                              Sản phẩm được bán
                            </Text>
                            <TouchableOpacity
                              onPress={() => {
                                setNewProductTypeName("");
                                setShowAddProductTypeModal(true);
                              }}
                            >
                              <Text
                                style={{
                                  color: colors.primary,
                                  fontWeight: "600",
                                  fontSize: 13,
                                }}
                              >
                                + Thêm sản phẩm
                              </Text>
                            </TouchableOpacity>
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.pickerContainer,
                              { borderColor: colors.icon + "40" },
                            ]}
                            onPress={() => setShowProductTypePicker(index)}
                          >
                            <View style={styles.picker}>
                              <Text
                                style={[
                                  styles.pickerText,
                                  { color: colors.text },
                                ]}
                              >
                                {product.productType || "Chọn sản phẩm"}
                              </Text>
                              <Ionicons
                                name="chevron-down"
                                size={20}
                                color={colors.icon}
                              />
                            </View>
                          </TouchableOpacity>
                        </View>

                        {product.productType === "Xi măng" && (
                          <View style={styles.field}>
                            <View
                              style={{
                                flexDirection: "row",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <Text
                                style={[styles.label, { color: colors.text }]}
                              >
                                Loại xi măng
                              </Text>
                              <TouchableOpacity
                                onPress={() => {
                                  setNewCementName("");
                                  setAddCementForProductIndex(index);
                                  setShowAddCementModal(true);
                                }}
                              >
                                <Text
                                  style={{
                                    color: colors.primary,
                                    fontWeight: "600",
                                    fontSize: 13,
                                  }}
                                >
                                  + Thêm loại xi măng
                                </Text>
                              </TouchableOpacity>
                            </View>
                            <TouchableOpacity
                              style={[
                                styles.pickerContainer,
                                { borderColor: colors.icon + "40" },
                              ]}
                              onPress={() => setShowCementProductPicker(index)}
                            >
                              <View style={styles.picker}>
                                <Text
                                  style={[
                                    styles.pickerText,
                                    {
                                      color: colors.text,
                                      flex: 1,
                                      marginRight: 8,
                                    },
                                  ]}
                                  numberOfLines={1}
                                  ellipsizeMode="tail"
                                >
                                  {product.cementProductId
                                    ? cementProducts.find(
                                        (p) => p.Id === product.cementProductId
                                      )?.Name || "Chọn loại xi măng"
                                    : "Chọn loại xi măng"}
                                </Text>
                                <Ionicons
                                  name="chevron-down"
                                  size={20}
                                  color={colors.icon}
                                  style={{ flexShrink: 0 }}
                                />
                              </View>
                            </TouchableOpacity>
                          </View>
                        )}

                        <View style={styles.field}>
                          <Text style={[styles.label, { color: colors.text }]}>
                            Tên + SDT
                          </Text>
                          <TextInput
                            style={[
                              styles.input,
                              {
                                backgroundColor: colors.background,
                                color: colors.text,
                                borderColor: colors.icon + "40",
                              },
                            ]}
                            value={product.contactPersonPhone}
                            onChangeText={(value) =>
                              handleProductChange(
                                index,
                                "contactPersonPhone",
                                value
                              )
                            }
                            placeholder="VD: Nguyễn A – 0909xxxx"
                            placeholderTextColor={colors.icon}
                          />
                        </View>

                        <View style={styles.field}>
                          <Text style={[styles.label, { color: colors.text }]}>
                            Giá mua vào
                          </Text>
                          <TouchableOpacity
                            style={[
                              styles.pickerContainer,
                              {
                                backgroundColor: colors.background,
                                borderColor: colors.icon + "40",
                              },
                            ]}
                            onPress={() =>
                              openPricePicker(index, "purchasePrice")
                            }
                          >
                            <View style={styles.picker}>
                              <Text
                                style={[
                                  styles.pickerText,
                                  {
                                    color: product.purchasePrice
                                      ? colors.text
                                      : colors.icon,
                                  },
                                ]}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                {product.purchasePrice ||
                                  "Chọn giá mua vào hoặc nhập mới"}
                              </Text>
                              <Ionicons
                                name="chevron-down"
                                size={20}
                                color={colors.icon}
                              />
                            </View>
                          </TouchableOpacity>
                        </View>

                        <View style={styles.field}>
                          <Text style={[styles.label, { color: colors.text }]}>
                            Giá bán ra
                          </Text>
                          <TouchableOpacity
                            style={[
                              styles.pickerContainer,
                              {
                                backgroundColor: colors.background,
                                borderColor: colors.icon + "40",
                              },
                            ]}
                            onPress={() =>
                              openPricePicker(index, "sellingPrice")
                            }
                          >
                            <View style={styles.picker}>
                              <Text
                                style={[
                                  styles.pickerText,
                                  {
                                    color: product.sellingPrice
                                      ? colors.text
                                      : colors.icon,
                                  },
                                ]}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                {product.sellingPrice ||
                                  "Chọn giá bán ra hoặc nhập mới"}
                              </Text>
                              <Ionicons
                                name="chevron-down"
                                size={20}
                                color={colors.icon}
                              />
                            </View>
                          </TouchableOpacity>
                        </View>

                        <View style={styles.field}>
                          <Text style={[styles.label, { color: colors.text }]}>
                            Phí vận chuyển đường bộ
                          </Text>
                          <TouchableOpacity
                            style={[
                              styles.pickerContainer,
                              {
                                backgroundColor: colors.background,
                                borderColor: colors.icon + "40",
                              },
                            ]}
                            onPress={() =>
                              openPricePicker(index, "roadTransportFee")
                            }
                          >
                            <View style={styles.picker}>
                              <Text
                                style={[
                                  styles.pickerText,
                                  {
                                    color: product.roadTransportFee
                                      ? colors.text
                                      : colors.icon,
                                  },
                                ]}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                {product.roadTransportFee ||
                                  "Chọn phí đường bộ hoặc nhập mới"}
                              </Text>
                              <Ionicons
                                name="chevron-down"
                                size={20}
                                color={colors.icon}
                              />
                            </View>
                          </TouchableOpacity>
                        </View>

                        <View style={styles.field}>
                          <Text style={[styles.label, { color: colors.text }]}>
                            Phí vận chuyển đường thủy
                          </Text>
                          <TouchableOpacity
                            style={[
                              styles.pickerContainer,
                              {
                                backgroundColor: colors.background,
                                borderColor: colors.icon + "40",
                              },
                            ]}
                            onPress={() =>
                              openPricePicker(index, "waterTransportFee")
                            }
                          >
                            <View style={styles.picker}>
                              <Text
                                style={[
                                  styles.pickerText,
                                  {
                                    color: product.waterTransportFee
                                      ? colors.text
                                      : colors.icon,
                                  },
                                ]}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                {product.waterTransportFee ||
                                  "Chọn phí đường thủy hoặc nhập mới"}
                              </Text>
                              <Ionicons
                                name="chevron-down"
                                size={20}
                                color={colors.icon}
                              />
                            </View>
                          </TouchableOpacity>
                        </View>

                        <View style={styles.field}>
                          <Text style={[styles.label, { color: colors.text }]}>
                            Số lượng nhập hàng (tấn/đợt)
                          </Text>
                          <TextInput
                            style={[
                              styles.input,
                              {
                                backgroundColor: colors.background,
                                color: colors.text,
                                borderColor: colors.icon + "40",
                              },
                            ]}
                            value={product.quantityReceived}
                            onChangeText={(value) =>
                              handleProductChange(
                                index,
                                "quantityReceived",
                                value
                              )
                            }
                            placeholder="Nhập số lượng"
                            placeholderTextColor={colors.icon}
                            keyboardType="numeric"
                          />
                        </View>

                        <View style={styles.field}>
                          <Text style={[styles.label, { color: colors.text }]}>
                            Nhập từ NPP
                          </Text>
                          <TextInput
                            style={[
                              styles.input,
                              {
                                backgroundColor: colors.background,
                                color: colors.text,
                                borderColor: colors.icon + "40",
                              },
                            ]}
                            value={product.importedFromNPP}
                            onChangeText={(value) =>
                              handleProductChange(
                                index,
                                "importedFromNPP",
                                value
                              )
                            }
                            placeholder="Nhập tên NPP"
                            placeholderTextColor={colors.icon}
                          />
                        </View>

                        <View style={styles.field}>
                          <Text style={[styles.label, { color: colors.text }]}>
                            Chương trình chiết khấu - khuyến mãi (nếu có)
                          </Text>
                          <TextInput
                            style={[
                              styles.input,
                              {
                                backgroundColor: colors.background,
                                color: colors.text,
                                borderColor: colors.icon + "40",
                              },
                            ]}
                            value={product.discountPromotion}
                            onChangeText={(value) =>
                              handleProductChange(
                                index,
                                "discountPromotion",
                                value
                              )
                            }
                            placeholder="Nhập thông tin chương trình"
                            placeholderTextColor={colors.icon}
                          />
                        </View>

                        <View style={styles.field}>
                          <Text style={[styles.label, { color: colors.text }]}>
                            Sản lượng bình quân (tấn/tháng)
                          </Text>
                          <TextInput
                            style={[
                              styles.input,
                              {
                                backgroundColor: colors.background,
                                color: colors.text,
                                borderColor: colors.icon + "40",
                              },
                            ]}
                            value={product.averageStockQuantity}
                            onChangeText={(value) =>
                              handleProductChange(
                                index,
                                "averageStockQuantity",
                                value
                              )
                            }
                            placeholder="Nhập sản lượng bình quân (tấn/tháng)"
                            placeholderTextColor={colors.icon}
                            keyboardType="numeric"
                          />
                        </View>
                      </>
                    )}
                  </View>
                ))}

                <TouchableOpacity
                  style={[
                    styles.addProductButton,
                    { backgroundColor: colors.primary },
                  ]}
                  onPress={handleAddProduct}
                >
                  <Ionicons name="add" size={24} color="#fff" />
                  <Text style={styles.addProductButtonText}>Thêm sản phẩm</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Title 2 - Khảo sát sản phẩm của XMTĐ (Hiển thị ở dưới) */}
          <View
            style={[
              styles.titleSection,
              { backgroundColor: colors.background },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.titleHeader,
                {
                  backgroundColor: expandedTitles.title2
                    ? colors.primary
                    : colors.background,
                },
              ]}
              onPress={() => toggleTitle("title2")}
            >
              <Text
                style={[
                  styles.titleHeaderText,
                  { color: expandedTitles.title2 ? "#fff" : colors.text },
                ]}
              >
                Khảo sát sản phẩm của XMTĐ{" "}
                <Text style={{ color: "#ff4d00" }}>*</Text>
              </Text>
              <Ionicons
                name={expandedTitles.title2 ? "chevron-up" : "chevron-down"}
                size={24}
                color={expandedTitles.title2 ? "#fff" : colors.icon}
              />
            </TouchableOpacity>

            {expandedTitles.title2 && (
              <View
                style={[
                  styles.titleContent,
                  { backgroundColor: colors.secondary },
                ]}
              >
                <View style={[styles.field, { marginTop: 16 }]}>
                  <Text style={[styles.label, { color: colors.text }]}>
                    Tại sao không bán sản phẩm mới
                  </Text>
                  <TextInput
                    style={[
                      styles.textArea,
                      {
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderColor: colors.icon + "40",
                      },
                    ]}
                    value={surveyData.whyNotSellNewProduct}
                    onChangeText={(value) =>
                      handleInputChange("whyNotSellNewProduct", value)
                    }
                    placeholder="Nhập lý do"
                    placeholderTextColor={colors.icon}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>
                    Thời gian để bán sản phẩm mới
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.icon + "40",
                        justifyContent: "center",
                        flexDirection: "row",
                        alignItems: "center",
                        paddingRight: 40,
                      },
                    ]}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text
                      style={[
                        {
                          flex: 1,
                          color: surveyData.timeToSellNewProduct
                            ? colors.text
                            : colors.icon,
                        },
                      ]}
                    >
                      {surveyData.timeToSellNewProduct
                        ? new Date(
                            surveyData.timeToSellNewProduct
                          ).toLocaleDateString("vi-VN")
                        : "Chọn ngày"}
                    </Text>
                    <Ionicons
                      name="calendar-outline"
                      size={20}
                      color={colors.icon}
                      style={{ marginLeft: 8 }}
                    />
                  </TouchableOpacity>
                  {showDatePicker && (
                    <DateTimePicker
                      value={
                        surveyData.timeToSellNewProduct
                          ? new Date(surveyData.timeToSellNewProduct)
                          : new Date()
                      }
                      mode="date"
                      display="default"
                      onChange={(event, selectedDate) => {
                        setShowDatePicker(Platform.OS === "ios");
                        if (selectedDate) {
                          handleInputChange(
                            "timeToSellNewProduct",
                            selectedDate.toISOString()
                          );
                        }
                      }}
                    />
                  )}
                </View>

                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>
                    Tên sản phẩm muốn nhập – Số lượng (nếu có)
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderColor: colors.icon + "40",
                      },
                    ]}
                    value={surveyData.newProductImportQuantity}
                    onChangeText={(value) =>
                      handleInputChange("newProductImportQuantity", value)
                    }
                    placeholder="Nhập tên sản phẩm và số lượng"
                    placeholderTextColor={colors.icon}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>
                    Mua qua NPP
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderColor: colors.icon + "40",
                      },
                    ]}
                    value={surveyData.supplierName}
                    onChangeText={(value) =>
                      handleInputChange("supplierName", value)
                    }
                    placeholder="Nhập tên NPP"
                    placeholderTextColor={colors.icon}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>
                    Nhập bởi thương vụ
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.pickerContainer,
                      { borderColor: colors.icon + "40" },
                    ]}
                    onPress={() => setShowSalesPicker(true)}
                  >
                    <View style={styles.picker}>
                      <Text style={[styles.pickerText, { color: colors.text }]}>
                        {surveyData.importedBySalesperson || "Chọn thương vụ"}
                      </Text>
                      <Ionicons
                        name="chevron-down"
                        size={20}
                        color={colors.icon}
                      />
                    </View>
                  </TouchableOpacity>
                </View>

                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>
                    Ý kiến/Ghi chú
                  </Text>
                  <TextInput
                    style={[
                      styles.textArea,
                      {
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderColor: colors.icon + "40",
                      },
                    ]}
                    value={surveyData.storeComment}
                    onChangeText={(value) =>
                      handleInputChange("storeComment", value)
                    }
                    placeholder="Nhập Ý kiến/Ghi chú (không bắt buộc)"
                    placeholderTextColor={colors.icon}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              </View>
            )}
          </View>

          {/* Submit Button */}
          <View
            style={{
              alignItems: "center",
              marginTop: 24,
              marginBottom: 24,
            }}
          >
            <TouchableOpacity
              style={[
                styles.submitButton,
                {
                  backgroundColor: submitting
                    ? colors.icon + "40"
                    : colors.primary,
                  paddingHorizontal: 32,
                  paddingVertical: 14,
                  borderRadius: 8,
                },
              ]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Hoàn thành</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Price Picker Modal */}
      <Modal
        visible={!!activePricePicker}
        transparent
        animationType="slide"
        onRequestClose={closePricePicker}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.priceModalContent,
              { backgroundColor: colors.background },
            ]}
          >
            <View style={styles.priceModalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {activePricePicker
                  ? `Chọn ${PRICE_FIELD_LABELS[activePricePicker.field]}`
                  : ""}
              </Text>
              <TouchableOpacity onPress={closePricePicker}>
                <Ionicons name="close" size={24} color={colors.icon} />
              </TouchableOpacity>
            </View>
            <Text
              style={[styles.priceModalDescription, { color: colors.icon }]}
            >
              Chọn giá có sẵn hoặc nhập giá mới bên dưới
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.priceModalInput,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.icon + "40",
                },
              ]}
              value={customPriceValue}
              onChangeText={handleCustomPriceInputChange}
              placeholder={
                activePricePicker
                  ? `Nhập ${PRICE_FIELD_LABELS[activePricePicker.field]} (VND)`
                  : "Nhập giá"
              }
              placeholderTextColor={colors.icon}
              keyboardType="numeric"
            />
            <ScrollView style={styles.priceOptionsList}>
              {(activePricePicker
                ? getOptionsForField(activePricePicker.field)
                : []
              ).map((price, optionIndex) => (
                <TouchableOpacity
                  key={`${price}-${optionIndex}`}
                  style={[
                    styles.priceOptionItem,
                    {
                      borderColor: colors.icon + "20",
                      backgroundColor: colors.background,
                    },
                  ]}
                  onPress={() => handleSelectPriceOption(price)}
                >
                  <Text
                    style={[styles.priceOptionText, { color: colors.text }]}
                  >
                    {price.toLocaleString("vi-VN")} VND
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={closePricePicker}
              >
                <Text style={styles.modalButtonSecondaryText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleCustomPriceSave}
              >
                <Text style={styles.modalButtonPrimaryText}>Lưu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Product Type Modal */}
      <Modal
        visible={showAddProductTypeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddProductTypeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.background },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Thêm sản phẩm mới
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.icon + "40",
                  marginTop: 16,
                },
              ]}
              value={newProductTypeName}
              onChangeText={setNewProductTypeName}
              placeholder="Nhập tên sản phẩm"
              placeholderTextColor={colors.icon}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowAddProductTypeModal(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={() => {
                  const trimmed = newProductTypeName.trim();
                  if (!trimmed) {
                    Alert.alert("Lỗi", "Vui lòng nhập tên sản phẩm");
                    return;
                  }
                  setProductTypes((prev) =>
                    prev.includes(trimmed) ? prev : [...prev, trimmed]
                  );
                  setShowAddProductTypeModal(false);
                }}
              >
                <Text style={styles.modalButtonPrimaryText}>Lưu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Product Type Picker Modal (Title 3) */}
      <Modal
        visible={showProductTypePicker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProductTypePicker(null)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.background },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Chọn sản phẩm
              </Text>
              <TouchableOpacity onPress={() => setShowProductTypePicker(null)}>
                <Ionicons name="close" size={24} color={colors.icon} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {productTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.modalOption,
                    {
                      backgroundColor:
                        surveyData.products[showProductTypePicker || 0]
                          ?.productType === type
                          ? colors.primary + "20"
                          : "transparent",
                    },
                  ]}
                  onPress={() => {
                    if (showProductTypePicker !== null) {
                      handleProductChange(
                        showProductTypePicker,
                        "productType",
                        type
                      );
                      setShowProductTypePicker(null);
                    }
                  }}
                >
                  <Text
                    style={[styles.modalOptionText, { color: colors.text }]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Sales Picker Modal */}
      <Modal
        visible={showSalesPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSalesPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.background },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Chọn thương vụ
              </Text>
              <TouchableOpacity onPress={() => setShowSalesPicker(false)}>
                <Ionicons name="close" size={24} color={colors.icon} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.icon + "40",
                  marginBottom: 12,
                },
              ]}
              value={salesSearch}
              onChangeText={setSalesSearch}
              placeholder="Tìm kiếm thương vụ"
              placeholderTextColor={colors.icon}
            />
            <ScrollView>
              {filteredSalesUsers.map((user) => (
                <TouchableOpacity
                  key={user.Id}
                  style={styles.modalOption}
                  onPress={() => {
                    handleInputChange("importedBySalesperson", user.FullName);
                    setShowSalesPicker(false);
                  }}
                >
                  <Text
                    style={[styles.modalOptionText, { color: colors.text }]}
                  >
                    {user.FullName}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Cement Modal */}
      <Modal
        visible={showAddCementModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddCementModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.background },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Thêm loại xi măng mới
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.icon + "40",
                  marginTop: 16,
                },
              ]}
              value={newCementName}
              onChangeText={setNewCementName}
              placeholder="Nhập tên xi măng"
              placeholderTextColor={colors.icon}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowAddCementModal(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={async () => {
                  const trimmed = newCementName.trim();
                  if (!trimmed) {
                    Alert.alert("Lỗi", "Vui lòng nhập tên xi măng");
                    return;
                  }
                  try {
                    const res = await api.post("/cement-products", {
                      name: trimmed,
                    });
                    const created = res.data;
                    await fetchCementProducts();
                    // Set cement product for the current product being edited
                    if (addCementForProductIndex !== null) {
                      handleProductChange(
                        addCementForProductIndex,
                        "cementProductId",
                        created.Id
                      );
                    }
                    setShowAddCementModal(false);
                    setAddCementForProductIndex(null);
                  } catch (error: unknown) {
                    console.error("Error creating cement product:", error);
                    const message =
                      (error as { response?: { data?: { error?: string } } })
                        ?.response?.data?.error ||
                      (error as { message?: string })?.message ||
                      "Không thể thêm loại xi măng";
                    Alert.alert("Lỗi", message);
                  }
                }}
              >
                <Text style={styles.modalButtonPrimaryText}>Lưu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cement Product Picker Modal (Title 3) */}
      <Modal
        visible={showCementProductPicker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCementProductPicker(null)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.background },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Chọn loại xi măng
              </Text>
              <TouchableOpacity
                onPress={() => setShowCementProductPicker(null)}
              >
                <Ionicons name="close" size={24} color={colors.icon} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.icon + "40",
                  marginBottom: 12,
                },
              ]}
              value={cementSearch}
              onChangeText={setCementSearch}
              placeholder="Tìm kiếm loại xi măng"
              placeholderTextColor={colors.icon}
            />
            <ScrollView>
              {filteredCementProducts.map((product) => (
                <TouchableOpacity
                  key={product.Id}
                  style={[
                    styles.modalOption,
                    {
                      backgroundColor:
                        surveyData.products[showCementProductPicker || 0]
                          ?.cementProductId === product.Id
                          ? colors.primary + "20"
                          : "transparent",
                    },
                  ]}
                  onPress={() => {
                    if (showCementProductPicker !== null) {
                      handleProductChange(
                        showCementProductPicker,
                        "cementProductId",
                        product.Id
                      );
                      setShowCementProductPicker(null);
                    }
                  }}
                >
                  <Text
                    style={[styles.modalOptionText, { color: colors.text }]}
                  >
                    {product.Name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Validation Warning Modal */}
      <Modal
        visible={showValidationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowValidationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.validationModalContent,
              { backgroundColor: colors.background },
            ]}
          >
            <Text style={[styles.validationModalTitle, { color: colors.text }]}>
              Cảnh báo
            </Text>
            <Text
              style={[
                styles.validationModalMessage,
                { color: colors.icon, marginTop: 8 },
              ]}
            >
              Vui lòng điền đầy đủ tất cả các thông tin khảo sát, bao gồm cả 2
              phần liên quan đến cửa hàng để hoàn tất quá trình đánh giá.
            </Text>
            <View style={styles.validationModalActions}>
              <TouchableOpacity
                style={[
                  styles.validationModalButton,
                  styles.validationModalButtonCancel,
                  { backgroundColor: colors.icon + "20" },
                ]}
                onPress={() => setShowValidationModal(false)}
              >
                <Text
                  style={[
                    styles.validationModalButtonText,
                    { color: colors.text },
                  ]}
                >
                  Tiếp tục điền
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.validationModalButton,
                  styles.validationModalButtonConfirm,
                  { backgroundColor: colors.primary },
                ]}
                onPress={() => {
                  setShowValidationModal(false);
                  submitSurvey();
                }}
              >
                <Text style={styles.validationModalButtonTextConfirm}>
                  Xác nhận hoàn thành
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Upload Progress Modal */}
      <Modal
        visible={submitting && uploadProgress.total > 0}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.uploadProgressModalContent,
              { backgroundColor: colors.background },
            ]}
          >
            <View style={{ alignItems: "center" }}>
              <ActivityIndicator
                size="large"
                color={colors.primary}
                style={{ marginBottom: 16 }}
              />
              <Text
                style={[styles.uploadProgressTitle, { color: colors.text }]}
              >
                {uploadProgress.message || "Đang xử lý..."}
              </Text>
              {uploadProgress.total > 0 && (
                <View style={{ marginTop: 16, width: "100%" }}>
                  <View
                    style={[
                      styles.uploadProgressBar,
                      {
                        backgroundColor: colors.icon + "20",
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.uploadProgressFill,
                        {
                          width: `${
                            (uploadProgress.current / uploadProgress.total) *
                            100
                          }%`,
                          backgroundColor: colors.primary,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[styles.uploadProgressText, { color: colors.icon }]}
                  >
                    {uploadProgress.current}/{uploadProgress.total} ảnh
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  headerRight: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  titleSection: {
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
  },
  titleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  titleHeaderText: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  titleContent: {
    padding: 16,
    paddingTop: 16,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 44,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 44,
  },
  picker: {
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pickerText: {
    fontSize: 14,
    flex: 1,
  },
  productItem: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  productItemTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
  },
  addProductButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 8,
    gap: 8,
    marginTop: 12,
  },
  addProductButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  submitButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 32,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    columnGap: 12,
  },
  modalButton: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonSecondary: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
  },
  modalButtonPrimary: {
    backgroundColor: "#0138C3",
  },
  modalButtonSecondaryText: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "600",
  },
  modalButtonPrimaryText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    maxHeight: "80%",
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  modalOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    borderRadius: 8,
    marginBottom: 4,
  },
  modalOptionText: {
    fontSize: 14,
  },
  priceModalContent: {
    width: "90%",
    borderRadius: 16,
    padding: 24,
    maxHeight: "80%",
  },
  priceModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  priceModalDescription: {
    fontSize: 13,
    marginBottom: 12,
  },
  priceModalInput: {
    marginBottom: 12,
  },
  priceOptionsList: {
    maxHeight: 240,
    marginTop: 4,
  },
  priceOptionItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  priceOptionText: {
    fontSize: 14,
  },
  validationModalContent: {
    width: "85%",
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
  },
  validationModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  validationModalMessage: {
    fontSize: 14,
    marginBottom: 16,
  },
  validationModalActions: {
    flexDirection: "row",
    gap: 12,
  },
  validationModalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  validationModalButtonCancel: {
    backgroundColor: "#f1f5f9",
  },
  validationModalButtonConfirm: {
    backgroundColor: "#1d4ed8",
  },
  validationModalButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  validationModalButtonTextConfirm: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  uploadProgressModalContent: {
    width: "85%",
    maxWidth: 400,
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
  },
  uploadProgressTitle: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  uploadProgressBar: {
    width: "100%",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  uploadProgressFill: {
    height: "100%",
    borderRadius: 4,
  },
  uploadProgressText: {
    fontSize: 14,
    textAlign: "center",
  },
});

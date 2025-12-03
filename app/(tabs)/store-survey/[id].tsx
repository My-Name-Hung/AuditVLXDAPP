import { useAuth } from "@/src/contexts/AuthContext";
import { useSurvey } from "@/src/contexts/SurveyContext";
import { useTheme } from "@/src/contexts/ThemeContext";
import api from "@/src/services/api";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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
  whyNotSellNewProduct: string;
  timeToSellNewProduct: string;
  newProductImportQuantity: string;
  importedBySalesperson: string;
  newProductSellingPrice: string;
  futureImportPrediction: string;
  storeComment: string;
  averageMonthlyConsumption: string;
  products: {
    productType: string;
    cementProductId: number | null;
    sellingPrice: string;
  }[];
}

// Không áp ràng buộc 1–10000, chỉ format số VND cho đẹp
const PRODUCT_TYPES = ["Xi măng", "Cát", "Đá"];

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
  const [expandedTitles, setExpandedTitles] = useState({
    title1: true,
    title2: false,
    title3: false,
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCementPicker, setShowCementPicker] = useState(false);
  const [cementSearch, setCementSearch] = useState("");
  const [showProductTypePicker, setShowProductTypePicker] = useState<
    number | null
  >(null);
  const [showCementProductPicker, setShowCementProductPicker] = useState<
    number | null
  >(null);
  const [showAddCementModal, setShowAddCementModal] = useState(false);
  const [newCementName, setNewCementName] = useState("");

  const [salesUsers, setSalesUsers] = useState<
    { Id: number; FullName: string }[]
  >([]);
  const [showSalesPicker, setShowSalesPicker] = useState(false);
  const [salesSearch, setSalesSearch] = useState("");

  const [productTypes, setProductTypes] = useState<string[]>(PRODUCT_TYPES);
  const [showAddProductTypeModal, setShowAddProductTypeModal] = useState(false);
  const [newProductTypeName, setNewProductTypeName] = useState("");

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
    storeComment: "",
    averageMonthlyConsumption: "",
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

  const handlePriceChange = (
    field:
      | "purchasePrice"
      | "sellingPrice"
      | "newProductSellingPrice"
      | "roadTransportFee"
      | "waterTransportFee"
      | "newProductImportQuantity",
    value: string
  ) => {
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
    if (!surveyData.whyNotSellNewProduct)
      errors.push("Tại sao không bán sản phẩm mới");
    if (!surveyData.timeToSellNewProduct)
      errors.push("Thời gian để bán sản phẩm mới");
    if (!surveyData.newProductImportQuantity)
      errors.push("Số lượng nhập sản phẩm mới");
    if (!surveyData.importedBySalesperson) errors.push("Nhập bởi thương vụ");
    if (!surveyData.newProductSellingPrice)
      errors.push("Giá bán ra (sản phẩm mới)");
    if (!surveyData.averageMonthlyConsumption)
      errors.push("SLTTBQ (tấn/tháng)");

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
      const errorMessage = `Vui lòng điền đầy đủ các trường sau:\n${errors.join(
        "\n"
      )}`;
      Alert.alert(
        "Thiếu thông tin",
        errorMessage,
        [
          {
            text: "Hủy",
            style: "cancel",
          },
          {
            text: "Xác nhận hoàn thành",
            onPress: () => submitSurvey(),
          },
        ],
        { cancelable: true }
      );
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

    try {
      // Step 1: Create audit
      const auditResponse = await api.post("/audits", {
        userId: user.id,
        storeId: storeId,
        notes: notes.trim() || null,
        auditDate: new Date().toISOString(),
      });

      const auditId = auditResponse.data.Id;

      // Step 2: Upload all images in parallel (much faster than sequential)
      const imagesToUpload = capturedImages.filter(
        (img): img is NonNullable<typeof img> => img !== undefined
      );

      const imageUploadPromises = imagesToUpload.map((img, i) => {
        const formData = new FormData();
        formData.append("image", {
          uri: img.uri,
          type: "image/jpeg",
          name: `image_${i + 1}.jpg`,
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
      });

      // Step 3: Create survey (can run in parallel with image uploads)
      const surveyPromise = api.post("/store-surveys", {
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
        storeComment: surveyData.storeComment || null,
        averageMonthlyConsumption: surveyData.averageMonthlyConsumption
          ? parseFloat(surveyData.averageMonthlyConsumption)
          : null,
        products: surveyData.products.map((p) => ({
          productType: p.productType,
          cementProductId: p.cementProductId,
          sellingPrice: p.sellingPrice ? parseVND(p.sellingPrice) : null,
        })),
      });

      // Execute image uploads and survey creation in parallel
      await Promise.all([...imageUploadPromises, surveyPromise]);

      // Clear survey data
      clearSurveyData();

      Alert.alert("Thành công", "Thực thi cửa hàng thành công", [
        {
          text: "OK",
          onPress: () => {
            // Navigate back and refresh store detail to show new images
            router.replace(`/(tabs)/store-detail/${id}`);
            // Small delay to ensure navigation completes before refresh
            setTimeout(() => {
              // The store detail page should automatically refresh on mount
            }, 100);
          },
        },
      ]);
    } catch (error: unknown) {
      console.error("Error submitting survey:", error);
      const errorMessage =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ||
        (error as { message?: string })?.message ||
        "Có lỗi xảy ra khi lưu khảo sát";
      Alert.alert("Lỗi", errorMessage);
    } finally {
      setSubmitting(false);
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
        >
          {/* Title 1 */}
          <View
            style={[
              styles.titleSection,
              { backgroundColor: colors.background },
            ]}
          >
            <TouchableOpacity
              style={[styles.titleHeader, { backgroundColor: colors.primary }]}
              onPress={() => toggleTitle("title1")}
            >
              <Text style={[styles.titleHeaderText, { color: "#fff" }]}>
                Cửa hàng bán sản phẩm không phải của Xi Măng Tây Đô
              </Text>
              <Ionicons
                name={expandedTitles.title1 ? "chevron-up" : "chevron-down"}
                size={24}
                color={"#fff"}
              />
            </TouchableOpacity>

            {expandedTitles.title1 && (
              <View
                style={[
                  styles.titleContent,
                  { backgroundColor: colors.secondary },
                ]}
              >
                {/* Loại xi măng */}
                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>
                    Loại xi măng *
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <TouchableOpacity
                        style={[
                          styles.pickerContainer,
                          { borderColor: colors.icon + "40" },
                        ]}
                        onPress={() => setShowCementPicker(true)}
                      >
                        <View style={styles.picker}>
                          <Text
                            style={[styles.pickerText, { color: colors.text }]}
                          >
                            {surveyData.cementProductId
                              ? cementProducts.find(
                                  (p) => p.Id === surveyData.cementProductId
                                )?.Name || "Chọn loại xi măng"
                              : "Chọn loại xi măng"}
                          </Text>
                          <Ionicons
                            name="chevron-down"
                            size={20}
                            color={colors.icon}
                          />
                        </View>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setNewCementName("");
                        setShowAddCementModal(true);
                      }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 6,
                        backgroundColor: colors.primary,
                      }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "600" }}>
                        + Thêm
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 6 trường sau khi chọn loại xi măng */}
                {surveyData.cementProductId && (
                  <>
                    <View style={styles.field}>
                      <Text style={[styles.label, { color: colors.text }]}>
                        Người tiếp xúc *
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
                        value={surveyData.contactPerson}
                        onChangeText={(value) =>
                          handleInputChange("contactPerson", value)
                        }
                        placeholder="Nhập người tiếp xúc"
                        placeholderTextColor={colors.icon}
                      />
                    </View>

                    <View style={styles.field}>
                      <Text style={[styles.label, { color: colors.text }]}>
                        Giá mua vào *
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
                        value={surveyData.purchasePrice}
                        onChangeText={(value) =>
                          handlePriceChange("purchasePrice", value)
                        }
                        placeholder="Nhập giá (VND)"
                        placeholderTextColor={colors.icon}
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={styles.field}>
                      <Text style={[styles.label, { color: colors.text }]}>
                        Giá bán ra *
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
                        value={surveyData.sellingPrice}
                        onChangeText={(value) =>
                          handlePriceChange("sellingPrice", value)
                        }
                        placeholder="Nhập giá (VND)"
                        placeholderTextColor={colors.icon}
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={styles.field}>
                      <Text style={[styles.label, { color: colors.text }]}>
                        Nhập NPP nào? *
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
                        Phí code đường bộ *
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
                        value={surveyData.roadTransportFee}
                        onChangeText={(value) =>
                          handlePriceChange("roadTransportFee", value)
                        }
                        placeholder="Nhập giá (VND)"
                        placeholderTextColor={colors.icon}
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={styles.field}>
                      <Text style={[styles.label, { color: colors.text }]}>
                        Phí code đường thủy *
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
                        value={surveyData.waterTransportFee}
                        onChangeText={(value) =>
                          handlePriceChange("waterTransportFee", value)
                        }
                        placeholder="Nhập giá (VND)"
                        placeholderTextColor={colors.icon}
                        keyboardType="numeric"
                      />
                    </View>
                  </>
                )}

                {/* Các trường khác */}
                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>
                    Số lượng nhập *
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
                    value={surveyData.importExportQuantity}
                    onChangeText={(value) =>
                      handleInputChange("importExportQuantity", value)
                    }
                    placeholder="Nhập số lượng"
                    placeholderTextColor={colors.icon}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>
                    Số sản phẩm tồn kho *
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
                    value={surveyData.stockQuantity}
                    onChangeText={(value) =>
                      handleInputChange("stockQuantity", value)
                    }
                    placeholder="Nhập số lượng"
                    placeholderTextColor={colors.icon}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>
                    Vùng đang tiêu thụ *
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
                    value={surveyData.consumptionArea}
                    onChangeText={(value) =>
                      handleInputChange("consumptionArea", value)
                    }
                    placeholder="Nhập vùng tiêu thụ"
                    placeholderTextColor={colors.icon}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>
                    Công nợ bao lâu *
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
                    value={surveyData.debtPeriod}
                    onChangeText={(value) =>
                      handleInputChange("debtPeriod", value)
                    }
                    placeholder="Nhập thời gian công nợ"
                    placeholderTextColor={colors.icon}
                  />
                </View>
              </View>
            )}
          </View>

          {/* Title 2 */}
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
                Khảo sát sản phẩm của XMTĐ
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
                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>
                    Tại sao không bán sản phẩm mới *
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
                    Thời gian để bán sản phẩm mới *
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.icon + "40",
                        justifyContent: "center",
                      },
                    ]}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text
                      style={[
                        styles.input,
                        {
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
                    Số lượng nhập sản phẩm mới *
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
                      handlePriceChange("newProductImportQuantity", value)
                    }
                    placeholder="Nhập số lượng"
                    placeholderTextColor={colors.icon}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>
                    Nhập bởi thương vụ *
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
                    Giá bán ra (sản phẩm mới) *
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
                    value={surveyData.newProductSellingPrice}
                    onChangeText={(value) =>
                      handlePriceChange("newProductSellingPrice", value)
                    }
                    placeholder="Nhập giá (VND)"
                    placeholderTextColor={colors.icon}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>
                    SLTTBQ (tấn/tháng) *
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
                    value={surveyData.averageMonthlyConsumption}
                    onChangeText={(value) =>
                      handleInputChange("averageMonthlyConsumption", value)
                    }
                    placeholder="Nhập số lượng tiêu thụ bình quân"
                    placeholderTextColor={colors.icon}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>
                    Ý kiến của cửa hàng
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
                    placeholder="Nhập ý kiến của cửa hàng (không bắt buộc)"
                    placeholderTextColor={colors.icon}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>
                    Dự đoán tương lai sẽ nhập bao nhiêu hàng của XMTĐ
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
                    value={surveyData.futureImportPrediction}
                    onChangeText={(value) =>
                      handleInputChange("futureImportPrediction", value)
                    }
                    placeholder="Nhập số lượng"
                    placeholderTextColor={colors.icon}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            )}
          </View>

          {/* Title 3 */}
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
                Thông tin bán hàng
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
                  { backgroundColor: colors.secondary },
                ]}
              >
                {surveyData.products.map((product, index) => (
                  <View
                    key={index}
                    style={[
                      styles.productItem,
                      { borderColor: colors.icon + "40" },
                    ]}
                  >
                    <Text
                      style={[styles.productItemTitle, { color: colors.text }]}
                    >
                      Sản phẩm {index + 1}
                    </Text>

                    <View style={styles.field}>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Text style={[styles.label, { color: colors.text }]}>
                          Sản phẩm được bán *
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
                            style={[styles.pickerText, { color: colors.text }]}
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
                        <Text style={[styles.label, { color: colors.text }]}>
                          Loại xi măng *
                        </Text>
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
                                { color: colors.text },
                              ]}
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
                            />
                          </View>
                        </TouchableOpacity>
                      </View>
                    )}

                    <View style={styles.field}>
                      <Text style={[styles.label, { color: colors.text }]}>
                        Giá bán ra *
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
                        value={product.sellingPrice}
                        onChangeText={(value) => {
                          const formatted = formatVND(value);
                          handleProductChange(index, "sellingPrice", formatted);
                        }}
                        placeholder="Nhập giá (VND)"
                        placeholderTextColor={colors.icon}
                        keyboardType="numeric"
                      />
                    </View>
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

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              {
                backgroundColor: submitting
                  ? colors.icon + "40"
                  : colors.primary,
              },
            ]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>
                Hoàn thành khảo sát & thực thi cửa hàng
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Cement Product Picker Modal (Title 1) */}
      <Modal
        visible={showCementPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCementPicker(false)}
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
              <TouchableOpacity onPress={() => setShowCementPicker(false)}>
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
                        surveyData.cementProductId === product.Id
                          ? colors.primary + "20"
                          : "transparent",
                    },
                  ]}
                  onPress={() => {
                    handleInputChange("cementProductId", product.Id);
                    setShowCementPicker(false);
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
                    handleInputChange("cementProductId", created.Id);
                    setShowAddCementModal(false);
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
    paddingTop: 0,
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
});

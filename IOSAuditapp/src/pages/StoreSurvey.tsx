import { useEffect, useRef, useState } from "react";
import {
  IoIosArrowDown,
  IoIosArrowForward,
  IoIosArrowUp,
} from "react-icons/io";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import api from "../services/api";
import { savePendingUpload } from "../utils/pendingUploads";
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
    importedFromNPP: string;
    discountPromotion: string;
    averageStockQuantity: string;
  }>;
}

const createEmptySurveyData = (): SurveyData => ({
  // Title 2
  whyNotSellNewProduct: "",
  timeToSellNewProduct: "",
  newProductImportQuantity: "",
  supplierName: "",
  importedBySalesperson: "",
  storeComment: "",
  // Title 3
  products: [],
});

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

interface CapturedImage {
  dataUrl: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  timezoneOffset: number;
}

// Không giới hạn
const PRODUCT_TYPES = ["Xi măng"];

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

const StoreSurvey = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { colors } = useTheme();

  const storeId = id ? parseInt(id) : 0;

  // Camera states
  const [capturedImages, setCapturedImages] = useState<
    (CapturedImage | undefined)[]
  >([undefined, undefined, undefined]);
  
  // QUAN TRỌNG: Clear capturedImages mỗi khi id thay đổi (khi chuyển cửa hàng)
  useEffect(() => {
    console.log("[StoreSurvey Web] Clearing capturedImages for store:", id);
    setCapturedImages([undefined, undefined, undefined]);
  }, [id]);
  
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const [currentCameraIndex, setCurrentCameraIndex] = useState<number | null>(
    null
  );
  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    "environment"
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cementProducts, setCementProducts] = useState<CementProduct[]>([]);
  const [cementSearchModal, setCementSearchModal] = useState("");
  const [activeCementPicker, setActiveCementPicker] = useState<number | null>(
    null
  );

  const [salesUsers, setSalesUsers] = useState<
    Array<{ Id: number; FullName: string }>
  >([]);
  const [showSalesPicker, setShowSalesPicker] = useState(false);
  const [salesSearchModal, setSalesSearchModal] = useState("");

  const [, setProductTypes] = useState<string[]>(PRODUCT_TYPES);
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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expandedTitles, setExpandedTitles] = useState({
    title2: false,
    title3: false,
  });
  const [expandedProducts, setExpandedProducts] = useState<
    Record<number, boolean>
  >({});
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [notification, setNotification] = useState<{
    isOpen: boolean;
    message: string;
    type: "success" | "error" | "info";
  }>({
    isOpen: false,
    message: "",
    type: "info",
  });

  const [surveyData, setSurveyData] = useState<SurveyData>(
    createEmptySurveyData()
  );

  // Load saved survey data from localStorage for autofill (form data, not audit results)
  // Now saved per store to prevent data overlap between stores
  useEffect(() => {
    const loadSavedSurveyData = () => {
      try {
        if (user?.id && storeId && storeId > 0) {
          const storageKey = `survey_data_${user.id}_${storeId}`;
          const savedData = localStorage.getItem(storageKey);
          if (savedData) {
            const parsed = JSON.parse(savedData);
            // Load form data for autofill for this specific store
            setSurveyData(parsed);
          } else {
            // Clear form data if no saved data for this store
            // This prevents showing data from previous store
            setSurveyData(createEmptySurveyData());
          }
        } else {
          // No user or invalid storeId, clear form
          setSurveyData(createEmptySurveyData());
        }
      } catch (error) {
        console.error("Error loading saved survey data:", error);
        // On error, clear form to prevent showing stale data
        setSurveyData(createEmptySurveyData());
      }
    };
    loadSavedSurveyData();
    fetchCementProducts();
    fetchSalesUsers();
  }, [user?.id, storeId]); // Include storeId to load store-specific data

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

  const showNotification = (
    message: string,
    type: "success" | "error" | "info" = "info"
  ) => {
    setNotification({ isOpen: true, message, type });
  };

  const closeNotification = () => {
    setNotification({ ...notification, isOpen: false });
  };

  const handleClearAutofill = () => {
    if (!user?.id || !storeId || storeId <= 0) {
      showNotification(
        "Không xác định được người dùng hoặc cửa hàng để xóa dữ liệu.",
        "error"
      );
      return;
    }
    const confirmed = window.confirm(
      "Xóa dữ liệu?\nThao tác này sẽ xóa dữ liệu khảo sát đã lưu cho cửa hàng này."
    );
    if (!confirmed) return;

    try {
      const storageKey = `survey_data_${user.id}_${storeId}`;
      localStorage.removeItem(storageKey);
      setSurveyData(createEmptySurveyData());
      showNotification("Đã xóa dữ liệu thành công", "success");
    } catch (error) {
      console.error("Error clearing autofill data:", error);
      showNotification("Không thể xóa dữ liệu. Vui lòng thử lại.", "error");
    }
  };

  // Camera functions
  const getCurrentLocation = (): Promise<{
    latitude: number;
    longitude: number;
  }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          reject(error);
        },
        { timeout: 10000, maximumAge: 60000 }
      );
    });
  };

  const openCamera = async (index: number) => {
    try {
      setFacingMode("environment");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
        },
      });
      streamRef.current = stream;
      setCurrentCameraIndex(index);
      setCameraModalVisible(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((err) => {
            console.warn("Video play error:", err);
          });
        }
      }, 100);
    } catch (error) {
      console.error("Error accessing camera:", error);
      showNotification(
        "Không thể truy cập camera. Vui lòng cho phép quyền truy cập camera.",
        "error"
      );
    }
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraModalVisible(false);
    setCurrentCameraIndex(null);
    setFacingMode("environment");
  };

  const switchCamera = async () => {
    if (!videoRef.current || currentCameraIndex === null) return;

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const newFacingMode =
        facingMode === "environment" ? "user" : "environment";
      setFacingMode(newFacingMode);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: newFacingMode,
        },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((err) => {
          console.warn("Video play error:", err);
        });
      }
    } catch (error) {
      console.error("Error switching camera:", error);
      showNotification(
        "Không thể chuyển đổi camera. Vui lòng thử lại.",
        "error"
      );
    }
  };

  const captureDirectFromVideo = async (
    video: HTMLVideoElement,
    width: number,
    height: number
  ): Promise<string> => {
    await new Promise((resolve) => setTimeout(resolve, 200));

    const videoWidth = video.videoWidth || width;
    const videoHeight = video.videoHeight || height;

    if (videoWidth === 0 || videoHeight === 0) {
      throw new Error("Invalid video dimensions");
    }

    const canvas = document.createElement("canvas");
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    const ctx = canvas.getContext("2d", {
      willReadFrequently: false,
      alpha: false,
    });

    if (!ctx) {
      throw new Error("Cannot get canvas context");
    }

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, videoWidth, videoHeight);
    ctx.drawImage(video, 0, 0, videoWidth, videoHeight);

    return canvas.toDataURL("image/jpeg", 0.9);
  };

  const waitForVideoReady = async (video: HTMLVideoElement): Promise<void> => {
    if (video.readyState < 2) {
      await new Promise<void>((resolve) => {
        const onLoadedMetadata = () => {
          video.removeEventListener("loadedmetadata", onLoadedMetadata);
          resolve();
        };
        video.addEventListener("loadedmetadata", onLoadedMetadata);
        setTimeout(() => {
          video.removeEventListener("loadedmetadata", onLoadedMetadata);
          resolve();
        }, 3000);
      });
    }

    if (video.readyState < 2) {
      await new Promise<void>((resolve) => {
        const onLoadedData = () => {
          video.removeEventListener("loadeddata", onLoadedData);
          resolve();
        };
        video.addEventListener("loadeddata", onLoadedData);
        setTimeout(() => {
          video.removeEventListener("loadeddata", onLoadedData);
          resolve();
        }, 2000);
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  };

  const capturePhoto = async () => {
    if (!videoRef.current || currentCameraIndex === null || !streamRef.current)
      return;

    try {
      const video = videoRef.current;
      const stream = streamRef.current;

      await waitForVideoReady(video);

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        showNotification("Không tìm thấy video track từ camera.", "error");
        return;
      }

      const settings = videoTrack.getSettings();
      const actualWidth = settings.width || video.videoWidth;
      const actualHeight = settings.height || video.videoHeight;

      const width = actualWidth > 0 ? actualWidth : video.videoWidth;
      const height = actualHeight > 0 ? actualHeight : video.videoHeight;

      if (width === 0 || height === 0) {
        showNotification(
          "Camera chưa sẵn sàng. Vui lòng đợi một chút và thử lại.",
          "error"
        );
        return;
      }

      let dataUrl: string;

      if (typeof ImageCapture !== "undefined") {
        try {
          const imageCapture = new ImageCapture(videoTrack);
          const blob = await imageCapture.takePhoto();

          const img = new Image();
          const objectUrl = URL.createObjectURL(blob);

          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              URL.revokeObjectURL(objectUrl);
              resolve();
            };
            img.onerror = reject;
            img.src = objectUrl;
          });

          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            throw new Error("Cannot get canvas context");
          }

          ctx.drawImage(img, 0, 0);
          dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        } catch (imageCaptureError) {
          console.warn(
            "ImageCapture API failed, using direct canvas capture:",
            imageCaptureError
          );
          dataUrl = await captureDirectFromVideo(video, width, height);
        }
      } else {
        dataUrl = await captureDirectFromVideo(video, width, height);
      }

      let latitude = 0;
      let longitude = 0;
      try {
        const location = await getCurrentLocation();
        latitude = location.latitude;
        longitude = location.longitude;
      } catch (error) {
        console.warn("Could not get location:", error);
      }

      const now = new Date();
      const capturedImage: CapturedImage = {
        dataUrl,
        latitude,
        longitude,
        timestamp: now.toISOString(),
        timezoneOffset: now.getTimezoneOffset(),
      };

      const newImages = [...capturedImages];
      newImages[currentCameraIndex] = capturedImage;
      setCapturedImages(newImages);

      closeCamera();
    } catch (error) {
      console.error("Error capturing photo:", error);
      showNotification("Lỗi khi chụp ảnh", "error");
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...capturedImages];
    newImages[index] = undefined;
    setCapturedImages(newImages);
  };

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

  const filteredCementProductsModal = cementProducts.filter((product) =>
    product.Name.toLowerCase().includes(cementSearchModal.toLowerCase())
  );

  const filteredSalesUsersModal = salesUsers.filter((user) =>
    (user.FullName || "").toLowerCase().includes(salesSearchModal.toLowerCase())
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
          productType: "Xi măng",
          cementProductId: null,
          contactPersonPhone: firstProductContact,
          purchasePrice: "",
          sellingPrice: "",
          roadTransportFee: "",
          waterTransportFee: "",
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
    const currentValue = surveyData.products[productIndex]?.[field] || "";
    setActivePricePicker({ productIndex, field });
    setCustomPriceValue(typeof currentValue === "string" ? currentValue : "");
  };

  const closePricePicker = () => {
    setActivePricePicker(null);
    setCustomPriceValue("");
  };

  const openCementPicker = (productIndex: number) => {
    setActiveCementPicker(productIndex);
    setCementSearchModal("");
  };

  const closeCementPicker = () => {
    setActiveCementPicker(null);
    setCementSearchModal("");
  };

  const handleSelectCementProduct = (
    productIndex: number,
    cementProductId: number
  ) => {
    handleProductChange(productIndex, "cementProductId", cementProductId);
    closeCementPicker();
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
      showNotification("Vui lòng nhập giá hợp lệ", "error");
      return;
    }
    const numericValue = parseVND(customPriceValue);
    if (numericValue < 0) {
      showNotification("Giá không hợp lệ", "error");
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

    // Title 3 validation (optional): nếu không nhập sản phẩm, bỏ qua lỗi
    surveyData.products.forEach((product, index) => {
      const hasAnyValue = Object.values(product || {}).some(
        (v) => v !== null && v !== undefined && `${v}`.trim() !== ""
      );
      if (!hasAnyValue) return; // bỏ qua sản phẩm trống

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
      if (!product.importedFromNPP) {
        errors.push(`Sản phẩm ${index + 1}: Nhập từ NPP`);
      }
      if (!product.averageStockQuantity) {
        errors.push(`Sản phẩm ${index + 1}: Sản lượng bình quân (tấn/tháng)`);
      }
    });

    return errors;
  };

  const handleSubmit = async () => {
    const errors = validateSurvey();
    if (errors.length > 0) {
      setShowValidationModal(true);
    } else {
      await submitSurvey();
    }
  };

  const submitSurvey = async () => {
    if (!user || !storeId) {
      showNotification("Lỗi: Thiếu thông tin cần thiết", "error");
      return;
    }

    // Check if all 3 images are captured
    const hasAllImages = [0, 1, 2].every((index) => capturedImages[index]);
    if (!hasAllImages) {
      showNotification("Lỗi: Vui lòng chụp đầy đủ 3 ảnh", "error");
      return;
    }

    const parsedStoreId =
      typeof storeId === "string" ? parseInt(storeId) : storeId;
    if (isNaN(parsedStoreId)) {
      showNotification("Lỗi: ID cửa hàng không hợp lệ", "error");
      return;
    }

    // Kiểm tra ảnh trước
    const imagesToUpload = capturedImages.filter(
      (img): img is NonNullable<typeof img> => img !== undefined && img !== null
    );

    if (imagesToUpload.length !== 3) {
      showNotification("Vui lòng chụp đầy đủ 3 ảnh", "error");
      return;
    }

    setSubmitting(true);

    try {
      // Step 1: Tạo audit ngay lập tức (không chờ upload ảnh)
      const auditResponse = await api.post("/audits", {
        userId: user.id,
        storeId: parsedStoreId,
        notes: surveyData.storeComment?.trim() || null,
        auditDate: new Date().toISOString(),
      });

      const auditId = auditResponse.data.Id;

      // Step 2: Tạo survey ngay lập tức (không chờ upload ảnh)
      const newProductImportQty =
        surveyData.newProductImportQuantity?.trim() || null;

      await api.post("/store-surveys", {
        storeId: parsedStoreId,
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
          importedFromNPP: p.importedFromNPP,
          discountPromotion: p.discountPromotion || null,
          averageStockQuantity: p.averageStockQuantity?.trim()
            ? parseFloat(p.averageStockQuantity)
            : null,
        })),
      });

      // Save form data for autofill for this specific store
      if (user?.id) {
        try {
          const storageKey = `survey_data_${user.id}_${parsedStoreId}`;
          localStorage.setItem(storageKey, JSON.stringify(surveyData));
        } catch (error) {
          console.error("Error saving survey data for store:", error);
        }
      }

      setSubmitting(false);

      // Lưu pending upload vào localStorage để hiển thị khi quay lại
      savePendingUpload(
        parsedStoreId,
        auditId,
        imagesToUpload.map((img) => ({
          dataUrl: img.dataUrl,
          latitude: img.latitude,
          longitude: img.longitude,
          timestamp: img.timestamp,
          timezoneOffset: img.timezoneOffset,
        })),
        surveyData.storeComment || ""
      );

      // Hiển thị thông báo thành công trước khi navigate
      showNotification("Đã hoàn thành khảo sát thành công", "success");

      // Navigate sau khi hiển thị thông báo (delay ngắn để user thấy thông báo)
      setTimeout(() => {
        navigate(`/stores/${parsedStoreId}`);
      }, 1000);
    } catch (error: unknown) {
      console.error("Error submitting survey:", error);
      setSubmitting(false);
      const errorMessage =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ||
        (error as { message?: string })?.message ||
        "Có lỗi xảy ra khi lưu khảo sát";
      showNotification(`Lỗi: ${errorMessage}`, "error");
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
        <h1
          className="store-survey-title"
          style={{ color: colors.text, fontWeight: "normal" }}
        >
          Khảo sát cửa hàng
        </h1>
      </div>

      <div className="store-survey-content">
        <div
          className="store-survey-autofill-row"
          style={{
            borderColor: `${colors.icon}33`,
            backgroundColor: colors.secondary,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            className="store-survey-clear-autofill"
            onClick={handleClearAutofill}
            style={{
              color: "#cc0000",
              borderColor: "#ffcccc",
              backgroundColor: "#ffe6e6",
            }}
          >
            Xóa dữ liệu đã điền
          </button>
        </div>

        {/* Ghi chú/Ý kiến - Luôn hiển thị ở đầu trang */}
        <div
          className="store-survey-title-section"
          style={{ marginBottom: 16 }}
        >
          <div
            className="store-survey-title-header"
            style={{
              background: colors.background,
              paddingTop: 12,
              paddingBottom: 12,
            }}
          >
            <h2 style={{ color: colors.text, fontSize: 16, margin: 0 }}>
              Ý kiến/Ghi chú
            </h2>
          </div>
          <div
            className="store-survey-title-content"
            style={{ backgroundColor: colors.secondary, paddingTop: 16 }}
          >
            <div className="store-survey-field">
              <textarea
                value={surveyData.storeComment}
                onChange={(e) =>
                  handleInputChange("storeComment", e.target.value)
                }
                placeholder="Nhập Ý kiến/Ghi chú (không bắt buộc)"
                rows={3}
                style={{
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.icon + "40",
                  width: "100%",
                  padding: "12px",
                  borderRadius: 8,
                  borderWidth: 1,
                  fontSize: 14,
                  fontFamily: "inherit",
                }}
              />
            </div>
          </div>
        </div>

        {/* Title 3 - Thông tin bán hàng (Hiển thị ở trên) */}
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
              Thông tin bán hàng <span style={{ color: "#ff4d00" }}>*</span>
            </h2>
            <span
              style={{ color: expandedTitles.title3 ? "#fff" : colors.icon }}
            >
              {expandedTitles.title3 ? <IoIosArrowUp /> : <IoIosArrowDown />}
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
                        {expandedProducts[index] ? (
                          <IoIosArrowDown />
                        ) : (
                          <IoIosArrowForward />
                        )}
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
                      {product.productType === "Xi măng" && (
                        <div className="store-survey-field">
                          <label style={{ color: colors.text }}>
                            Loại xi măng
                          </label>
                          <button
                            type="button"
                            className="store-survey-dropdown-trigger"
                            style={{
                              backgroundColor: colors.background,
                              borderColor: colors.icon + "40",
                              color: product.cementProductId
                                ? colors.text
                                : colors.icon,
                            }}
                            onClick={() => openCementPicker(index)}
                          >
                            <span className="store-survey-dropdown-value">
                              {product.cementProductId
                                ? cementProducts.find(
                                    (p) => p.Id === product.cementProductId
                                  )?.Name || "Chọn loại xi măng"
                                : "Chọn loại xi măng"}
                            </span>
                            <span
                              className="store-survey-dropdown-icon"
                              style={{ color: colors.icon }}
                            >
                              <IoIosArrowDown />
                            </span>
                          </button>
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
                        <button
                          type="button"
                          className="store-survey-dropdown-trigger"
                          style={{
                            backgroundColor: colors.background,
                            borderColor: colors.icon + "40",
                            color: product.purchasePrice
                              ? colors.text
                              : colors.icon,
                          }}
                          onClick={() =>
                            openPricePicker(index, "purchasePrice")
                          }
                        >
                          <span className="store-survey-dropdown-value">
                            {product.purchasePrice ||
                              "Chọn giá mua vào hoặc nhập mới"}
                          </span>
                          <span>
                            <IoIosArrowDown />
                          </span>
                        </button>
                      </div>

                      <div className="store-survey-field">
                        <label style={{ color: colors.text }}>Giá bán ra</label>
                        <button
                          type="button"
                          className="store-survey-dropdown-trigger"
                          style={{
                            backgroundColor: colors.background,
                            borderColor: colors.icon + "40",
                            color: product.sellingPrice
                              ? colors.text
                              : colors.icon,
                          }}
                          onClick={() => openPricePicker(index, "sellingPrice")}
                        >
                          <span className="store-survey-dropdown-value">
                            {product.sellingPrice ||
                              "Chọn giá bán ra hoặc nhập mới"}
                          </span>
                          <span>
                            <IoIosArrowDown />
                          </span>
                        </button>
                      </div>
                      <div className="store-survey-field">
                        <label style={{ color: colors.text }}>
                          Phí vận chuyển đường bộ
                        </label>
                        <button
                          type="button"
                          className="store-survey-dropdown-trigger"
                          style={{
                            backgroundColor: colors.background,
                            borderColor: colors.icon + "40",
                            color: product.roadTransportFee
                              ? colors.text
                              : colors.icon,
                          }}
                          onClick={() =>
                            openPricePicker(index, "roadTransportFee")
                          }
                        >
                          <span className="store-survey-dropdown-value">
                            {product.roadTransportFee ||
                              "Chọn phí đường bộ hoặc nhập mới"}
                          </span>
                          <span>
                            <IoIosArrowDown />
                          </span>
                        </button>
                      </div>

                      <div className="store-survey-field">
                        <label style={{ color: colors.text }}>
                          Phí vận chuyển đường thủy
                        </label>
                        <button
                          type="button"
                          className="store-survey-dropdown-trigger"
                          style={{
                            backgroundColor: colors.background,
                            borderColor: colors.icon + "40",
                            color: product.waterTransportFee
                              ? colors.text
                              : colors.icon,
                          }}
                          onClick={() =>
                            openPricePicker(index, "waterTransportFee")
                          }
                        >
                          <span className="store-survey-dropdown-value">
                            {product.waterTransportFee ||
                              "Chọn phí đường thủy hoặc nhập mới"}
                          </span>
                          <span>
                            <IoIosArrowDown />
                          </span>
                        </button>
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
                          Sản lượng bình quân (tấn/tháng)
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
                          placeholder="Nhập sản lượng bình quân (tấn/tháng)"
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
                Thêm sản phẩm
              </button>
            </div>
          )}
        </div>

        {/* Title 2 - Khảo sát sản phẩm của XMTĐ (Hiển thị ở dưới) */}
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
              Khảo sát sản phẩm của XMTĐ{" "}
              <span style={{ color: "#ff4d00" }}>*</span>
            </h2>
            <span
              style={{ color: expandedTitles.title2 ? "#fff" : colors.icon }}
            >
              {expandedTitles.title2 ? <IoIosArrowUp /> : <IoIosArrowDown />}
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
                <label
                  style={{
                    color: colors.text,
                    wordWrap: "break-word",
                    overflowWrap: "break-word",
                    maxWidth: "100%",
                  }}
                >
                  Thời gian để bán sản phẩm mới
                </label>
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    maxWidth: "100%",
                    minWidth: 0,
                    overflow: "hidden",
                  }}
                >
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
                      maxWidth: "100%",
                      minWidth: 0,
                      paddingRight: 12,
                      boxSizing: "border-box",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  />
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
                <button
                  type="button"
                  className="store-survey-dropdown-trigger"
                  style={{
                    backgroundColor: colors.background,
                    borderColor: colors.icon + "40",
                    color: surveyData.importedBySalesperson
                      ? colors.text
                      : colors.icon,
                  }}
                  onClick={() => {
                    setSalesSearchModal("");
                    setShowSalesPicker(true);
                  }}
                >
                  <span className="store-survey-dropdown-value">
                    {surveyData.importedBySalesperson || "Chọn thương vụ"}
                  </span>
                  <span
                    className="store-survey-dropdown-icon"
                    style={{ color: colors.icon }}
                  >
                    <IoIosArrowDown />
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Chụp ảnh - Sau form khảo sát, trước nút submit */}
        <div className="store-survey-title-section" style={{ marginTop: 16 }}>
          <div
            className="store-survey-title-header"
            style={{
              background: colors.background,
              paddingTop: 12,
              paddingBottom: 12,
            }}
          >
            <h2 style={{ color: colors.text, fontSize: 16, margin: 0 }}>
              Chụp ảnh <span style={{ color: "#ff4d00" }}>*</span>
            </h2>
          </div>
          <div
            className="store-survey-title-content"
            style={{ backgroundColor: colors.secondary, paddingTop: 16 }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "12px",
                marginBottom: 16,
              }}
            >
              {[0, 1, 2].map((index) => {
                const image = capturedImages[index];
                return (
                  <div
                    key={index}
                    style={{
                      position: "relative",
                      aspectRatio: 1,
                      borderRadius: 8,
                      overflow: "hidden",
                    }}
                  >
                    {image ? (
                      <div
                        style={{
                          position: "relative",
                          width: "100%",
                          height: "100%",
                        }}
                      >
                        <img
                          src={image.dataUrl}
                          alt={`Captured ${index + 1}`}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            borderRadius: 8,
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          style={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            background: "rgba(255, 255, 255, 0.9)",
                            border: "none",
                            borderRadius: "50%",
                            width: 24,
                            height: 24,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openCamera(index)}
                        style={{
                          width: "100%",
                          height: "100%",
                          border: `2px dashed ${colors.icon}40`,
                          borderRadius: 8,
                          background: "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          fontSize: 32,
                          color: colors.icon,
                        }}
                      >
                        📷
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
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
            {submitting ? "Đang xử lý..." : "Hoàn thành"}
          </button>
        </div>
      </div>

      {activePricePicker && (
        <div className="store-survey-modal-backdrop">
          <div className="store-survey-modal store-survey-price-modal">
            <div className="store-survey-price-modal-header">
              <h2>
                {`Chọn ${
                  activePricePicker
                    ? PRICE_FIELD_LABELS[activePricePicker.field]
                    : ""
                }`}
              </h2>
              <button
                type="button"
                onClick={closePricePicker}
                className="store-survey-price-close"
              >
                ×
              </button>
            </div>
            <p className="store-survey-price-modal-desc">
              Chọn giá có sẵn hoặc nhập giá mới bên dưới
            </p>
            <input
              type="text"
              value={customPriceValue}
              onChange={(e) => handleCustomPriceInputChange(e.target.value)}
              placeholder={
                activePricePicker
                  ? `Nhập ${PRICE_FIELD_LABELS[activePricePicker.field]} (VND)`
                  : "Nhập giá"
              }
            />
            <div className="store-survey-price-options">
              {(activePricePicker
                ? getOptionsForField(activePricePicker.field)
                : []
              ).map((price, optionIndex) => (
                <button
                  type="button"
                  key={`${price}-${optionIndex}`}
                  className="store-survey-price-option"
                  onClick={() => handleSelectPriceOption(price)}
                >
                  {price.toLocaleString("vi-VN")} VND
                </button>
              ))}
            </div>
            <div className="store-survey-modal-actions">
              <button type="button" onClick={closePricePicker}>
                Hủy
              </button>
              <button
                type="button"
                onClick={handleCustomPriceSave}
                style={{ backgroundColor: colors.primary, color: "#fff" }}
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal chọn loại xi măng */}
      {activeCementPicker !== null && (
        <div className="store-survey-modal-backdrop">
          <div className="store-survey-modal store-survey-price-modal">
            <div className="store-survey-price-modal-header">
              <h2>Chọn loại xi măng</h2>
              <button
                type="button"
                onClick={closeCementPicker}
                className="store-survey-price-close"
              >
                ×
              </button>
            </div>
            <div
              style={{
                marginBottom: 16,
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              <input
                type="text"
                value={cementSearchModal}
                onChange={(e) => setCementSearchModal(e.target.value)}
                placeholder="Tìm kiếm loại xi măng"
                style={{
                  width: "100%",
                  maxWidth: "100%",
                  padding: "12px",
                  borderRadius: 8,
                  border: `1px solid ${colors.icon}40`,
                  backgroundColor: colors.background,
                  color: colors.text,
                  fontSize: 16,
                  boxSizing: "border-box",
                  minWidth: 0,
                }}
              />
            </div>
            <div
              className="store-survey-price-options"
              style={{
                maxHeight: "300px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {filteredCementProductsModal.length > 0 ? (
                filteredCementProductsModal.map((cp) => (
                  <button
                    type="button"
                    key={cp.Id}
                    className="store-survey-price-option"
                    onClick={() =>
                      handleSelectCementProduct(activeCementPicker, cp.Id)
                    }
                    style={{
                      textAlign: "left",
                      justifyContent: "flex-start",
                      padding: "12px 16px",
                    }}
                  >
                    {cp.Name}
                  </button>
                ))
              ) : (
                <div
                  style={{
                    padding: "16px",
                    textAlign: "center",
                    color: colors.icon,
                  }}
                >
                  Không tìm thấy loại xi măng
                </div>
              )}
            </div>
            <div className="store-survey-modal-actions">
              <button type="button" onClick={closeCementPicker}>
                Đóng
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
                    showNotification("Vui lòng nhập tên sản phẩm", "error");
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

      {/* Modal chọn thương vụ */}
      {showSalesPicker && (
        <div className="store-survey-modal-backdrop">
          <div className="store-survey-modal store-survey-price-modal">
            <div className="store-survey-price-modal-header">
              <h2>Chọn thương vụ</h2>
              <button
                type="button"
                onClick={() => {
                  setShowSalesPicker(false);
                  setSalesSearchModal("");
                }}
                className="store-survey-price-close"
              >
                ×
              </button>
            </div>
            <div
              style={{
                marginBottom: 16,
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              <input
                type="text"
                value={salesSearchModal}
                onChange={(e) => setSalesSearchModal(e.target.value)}
                placeholder="Tìm kiếm thương vụ"
                style={{
                  width: "100%",
                  maxWidth: "100%",
                  padding: "12px",
                  borderRadius: 8,
                  border: `1px solid ${colors.icon}40`,
                  backgroundColor: colors.background,
                  color: colors.text,
                  fontSize: 16,
                  boxSizing: "border-box",
                  minWidth: 0,
                }}
              />
            </div>
            <div
              className="store-survey-price-options"
              style={{
                maxHeight: "300px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {filteredSalesUsersModal.length > 0 ? (
                filteredSalesUsersModal.map((user) => (
                  <button
                    type="button"
                    key={user.Id}
                    className="store-survey-price-option"
                    onClick={() => {
                      handleInputChange("importedBySalesperson", user.FullName);
                      setShowSalesPicker(false);
                      setSalesSearchModal("");
                    }}
                    style={{
                      textAlign: "left",
                      justifyContent: "flex-start",
                      padding: "12px 16px",
                    }}
                  >
                    {user.FullName}
                  </button>
                ))
              ) : (
                <div
                  style={{
                    padding: "16px",
                    textAlign: "center",
                    color: colors.icon,
                  }}
                >
                  Không tìm thấy thương vụ
                </div>
              )}
            </div>
            <div className="store-survey-modal-actions">
              <button
                type="button"
                onClick={() => {
                  setShowSalesPicker(false);
                  setSalesSearchModal("");
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Validation Warning Modal */}
      {showValidationModal && (
        <div className="store-survey-modal-backdrop">
          <div
            className="store-survey-modal"
            style={{ maxWidth: "400px", width: "85%" }}
          >
            <h2
              style={{
                color: colors.text,
                fontSize: "20px",
                fontWeight: "bold",
                marginBottom: "8px",
              }}
            >
              Cảnh báo
            </h2>
            <p
              style={{
                color: colors.icon,
                marginBottom: "16px",
                fontSize: "14px",
              }}
            >
              Vui lòng điền đầy đủ tất cả các thông tin khảo sát, bao gồm cả 2
              phần liên quan đến cửa hàng để hoàn tất quá trình đánh giá.
            </p>
            <div
              className="store-survey-modal-actions"
              style={{
                display: "flex",
                gap: "12px",
              }}
            >
              <button
                type="button"
                onClick={() => setShowValidationModal(false)}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "#f1f5f9",
                  color: colors.text,
                  fontWeight: "600",
                  fontSize: "16px",
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#e2e8f0";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#f1f5f9";
                }}
              >
                Tiếp tục điền
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowValidationModal(false);
                  submitSurvey();
                }}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: colors.primary,
                  color: "#fff",
                  fontWeight: "600",
                  fontSize: "16px",
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#1e40af";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.primary;
                }}
              >
                Xác nhận hoàn thành
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Modal */}
      {cameraModalVisible && (
        <div className="store-detail-camera-modal-overlay">
          <div className="store-detail-camera-modal-content">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="store-detail-camera-video"
            />
            <div className="store-detail-camera-modal-buttons">
              <button
                className="store-detail-camera-modal-button"
                onClick={closeCamera}
              >
                Hủy
              </button>
              <button
                className="store-detail-camera-modal-button store-detail-camera-modal-button-switch"
                onClick={switchCamera}
                title={
                  facingMode === "environment"
                    ? "Chuyển sang camera trước"
                    : "Chuyển sang camera sau"
                }
              >
                <span className="camera-switch-icon">
                  {facingMode === "environment" ? "⇄" : "⇄"}
                </span>
              </button>
              <button
                className="store-detail-camera-modal-button store-detail-camera-modal-button-capture"
                onClick={capturePhoto}
                style={{ backgroundColor: colors.primary, color: "#fff" }}
              >
                Chụp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Modal */}
      {notification.isOpen && (
        <div
          className="store-survey-modal-backdrop"
          onClick={closeNotification}
        >
          <div
            className="store-survey-modal"
            style={{
              maxWidth: "400px",
              width: "85%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor:
                    notification.type === "success"
                      ? "#10b981"
                      : notification.type === "error"
                      ? "#ef4444"
                      : "#3b82f6",
                  flexShrink: 0,
                }}
              >
                <span style={{ color: "#fff", fontSize: "20px" }}>
                  {notification.type === "success"
                    ? "✓"
                    : notification.type === "error"
                    ? "✕"
                    : "ℹ"}
                </span>
              </div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "18px",
                  fontWeight: "600",
                  color: colors.text,
                  flex: 1,
                }}
              >
                {notification.type === "success"
                  ? "Thành công"
                  : notification.type === "error"
                  ? "Lỗi"
                  : "Thông báo"}
              </h2>
            </div>
            <p
              style={{
                color: colors.text,
                marginBottom: "20px",
                fontSize: "14px",
                lineHeight: "1.5",
                wordWrap: "break-word",
                overflowWrap: "break-word",
              }}
            >
              {notification.message}
            </p>
            <div className="store-survey-modal-actions">
              <button
                type="button"
                onClick={closeNotification}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: colors.primary,
                  color: "#fff",
                  fontWeight: "600",
                  fontSize: "16px",
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreSurvey;

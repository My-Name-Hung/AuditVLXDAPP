const ExcelJS = require("exceljs");
const StoreSurvey = require("../models/StoreSurvey");
const StoreSurveyProduct = require("../models/StoreSurveyProduct");

const createStoreSurvey = async (req, res) => {
  try {
    const {
      storeId,
      auditId,
      userId,
      // Title 1
      cementProductId,
      contactPerson,
      purchasePrice,
      sellingPrice,
      supplierName,
      roadTransportFee,
      waterTransportFee,
      importExportQuantity,
      stockQuantity,
      consumptionArea,
      debtPeriod,
      // Title 2
      whyNotSellNewProduct,
      timeToSellNewProduct,
      newProductImportQuantity,
      importedBySalesperson,
      storeComment,
      // Title 3 - Products
      products,
    } = req.body;

    if (!storeId || !auditId || !userId) {
      return res
        .status(400)
        .json({ error: "StoreId, AuditId, and UserId are required" });
    }

    // Create survey
    const survey = await StoreSurvey.create({
      StoreId: storeId,
      AuditId: auditId,
      UserId: userId,
      CementProductId: cementProductId,
      ContactPerson: contactPerson,
      PurchasePrice: purchasePrice,
      SellingPrice: sellingPrice,
      SupplierName: supplierName,
      RoadTransportFee: roadTransportFee,
      WaterTransportFee: waterTransportFee,
      ImportExportQuantity: importExportQuantity,
      StockQuantity: stockQuantity,
      ConsumptionArea: consumptionArea,
      DebtPeriod: debtPeriod,
      WhyNotSellNewProduct: whyNotSellNewProduct,
      TimeToSellNewProduct: timeToSellNewProduct,
      NewProductImportQuantity: newProductImportQuantity,
      ImportedBySalesperson: importedBySalesperson,
      StoreComment: storeComment,
    });

    // Create products if provided
    if (Array.isArray(products) && products.length > 0) {
      const productsToCreate = products.map((p) => ({
        StoreSurveyId: survey.Id,
        ProductType: p.productType,
        CementProductId: p.cementProductId,
        SellingPrice: p.sellingPrice,
        ContactPersonPhone: p.contactPersonPhone,
        PurchasePrice: p.purchasePrice,
        RoadTransportFee: p.roadTransportFee,
        WaterTransportFee: p.waterTransportFee,
        ImportedFromNPP: p.importedFromNPP,
        DiscountPromotion: p.discountPromotion,
        AverageStockQuantity: p.averageStockQuantity,
      }));

      await StoreSurveyProduct.bulkCreate(productsToCreate);
    }

    // Get full survey with products
    const fullSurvey = await StoreSurvey.findById(survey.Id);
    const surveyProducts = await StoreSurveyProduct.findBySurveyId(survey.Id);

    res.status(201).json({
      ...fullSurvey,
      products: surveyProducts,
    });
  } catch (error) {
    console.error("Create store survey error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getStoreSurveyById = async (req, res) => {
  try {
    const { id } = req.params;
    const survey = await StoreSurvey.findById(id);

    if (!survey) {
      return res.status(404).json({ error: "Store survey not found" });
    }

    const products = await StoreSurveyProduct.findBySurveyId(id);

    res.json({
      ...survey,
      products: products,
    });
  } catch (error) {
    console.error("Get store survey by id error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getStoreSurveyByAuditId = async (req, res) => {
  try {
    const { auditId } = req.params;
    const survey = await StoreSurvey.findByAuditId(auditId);

    if (!survey) {
      return res.status(404).json({ error: "Store survey not found" });
    }

    const products = await StoreSurveyProduct.findBySurveyId(survey.Id);

    res.json({
      ...survey,
      products: products,
    });
  } catch (error) {
    console.error("Get store survey by audit id error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getStoreSurveysByStoreId = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { userId } = req.query;

    const filters = {};
    if (userId) filters.userId = parseInt(userId);

    const surveys = await StoreSurvey.findByStoreId(storeId, filters);

    // Get products for each survey
    const surveysWithProducts = await Promise.all(
      surveys.map(async (survey) => {
        const products = await StoreSurveyProduct.findBySurveyId(survey.Id);
        return {
          ...survey,
          products: products,
        };
      })
    );

    res.json(surveysWithProducts);
  } catch (error) {
    console.error("Get store surveys by store id error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getAllStoreSurveys = async (req, res) => {
  try {
    const {
      storeId,
      userId,
      auditId,
      storeName,
      userName,
      cementProductName,
      territoryName,
      priceFrom,
      priceTo,
      productType,
      includeProducts,
      page,
      pageSize,
    } = req.query;

    const filters = {};
    if (storeId) filters.storeId = parseInt(storeId);
    if (userId) filters.userId = parseInt(userId);
    if (auditId) filters.auditId = parseInt(auditId);
    if (storeName) filters.storeName = storeName;
    if (userName) filters.userName = userName;
    if (cementProductName) filters.cementProductName = cementProductName;
    if (territoryName) filters.territoryName = territoryName;
    if (priceFrom) filters.priceFrom = parseFloat(priceFrom);
    if (priceTo) filters.priceTo = parseFloat(priceTo);
    if (productType) filters.productType = productType; // 'xmtd' or 'non-xmtd'
    if (page && pageSize) {
      filters.page = parseInt(page);
      filters.pageSize = parseInt(pageSize);
    }

    const surveys = await StoreSurvey.findAll(filters);

    // Optionally include products to reduce payload for list page
    const shouldIncludeProducts = includeProducts === "true";
    let surveysWithProducts = surveys;

    if (shouldIncludeProducts && surveys.length > 0) {
      // Fetch all products in one query instead of N queries (optimize N+1 problem)
      const surveyIds = surveys.map((s) => s.Id);
      const allProducts = await StoreSurveyProduct.findBySurveyIds(surveyIds);

      // Group products by survey ID
      const productsMap = new Map();
      allProducts.forEach((product) => {
        const surveyId = product.StoreSurveyId;
        if (!productsMap.has(surveyId)) {
          productsMap.set(surveyId, []);
        }
        productsMap.get(surveyId).push(product);
      });

      // Attach products to surveys
      surveysWithProducts = surveys.map((survey) => ({
        ...survey,
        products: productsMap.get(survey.Id) || [],
      }));
    }

    res.json(surveysWithProducts);
  } catch (error) {
    console.error("Get all store surveys error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const updateStoreSurvey = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      cementProductId,
      contactPerson,
      purchasePrice,
      sellingPrice,
      supplierName,
      roadTransportFee,
      waterTransportFee,
      importExportQuantity,
      stockQuantity,
      consumptionArea,
      debtPeriod,
      whyNotSellNewProduct,
      timeToSellNewProduct,
      newProductImportQuantity,
      importedBySalesperson,
      storeComment,
      products,
    } = req.body;

    const survey = await StoreSurvey.findById(id);
    if (!survey) {
      return res.status(404).json({ error: "Store survey not found" });
    }

    // Update survey
    const updated = await StoreSurvey.update(id, {
      CementProductId: cementProductId,
      ContactPerson: contactPerson,
      PurchasePrice: purchasePrice,
      SellingPrice: sellingPrice,
      SupplierName: supplierName,
      RoadTransportFee: roadTransportFee,
      WaterTransportFee: waterTransportFee,
      ImportExportQuantity: importExportQuantity,
      StockQuantity: stockQuantity,
      ConsumptionArea: consumptionArea,
      DebtPeriod: debtPeriod,
      WhyNotSellNewProduct: whyNotSellNewProduct,
      TimeToSellNewProduct: timeToSellNewProduct,
      NewProductImportQuantity: newProductImportQuantity,
      ImportedBySalesperson: importedBySalesperson,
      StoreComment: storeComment,
    });

    // Update products if provided
    if (Array.isArray(products)) {
      // Delete existing products
      const existingProducts = await StoreSurveyProduct.findBySurveyId(id);
      for (const product of existingProducts) {
        await StoreSurveyProduct.delete(product.Id);
      }

      // Create new products
      if (products.length > 0) {
        const productsToCreate = products.map((p) => ({
          StoreSurveyId: id,
          ProductType: p.productType,
          CementProductId: p.cementProductId,
          SellingPrice: p.sellingPrice,
        }));

        await StoreSurveyProduct.bulkCreate(productsToCreate);
      }
    }

    const surveyProducts = await StoreSurveyProduct.findBySurveyId(id);

    res.json({
      ...updated,
      products: surveyProducts,
    });
  } catch (error) {
    console.error("Update store survey error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const deleteStoreSurvey = async (req, res) => {
  try {
    const { id } = req.params;

    const survey = await StoreSurvey.findById(id);
    if (!survey) {
      return res.status(404).json({ error: "Store survey not found" });
    }

    await StoreSurvey.delete(id);
    res.json({ message: "Store survey deleted successfully" });
  } catch (error) {
    console.error("Delete store survey error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Helper function to format VND
const formatVND = (value) => {
  if (value === null || value === undefined) return "";
  return Number(value).toLocaleString("vi-VN");
};

// Helper function to format date
const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("vi-VN");
};

// Calculate week numbers from a specific date
const calculateWeekNumbers = (date) => {
  const year = date.getFullYear();
  const day = date.getDate();

  const weekNumberInMonth = Math.ceil(day / 7);

  const januaryFirst = new Date(year, 0, 1);
  const firstDayOfWeek = januaryFirst.getDay();
  const firstMondayOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const daysSinceYearStart = Math.floor(
    (date.getTime() - januaryFirst.getTime()) / (1000 * 60 * 60 * 24)
  );

  const weekNumberInYear = Math.ceil(
    (daysSinceYearStart + firstMondayOffset + 1) / 7
  );

  return { weekNumberInMonth, weekNumberInYear, year };
};

const exportStoreSurveys = async (req, res) => {
  try {
    const { dateFrom, dateTo, userId, territoryId } = req.query;

    if (!dateFrom || !dateTo || !userId) {
      return res.status(400).json({
        error: "dateFrom, dateTo, and userId are required",
      });
    }

    // Build filters
    const filters = {
      dateFrom,
      dateTo,
      userId: parseInt(userId),
    };

    if (territoryId) {
      filters.territoryId = parseInt(territoryId);
    }

    // Fetch surveys with filters
    const surveys = await StoreSurvey.findAll(filters);

    if (!surveys || surveys.length === 0) {
      return res.status(404).json({ error: "No surveys found" });
    }

    // Fetch products for all surveys
    const surveyIds = surveys.map((s) => s.Id);
    const allProducts = await StoreSurveyProduct.findBySurveyIds(surveyIds);

    // Group products by survey ID
    const productsMap = new Map();
    allProducts.forEach((product) => {
      const surveyId = product.StoreSurveyId;
      if (!productsMap.has(surveyId)) {
        productsMap.set(surveyId, []);
      }
      productsMap.get(surveyId).push(product);
    });

    // Attach products to surveys
    const surveysWithProducts = surveys.map((survey) => ({
      ...survey,
      products: productsMap.get(survey.Id) || [],
    }));

    // Filter only XMTĐ products
    let xmtdSurveys = surveysWithProducts.filter(
      (survey) =>
        survey.WhyNotSellNewProduct ||
        (survey.products && survey.products.length > 0)
    );

    // Group by TerritoryName
    const territoryGroups = new Map();
    xmtdSurveys.forEach((survey) => {
      const territory = survey.TerritoryName || "Chưa xác định";
      if (!territoryGroups.has(territory)) {
        territoryGroups.set(territory, []);
      }
      territoryGroups.get(territory).push(survey);
    });

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();

    // Header style
    const headerStyle = {
      font: { bold: true, color: { argb: "FFFFFFFF" } },
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0138C3" },
      },
      alignment: {
        horizontal: "center",
        vertical: "middle",
      },
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      },
    };

    // Calculate date info for title
    const startDate = new Date(dateFrom);
    const endDate = new Date(dateTo);
    const year = startDate.getFullYear();
    let weekNumberInMonth = 0;
    let weekNumberInYear = 0;
    let exportMonthLabel = null;

    // Check if it's a month range (same month)
    if (
      startDate.getMonth() === endDate.getMonth() &&
      startDate.getFullYear() === endDate.getFullYear()
    ) {
      exportMonthLabel = `${String(startDate.getMonth() + 1).padStart(2, "0")}/${year}`;
    } else {
      // Calculate week numbers
      const weekNumbers = calculateWeekNumbers(startDate);
      weekNumberInMonth = weekNumbers.weekNumberInMonth || 0;
      weekNumberInYear = weekNumbers.weekNumberInYear || 0;
    }

    // Create sheets for each territory
    territoryGroups.forEach((territorySurveys, territoryName) => {
      if (!territorySurveys || territorySurveys.length === 0) {
        return;
      }

      // Sanitize sheet name
      const sanitizeSheetName = (name) => {
        let sanitized = name.replace(/[\\/?:*[\]]/g, "");
        if (sanitized.length > 31) {
          sanitized = sanitized.substring(0, 31);
        }
        if (!sanitized.trim()) {
          sanitized = "Chua xac dinh";
        }
        return sanitized;
      };

      const sheetName = sanitizeSheetName(territoryName || "Chưa xác định");
      const sheet = workbook.addWorksheet(sheetName);

      // Add empty rows for titles
      sheet.addRow([]);
      sheet.addRow([]);
      sheet.addRow([]);

      // Title rows
      try {
        sheet.mergeCells("A1:O1");
      } catch (e) {
        console.warn("Error merging A1:O1:", e);
      }
      const mainTitle = exportMonthLabel
        ? "BÁO CÁO THĂM CỬA HÀNG"
        : `BÁO CÁO THĂM CỬA HÀNG TUẦN ${weekNumberInMonth || ""}`;
      sheet.getCell("A1").value = mainTitle || "";
      sheet.getCell("A1").font = { bold: true, size: 14 };
      sheet.getCell("A1").alignment = { horizontal: "center" };

      try {
        sheet.mergeCells("A2:O2");
      } catch (e) {
        console.warn("Error merging A2:O2:", e);
      }
      sheet.getCell("A2").value = `Địa bàn: ${
        territoryName || "Chưa xác định"
      }`;
      sheet.getCell("A2").font = { bold: true, size: 12 };
      sheet.getCell("A2").alignment = { horizontal: "center" };

      try {
        sheet.mergeCells("A3:O3");
      } catch (e) {
        console.warn("Error merging A3:O3:", e);
      }
      let reportTitle = "";
      if (exportMonthLabel) {
        reportTitle = `1. BÁO CÁO THỰC TẾ THĂM CỬA HÀNG THÁNG ${exportMonthLabel}`;
      } else {
        reportTitle = `1. BÁO CÁO THỰC TẾ THĂM CỬA HÀNG TUẦN ${
          weekNumberInYear || ""
        }/${year}`;
      }
      sheet.getCell("A3").value = reportTitle || "";
      sheet.getCell("A3").font = { bold: true, size: 12 };
      sheet.getCell("A3").alignment = { horizontal: "left" };

      // Table 1 headers
      const headers = [
        "Stt",
        "Tên Cửa hàng",
        "Ngày thăm",
        "Tên + SDT",
        "Tên sản phẩm",
        "Loại XM",
        "Giá mua",
        "Giá bán",
        "Phí VC đường bộ",
        "Phí VC đường thủy",
        "Sản lượng bình quân (tấn/tháng)",
        "Nhập từ NPP",
        "Chương trình chiết khấu - khuyến mãi",
        "Ý kiến/Ghi chú",
      ];

      sheet.getRow(5).values = headers;
      sheet.getRow(5).height = 40;
      sheet.getRow(5).eachCell((cell) => {
        cell.style = {
          ...headerStyle,
          alignment: {
            ...headerStyle.alignment,
            wrapText: true,
          },
        };
      });

      // Data rows - Group by store
      let sttCounter = 1;
      const storeGroups = new Map();
      territorySurveys.forEach((survey) => {
        if (!storeGroups.has(survey.StoreId)) {
          storeGroups.set(survey.StoreId, []);
        }
        storeGroups.get(survey.StoreId).push(survey);
      });

      storeGroups.forEach((storeSurveys) => {
        // Sort surveys by AuditDate
        const sortedSurveys = [...storeSurveys].sort((a, b) => {
          const dateA = a.AuditDate ? new Date(a.AuditDate).getTime() : 0;
          const dateB = b.AuditDate ? new Date(b.AuditDate).getTime() : 0;
          return dateA - dateB;
        });

        // Check if this store has any products
        const hasProducts = sortedSurveys.some(
          (survey) =>
            survey.products &&
            Array.isArray(survey.products) &&
            survey.products.length > 0
        );

        if (!hasProducts) {
          return;
        }

        let isFirstRow = true;
        let totalAverageStockQuantity = 0;
        const storeName = sortedSurveys[0]?.StoreName || "";

        sortedSurveys.forEach((survey) => {
          if (
            survey.products &&
            Array.isArray(survey.products) &&
            survey.products.length > 0
          ) {
            survey.products.forEach((product) => {
              if (!product) return;

              const purchasePrice = product.PurchasePrice || 0;
              const sellingPrice = product.SellingPrice || 0;
              const roadTransportFee = product.RoadTransportFee || 0;
              const waterTransportFee = product.WaterTransportFee || 0;
              const averageStockQuantity = product.AverageStockQuantity || 0;

              totalAverageStockQuantity += averageStockQuantity;

              try {
                const row = sheet.addRow([
                  isFirstRow ? sttCounter : "",
                  storeName || "",
                  formatDate(survey.AuditDate) || "",
                  (product.ContactPersonPhone || "").toString(),
                  (product.ProductType || "").toString(),
                  (product.CementProductName || "").toString(),
                  formatVND(purchasePrice) || "",
                  formatVND(sellingPrice) || "",
                  formatVND(roadTransportFee) || "",
                  formatVND(waterTransportFee) || "",
                  (averageStockQuantity || "").toString(),
                  (product.ImportedFromNPP || "").toString(),
                  (product.DiscountPromotion || "").toString(),
                  isFirstRow ? (survey.StoreComment || "").toString() : "",
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
                isFirstRow = false;
              } catch (error) {
                console.error("Error adding row for product:", error);
              }
            });
          }
        });

        // Add summary row
        if (!isFirstRow) {
          try {
            const summaryRow = sheet.addRow([
              "",
              "",
              "",
              "",
              "",
              "TỔNG CỘNG",
              "",
              "",
              "",
              "",
              (totalAverageStockQuantity || "").toString(),
              "",
              "",
              "",
            ]);

            summaryRow.eachCell((cell) => {
              cell.border = {
                top: { style: "thin" },
                bottom: { style: "thin" },
                left: { style: "thin" },
                right: { style: "thin" },
              };
              cell.alignment = { vertical: "middle" };
            });

            summaryRow.getCell(6).font = { bold: true };
            summaryRow.getCell(11).font = { bold: true };
            summaryRow.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF0F7FF" },
            };
          } catch (error) {
            console.error("Error adding summary row:", error);
          }
        }

        sttCounter++;
      });

      // Column widths
      sheet.columns = [
        { width: 8 },
        { width: 25 },
        { width: 12 },
        { width: 20 },
        { width: 18 },
        { width: 20 },
        { width: 12 },
        { width: 12 },
        { width: 15 },
        { width: 15 },
        { width: 20 },
        { width: 18 },
        { width: 25 },
        { width: 30 },
        { width: 30 },
      ];

      // Add spacing between tables
      sheet.addRow([]);
      sheet.addRow([]);

      // Table 2: Khảo sát sản phẩm XMTĐ
      const title2Surveys = territorySurveys.filter(
        (survey) =>
          survey.WhyNotSellNewProduct ||
          survey.TimeToSellNewProduct ||
          survey.NewProductImportQuantity ||
          survey.SupplierName ||
          survey.ImportedBySalesperson ||
          survey.StoreComment
      );

      if (title2Surveys.length > 0) {
        const title2Row = sheet.rowCount + 1;
        try {
          sheet.mergeCells(`A${title2Row}:I${title2Row}`);
        } catch (e) {
          console.warn(`Error merging A${title2Row}:I${title2Row}:`, e);
        }
        sheet.getCell(`A${title2Row}`).value = `2. KHẢO SÁT SẢN PHẨM XMTĐ`;
        sheet.getCell(`A${title2Row}`).font = { bold: true, size: 12 };
        sheet.getCell(`A${title2Row}`).alignment = { horizontal: "left" };

        const headers2 = [
          "Stt",
          "Tên Cửa hàng",
          "Ngày thăm",
          "Tại sao không bán sản phẩm mới",
          "Thời gian để bán sản phẩm mới",
          "Tên sản phẩm muốn nhập – Số lượng",
          "Mua qua NPP",
          "Nhập bởi thương vụ",
          "Ý kiến/Ghi chú",
        ];

        const headerRow2 = sheet.addRow(headers2);
        headerRow2.height = 40;
        headerRow2.eachCell((cell) => {
          cell.style = {
            ...headerStyle,
            alignment: {
              ...headerStyle.alignment,
              wrapText: true,
            },
          };
        });

        let sttCounter2 = 1;
        title2Surveys.forEach((survey) => {
          const row2 = sheet.addRow([
            sttCounter2,
            (survey.StoreName || "").toString(),
            formatDate(survey.AuditDate) || "",
            (survey.WhyNotSellNewProduct || "").toString(),
            survey.TimeToSellNewProduct
              ? formatDate(survey.TimeToSellNewProduct) || ""
              : "",
            (survey.NewProductImportQuantity || "").toString(),
            (survey.SupplierName || "").toString(),
            (survey.ImportedBySalesperson || "").toString(),
            (survey.StoreComment || "").toString(),
          ]);

          row2.eachCell((cell) => {
            cell.border = {
              top: { style: "thin" },
              bottom: { style: "thin" },
              left: { style: "thin" },
              right: { style: "thin" },
            };
            cell.alignment = { vertical: "middle", wrapText: true };
          });
          sttCounter2++;
        });
      }
    });

    // Generate Excel buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="BaoCaoKhaoSat_${new Date().toISOString().split("T")[0]}.xlsx"`
    );

    // Send buffer
    res.send(buffer);
  } catch (error) {
    console.error("Export store surveys error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  createStoreSurvey,
  getStoreSurveyById,
  getStoreSurveyByAuditId,
  getStoreSurveysByStoreId,
  getAllStoreSurveys,
  updateStoreSurvey,
  deleteStoreSurvey,
  exportStoreSurveys,
};

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
        QuantityReceived: p.quantityReceived,
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

module.exports = {
  createStoreSurvey,
  getStoreSurveyById,
  getStoreSurveyByAuditId,
  getStoreSurveysByStoreId,
  getAllStoreSurveys,
  updateStoreSurvey,
  deleteStoreSurvey,
};

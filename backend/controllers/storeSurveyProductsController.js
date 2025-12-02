const StoreSurveyProduct = require("../models/StoreSurveyProduct");

const getProductsBySurveyId = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const products = await StoreSurveyProduct.findBySurveyId(surveyId);
    res.json(products);
  } catch (error) {
    console.error("Get products by survey id error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const createProduct = async (req, res) => {
  try {
    const { storeSurveyId, productType, cementProductId, sellingPrice } = req.body;

    if (!storeSurveyId || !productType) {
      return res
        .status(400)
        .json({ error: "StoreSurveyId and ProductType are required" });
    }

    const product = await StoreSurveyProduct.create({
      StoreSurveyId: storeSurveyId,
      ProductType: productType,
      CementProductId: cementProductId,
      SellingPrice: sellingPrice,
    });

    res.status(201).json(product);
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { productType, cementProductId, sellingPrice } = req.body;

    const product = await StoreSurveyProduct.findById(id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const updated = await StoreSurveyProduct.update(id, {
      ProductType: productType,
      CementProductId: cementProductId,
      SellingPrice: sellingPrice,
    });

    res.json(updated);
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await StoreSurveyProduct.findById(id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    await StoreSurveyProduct.delete(id);
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  getProductsBySurveyId,
  createProduct,
  updateProduct,
  deleteProduct,
};


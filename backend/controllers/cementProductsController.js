const CementProduct = require("../models/CementProduct");

const getAllCementProducts = async (req, res) => {
  try {
    const { search } = req.query;
    const filters = {};
    if (search) filters.search = search;

    const products = await CementProduct.findAll(filters);
    res.json(products);
  } catch (error) {
    console.error("Get all cement products error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getCementProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await CementProduct.findById(id);

    if (!product) {
      return res.status(404).json({ error: "Cement product not found" });
    }

    res.json(product);
  } catch (error) {
    console.error("Get cement product by id error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const createCementProduct = async (req, res) => {
  try {
    const { code, name } = req.body;

    if (!name || !name.toString().trim()) {
      return res
        .status(400)
        .json({ error: "Name is required" });
    }

    let resolvedCode = code && code.toString().trim();

    // If code is not provided, auto-generate one
    if (!resolvedCode) {
      // Simple auto-code generator, guaranteed <= 50 chars
      resolvedCode = `AUTO-${Date.now()}`;
    }

    // Check if code already exists
    const existing = await CementProduct.findByCode(resolvedCode);
    if (existing) {
      return res.status(400).json({ error: "Code already exists" });
    }

    const product = await CementProduct.create({
      Code: resolvedCode,
      Name: name.toString().trim(),
    });
    res.status(201).json(product);
  } catch (error) {
    console.error("Create cement product error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const updateCementProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name } = req.body;

    const product = await CementProduct.findById(id);
    if (!product) {
      return res.status(404).json({ error: "Cement product not found" });
    }

    // Check if code already exists (if changed)
    if (code && code !== product.Code) {
      const existing = await CementProduct.findByCode(code);
      if (existing) {
        return res.status(400).json({ error: "Code already exists" });
      }
    }

    const updated = await CementProduct.update(id, {
      Code: code || product.Code,
      Name: name || product.Name,
    });

    res.json(updated);
  } catch (error) {
    console.error("Update cement product error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const deleteCementProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await CementProduct.findById(id);
    if (!product) {
      return res.status(404).json({ error: "Cement product not found" });
    }

    await CementProduct.delete(id);
    res.json({ message: "Cement product deleted successfully" });
  } catch (error) {
    console.error("Delete cement product error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const importCementProducts = async (req, res) => {
  try {
    const { products } = req.body; // Array of {code, name}

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: "Products array is required" });
    }

    const inserted = await CementProduct.bulkCreate(products);
    res.status(201).json({
      message: `Imported ${inserted.length} cement products`,
      inserted: inserted.length,
      total: products.length,
    });
  } catch (error) {
    console.error("Import cement products error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  getAllCementProducts,
  getCementProductById,
  createCementProduct,
  updateCementProduct,
  deleteCementProduct,
  importCementProducts,
};


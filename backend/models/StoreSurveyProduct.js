const { getPool, sql } = require('../config/database');

class StoreSurveyProduct {
  static async create(productData) {
    const pool = await getPool();
    const {
      StoreSurveyId,
      ProductType,
      CementProductId,
      SellingPrice,
      ContactPersonPhone,
      PurchasePrice,
      RoadTransportFee,
      WaterTransportFee,
      QuantityReceived,
      ImportedFromNPP,
      DiscountPromotion,
      AverageStockQuantity,
    } = productData;

    const request = pool.request();
    request.input('StoreSurveyId', sql.Int, StoreSurveyId);
    request.input('ProductType', sql.NVarChar(100), ProductType);
    request.input('CementProductId', sql.Int, CementProductId || null);
    request.input('SellingPrice', sql.Decimal(18, 2), SellingPrice || null);
    request.input('ContactPersonPhone', sql.NVarChar(200), ContactPersonPhone || null);
    request.input('PurchasePrice', sql.Decimal(18, 2), PurchasePrice || null);
    request.input('RoadTransportFee', sql.Decimal(18, 2), RoadTransportFee || null);
    request.input('WaterTransportFee', sql.Decimal(18, 2), WaterTransportFee || null);
    request.input('QuantityReceived', sql.Decimal(18, 2), QuantityReceived || null);
    request.input('ImportedFromNPP', sql.NVarChar(500), ImportedFromNPP || null);
    request.input('DiscountPromotion', sql.NVarChar(1000), DiscountPromotion || null);
    request.input('AverageStockQuantity', sql.Decimal(18, 2), AverageStockQuantity || null);

    const result = await request.query(`
      INSERT INTO StoreSurveyProducts (
        StoreSurveyId, ProductType, CementProductId, SellingPrice,
        ContactPersonPhone, PurchasePrice, RoadTransportFee, WaterTransportFee,
        QuantityReceived, ImportedFromNPP, DiscountPromotion, AverageStockQuantity,
        CreatedAt
      )
      OUTPUT INSERTED.*
      VALUES (
        @StoreSurveyId, @ProductType, @CementProductId, @SellingPrice,
        @ContactPersonPhone, @PurchasePrice, @RoadTransportFee, @WaterTransportFee,
        @QuantityReceived, @ImportedFromNPP, @DiscountPromotion, @AverageStockQuantity,
        GETDATE()
      )
    `);

    return result.recordset[0];
  }

  static async findBySurveyId(surveyId) {
    const pool = await getPool();
    const request = pool.request();
    request.input('StoreSurveyId', sql.Int, surveyId);

    const result = await request.query(`
      SELECT 
        ssp.*,
        cp.Code as CementProductCode,
        cp.Name as CementProductName
      FROM StoreSurveyProducts ssp
      LEFT JOIN CementProducts cp ON ssp.CementProductId = cp.Id
      WHERE ssp.StoreSurveyId = @StoreSurveyId
      ORDER BY ssp.CreatedAt ASC
    `);

    return result.recordset;
  }

  static async findById(id) {
    const pool = await getPool();
    const request = pool.request();
    request.input('Id', sql.Int, id);

    const result = await request.query(`
      SELECT 
        ssp.*,
        cp.Code as CementProductCode,
        cp.Name as CementProductName
      FROM StoreSurveyProducts ssp
      LEFT JOIN CementProducts cp ON ssp.CementProductId = cp.Id
      WHERE ssp.Id = @Id
    `);

    return result.recordset[0];
  }

  static async update(id, productData) {
    const pool = await getPool();
    const {
      ProductType,
      CementProductId,
      SellingPrice,
      ContactPersonPhone,
      PurchasePrice,
      RoadTransportFee,
      WaterTransportFee,
      QuantityReceived,
      ImportedFromNPP,
      DiscountPromotion,
      AverageStockQuantity,
    } = productData;

    const request = pool.request();
    request.input('Id', sql.Int, id);
    request.input('ProductType', sql.NVarChar(100), ProductType);
    request.input('CementProductId', sql.Int, CementProductId || null);
    request.input('SellingPrice', sql.Decimal(18, 2), SellingPrice || null);
    request.input('ContactPersonPhone', sql.NVarChar(200), ContactPersonPhone || null);
    request.input('PurchasePrice', sql.Decimal(18, 2), PurchasePrice || null);
    request.input('RoadTransportFee', sql.Decimal(18, 2), RoadTransportFee || null);
    request.input('WaterTransportFee', sql.Decimal(18, 2), WaterTransportFee || null);
    request.input('QuantityReceived', sql.Decimal(18, 2), QuantityReceived || null);
    request.input('ImportedFromNPP', sql.NVarChar(500), ImportedFromNPP || null);
    request.input('DiscountPromotion', sql.NVarChar(1000), DiscountPromotion || null);
    request.input('AverageStockQuantity', sql.Decimal(18, 2), AverageStockQuantity || null);

    const result = await request.query(`
      UPDATE StoreSurveyProducts
      SET ProductType = @ProductType,
          CementProductId = @CementProductId,
          SellingPrice = @SellingPrice,
          ContactPersonPhone = @ContactPersonPhone,
          PurchasePrice = @PurchasePrice,
          RoadTransportFee = @RoadTransportFee,
          WaterTransportFee = @WaterTransportFee,
          QuantityReceived = @QuantityReceived,
          ImportedFromNPP = @ImportedFromNPP,
          DiscountPromotion = @DiscountPromotion,
          AverageStockQuantity = @AverageStockQuantity
      OUTPUT INSERTED.*
      WHERE Id = @Id
    `);

    return result.recordset[0];
  }

  static async delete(id) {
    const pool = await getPool();
    const request = pool.request();
    request.input('Id', sql.Int, id);

    await request.query(`
      DELETE FROM StoreSurveyProducts WHERE Id = @Id
    `);

    return true;
  }

  static async bulkCreate(products) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      const inserted = [];

      for (const product of products) {
        // Create a new request for each product to avoid parameter name conflicts
        const request = new sql.Request(transaction);
        
        request.input('StoreSurveyId', sql.Int, product.StoreSurveyId);
        request.input('ProductType', sql.NVarChar(100), product.ProductType);
        request.input('CementProductId', sql.Int, product.CementProductId || null);
        request.input('SellingPrice', sql.Decimal(18, 2), product.SellingPrice || null);
        request.input('ContactPersonPhone', sql.NVarChar(200), product.ContactPersonPhone || null);
        request.input('PurchasePrice', sql.Decimal(18, 2), product.PurchasePrice || null);
        request.input('RoadTransportFee', sql.Decimal(18, 2), product.RoadTransportFee || null);
        request.input('WaterTransportFee', sql.Decimal(18, 2), product.WaterTransportFee || null);
        request.input('QuantityReceived', sql.Decimal(18, 2), product.QuantityReceived || null);
        request.input('ImportedFromNPP', sql.NVarChar(500), product.ImportedFromNPP || null);
        request.input('DiscountPromotion', sql.NVarChar(1000), product.DiscountPromotion || null);
        request.input('AverageStockQuantity', sql.Decimal(18, 2), product.AverageStockQuantity || null);

        const result = await request.query(`
          INSERT INTO StoreSurveyProducts (
            StoreSurveyId, ProductType, CementProductId, SellingPrice,
            ContactPersonPhone, PurchasePrice, RoadTransportFee, WaterTransportFee,
            QuantityReceived, ImportedFromNPP, DiscountPromotion, AverageStockQuantity,
            CreatedAt
          )
          OUTPUT INSERTED.*
          VALUES (
            @StoreSurveyId, @ProductType, @CementProductId, @SellingPrice,
            @ContactPersonPhone, @PurchasePrice, @RoadTransportFee, @WaterTransportFee,
            @QuantityReceived, @ImportedFromNPP, @DiscountPromotion, @AverageStockQuantity,
            GETDATE()
          )
        `);

        inserted.push(result.recordset[0]);
      }

      await transaction.commit();
      return inserted;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = StoreSurveyProduct;


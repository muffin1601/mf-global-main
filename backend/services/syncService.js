const CrmProduct = require("../models/ProductData");
const PrintkeeCategory = require("../models/PrintkeeCategory");
const CoachingProduct = require("../models/CoachingProduct");

// -----------------------
//  MAPPING: CRM → Printkee
// -----------------------
function mapCRMtoPrintkee(p) {
  return {
    productCode: p.p_code,
    SKU: p.s_code,
    name: p.p_name,
    description: p.p_description,
    type: p.p_type,
    colour: [p.p_color],
    HSNCode: p.HSN_code,
    GSTRate: p.GST_rate,
    image: p.p_image,
    price: {
      basic_amount: p.p_price.basic_amount,
      GST_rate: p.p_price.GST_rate,
      net_amount: p.p_price.net_amount,
    },
  };
}

// -----------------------
//  MAPPING: CRM → CoachingPromo
// -----------------------
function mapCRMtoCoaching(p) {
  return {
    sku: p.s_code,
    name: p.p_name,
    description: {
      short: p.p_description,
      long: p.p_description,
    },
    attributes: {
      material: p.p_type,
      color: [p.p_color],
    },
    price: p.p_price.net_amount,
    images: [{ url: p.p_image }],
  };
}

// -----------------------
// CREATE SYNC
// -----------------------
async function syncCreate(crmProduct) {
  if (crmProduct.origin.source === "printkee") {
    const cat = await PrintkeeCategory.findById(crmProduct.origin.categoryId);
    const sub = cat.subcategories.id(crmProduct.origin.subcategoryId);

    const mapped = mapCRMtoPrintkee(crmProduct);
    sub.products.push(mapped);

    const created = sub.products[sub.products.length - 1];
    crmProduct.origin.productId = created._id;

    await cat.save();
    await crmProduct.save();
  }

  if (crmProduct.origin.source === "coaching") {
    const mapped = mapCRMtoCoaching(crmProduct);
    const created = await CoachingProduct.create(mapped);

    crmProduct.origin.productId = created._id;
    await crmProduct.save();
  }
}

// -----------------------
// UPDATE SYNC
// -----------------------
async function syncUpdate(crmProduct) {
  if (crmProduct.origin.source === "printkee") {
    const cat = await PrintkeeCategory.findById(crmProduct.origin.categoryId);
    const sub = cat.subcategories.id(crmProduct.origin.subcategoryId);
    const prod = sub.products.id(crmProduct.origin.productId);

    Object.assign(prod, mapCRMtoPrintkee(crmProduct));
    await cat.save();
  }

  if (crmProduct.origin.source === "coaching") {
    await CoachingProduct.findByIdAndUpdate(
      crmProduct.origin.productId,
      mapCRMtoCoaching(crmProduct)
    );
  }
}

// -----------------------
// DELETE SYNC
// -----------------------
async function syncDelete(crmProduct) {
  if (crmProduct.origin.source === "printkee") {
    const cat = await PrintkeeCategory.findById(crmProduct.origin.categoryId);
    const sub = cat.subcategories.id(crmProduct.origin.subcategoryId);

    sub.products = sub.products.filter(
      (p) => p._id.toString() !== crmProduct.origin.productId
    );

    await cat.save();
  }

  if (crmProduct.origin.source === "coaching") {
    await CoachingProduct.findByIdAndDelete(crmProduct.origin.productId);
  }
}

module.exports = { syncCreate, syncUpdate, syncDelete };

require("dotenv").config();
const mongoose = require("mongoose");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
process.env.MONGODB_DISABLE_DNS_SRV = "true";

mongoose.connect(process.env.MONGO_URI);

const CrmProduct = require("./models/ProductData");
const PrintkeeCategory = require("./models/PrintkeeCategory");
const CoachingProduct = require("./models/CoachingProduct");


// --------------------------------------------------
// DELETE OLD MIGRATED PRODUCTS
// --------------------------------------------------

async function deletePreviouslyInsertedProducts() {
  console.log("\n🗑  Deleting previously migrated CRM products...\n");

  // Collect Printkee s_codes
  const categories = await PrintkeeCategory.find();
  const printkeeCodes = [];

  for (const cat of categories) {
    for (const sub of cat.subcategories) {
      for (const prod of sub.products) {
        printkeeCodes.push(prod.SKU || prod.productCode);
      }
    }
  }

  // Collect CoachingPromo s_codes
  const coachingProducts = await CoachingProduct.find();
  const coachingCodes = coachingProducts.map(p => p.sku);

  // UNIQUE LIST
  const allCodes = [...new Set([...printkeeCodes, ...coachingCodes])];

  const deleteResult = await CrmProduct.deleteMany({
    s_code: { $in: allCodes }
  });

  console.log(`🗑  Deleted ${deleteResult.deletedCount} old CRM products.\n`);
}


// --------------------------------------------------
// MAPPERS
// --------------------------------------------------

function mapPrintkeeToCRM(p, cat, sub, prod) {
  return {
    p_name: p.name,
    s_code: p.SKU || p.productCode,
    p_description: p.description,
    p_type: p.type,
    p_color: p.colour?.[0] || "",
    HSN_code: p.HSNCode,
    GST_rate: p.GSTRate || 0,
    p_image: p.image,
    cat_id: "",
    p_price: {
      basic_amount: p.price?.basic_amount || 0,
      GST_rate: p.price?.GST_rate || 0,
      net_amount: p.price?.net_amount || 0,
    },
    dimension: p.dimensions
      ? `${p.dimensions.length}x${p.dimensions.width}x${p.dimensions.height}`
      : "",
    origin: {
      source: "printkee",
      categoryId: cat?._id,
      subcategoryId: sub?._id,
      productId: prod?._id,
    }
  };
}


function mapCoachingToCRM(p) {
  return {
    p_name: p.name,
    s_code: p.sku,
    p_description: p.description?.short || p.description?.long || "",
    p_type: p.attributes?.material || "",
    p_color: p.attributes?.color?.[0] || "",
    HHSN_code: "",
    GST_rate: 0,
    p_image: p.images?.[0]?.url || "",
    cat_id: "",
    p_price: {
      basic_amount: p.price || 0,
      GST_rate: 0,
      net_amount: p.price || 0,
    },
    dimension: "",
    origin: {
      source: "coachingpromo",
      productId: p._id
    }
  };
}


// --------------------------------------------------
// MAIN MIGRATION
// --------------------------------------------------

async function runMigration() {
  console.log("\n🚀 Migration started...\n");

  // STEP 1 → Delete old migrated products
  await deletePreviouslyInsertedProducts();

  // STEP 2 → Fetch fresh products from Printkee + CoachingPromo
  const categories = await PrintkeeCategory.find();
  let printkeeProducts = [];

  for (const cat of categories) {
    for (const sub of cat.subcategories) {
      for (const prod of sub.products) {
        printkeeProducts.push({ cat, sub, prod });
      }
    }
  }

  console.log(`📦 Printkee nested products found: ${printkeeProducts.length}`);

  const coachingProducts = await CoachingProduct.find();
  console.log(`📦 CoachingPromo products found: ${coachingProducts.length}\n`);


  // STEP 3 → Re-insert Printkee products
  for (const item of printkeeProducts) {
    const { cat, sub, prod } = item;

    await CrmProduct.create(
      mapPrintkeeToCRM(prod, cat, sub, prod)
    );

    console.log(`➕ Inserted Printkee → ${prod.name}`);
  }

  // STEP 4 → Re-insert CoachingPromo products
  for (const p of coachingProducts) {

    await CrmProduct.create(
      mapCoachingToCRM(p)
    );

    console.log(`➕ Inserted CoachingPromo → ${p.name}`);
  }


  console.log("\n🎉 Migration completed successfully.\n");
  process.exit();
}


runMigration();

// recreate_crm_from_sources_no_autogen_codes.js
require('dotenv').config();
const mongoose = require('mongoose');
const slugify = require('slugify');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
process.env.MONGODB_DISABLE_DNS_SRV = 'true';

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '200', 10);
const PAUSE_AFTER_BATCH_MS = parseInt(process.env.PAUSE_AFTER_BATCH_MS || '50', 10);

mongoose.set('strictQuery', false);

async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB.');

    const CrmProduct = require('./models/ProductData');
    const PrintkeeCategory = require('./models/PrintkeeCategory');
    const CoachingProduct = require('./models/CoachingProduct');

    function genSlug(name, p_code, s_code) {
      const base = (name || p_code || s_code || 'product').toString().trim();
      let candidate = slugify(base, { lower: true, strict: true });
      if (!candidate) candidate = `product-${Math.random().toString(36).slice(2, 8)}`;
      return candidate;
    }

    function normalizePrintkeeToCRM(p, cat, sub, prod) {
      const p_price_from_source = p.p_price || p.price || undefined;
      const skuVal = prod?.productCode || p.SKU || p.productCode || p.sku || '';

      const doc = {
        slug: p.slug || genSlug(p.name, prod?.productCode || p.productCode, skuVal),
        // DO NOT set p_code here — leave to CRM pre('save')
        s_code: skuVal || undefined,
        p_name: p.name,
        p_description: (typeof p.description === 'string') ? p.description : (p.description?.long || p.description?.short || ''),
        p_type: p.type || '',
        p_color: (p.colour && p.colour.length) ? p.colour[0] : (p.color && p.color.length ? p.color[0] : ''),
        HSN_code: p.HSNCode || '',
        GST_rate: p.GSTRate || 0,
        p_image: p.image || (p.images && (p.images[0]?.url || p.images[0])) || '',
        cat_id: String(cat?._id || '') || '',
        p_price: p_price_from_source ? Object.assign({}, p_price_from_source) : undefined,
        dimension: p.dimensions && (p.dimensions.length || p.dimensions.width || p.dimensions.height)
          ? `${p.dimensions.length || 0}x${p.dimensions.width || 0}x${p.dimensions.height || 0}`
          : (p.dimension || ''),
        origin: {
          source: "printkee",
          categoryId: cat?._id || null,
          subcategoryId: sub?._id || null,
          productId: prod?._id || null,
        },
        name: p.name,
        description: {
          short: (typeof p.description === 'string' ? p.description : (p.description?.short || '')),
          long: (typeof p.description === 'string' ? p.description : (p.description?.long || ''))
        },
        images: (p.images && p.images.length)
          ? p.images.map(i => ({ url: i.url || i, altText: i.altText || '' }))
          : (p.image ? [{ url: p.image, altText: p.name || '' }] : []),
        subImages: (p.subImages && p.subImages.length) ? p.subImages.map(i => ({ url: i, altText: '' })) : [],
        stock: (typeof p.quantity === 'number') ? p.quantity : (p.quantity || 0),
        SKU: skuVal || undefined,
        sku: skuVal || undefined,
        attributes: {
          color: p.colour || p.color || [],
          size: p.size || [],
          material: p.material || ''
        },
        productCode: prod?.productCode || p.productCode || undefined,
        quantity: (typeof p.quantity === 'number') ? p.quantity : 0,
        GSTRate: p.GSTRate || 0,
        brand: p.brand || '',
        fabricType: p.fabricType || '',
        size: p.size || [],
        colour: p.colour || p.color || [],
        dimensions: p.dimensions ? {
          length: p.dimensions.length || null,
          width: p.dimensions.width || null,
          height: p.dimensions.height || null,
          weight: p.dimensions.weight || null,
          asString: (p.dimensions.asString || (p.dimensions.length ? `${p.dimensions.length}x${p.dimensions.width}x${p.dimensions.height}` : ''))
        } : { asString: (p.dimension || '') },
        price: (typeof p.price === 'number') ? p.price : (p.price?.net_amount || (p.p_price && p.p_price.net_amount) || null),
        salePrice: p.salePrice || (p.price?.salePrice) || (p.p_price && p.p_price.sales_5_50) || null,
        tags: p.tags || (p.tag ? (Array.isArray(p.tag) ? p.tag : [p.tag]) : []),
        keywords: p.keywords || [],
        specifications: p.specifications || [],
        additionalInfo: p.additionalInfo || [],
        metaTitle: p.metaTitle || '',
        metaDescription: p.metaDescription || '',
        isFeatured: p.isFeatured || false,
        isActive: (typeof p.isPublished === 'boolean') ? p.isPublished : true,
        isPublished: (typeof p.isPublished === 'boolean') ? p.isPublished : true,
        isDeleted: false,
        ratings: p.ratings || { average: 0, count: 0 },
        category: cat?._id || null,
        subcategory: sub?._id || null,
      };

      // IMPORTANT: do not initialize p_price.price_code here.
      // If p_price exists but price_code is falsy, remove the price_code field
      // and if p_price becomes empty remove it entirely so we never write null.
      if (doc.p_price) {
        if (!doc.p_price.hasOwnProperty('price_code') || !doc.p_price.price_code) {
          delete doc.p_price.price_code;
        }
        // remove any explicit null/empty fields from p_price
        for (const k of Object.keys(doc.p_price)) {
          if (doc.p_price[k] === null || typeof doc.p_price[k] === 'undefined') {
            delete doc.p_price[k];
          }
        }
        if (Object.keys(doc.p_price).length === 0) {
          delete doc.p_price;
        }
      }

      // Ensure we never write a falsy p_code — leave p_code generation to CRM model
      if ('p_code' in doc && !doc.p_code) delete doc.p_code;

      return doc;
    }

    function normalizeCoachingToCRM(p) {
      const p_price_from_source = p.p_price || p.price || undefined;
      const skuVal = p.productCode || p.sku || p.SKU || '';

      const doc = {
        slug: p.slug || genSlug(p.name, p.productCode, skuVal),
        // DO NOT set p_code; leave to CRM pre('save')
        s_code: skuVal || undefined,
        p_name: p.name,
        p_description: (typeof p.description === 'string') ? p.description : (p.description?.long || p.description?.short || ''),
        p_type: p.attributes?.material || '',
        p_color: (p.attributes?.color && p.attributes.color.length) ? p.attributes.color[0] : '',
        HSN_code: p.HSNCode || '',
        GST_rate: p.GSTRate || 0,
        p_image: p.images?.[0]?.url || '',
        cat_id: '',
        p_price: p_price_from_source ? Object.assign({}, p_price_from_source) : undefined,
        dimension: p.dimension || '',
        origin: {
          source: "coachingpromo",
          productId: p._id || null
        },
        name: p.name,
        description: {
          short: p.description?.short || '',
          long: p.description?.long || p.description?.short || ''
        },
        images: (p.images && p.images.length) ? p.images.map(i => ({ url: i.url || i, altText: i.altText || '' })) : [],
        subImages: (p.subImages && p.subImages.length) ? p.subImages.map(i => ({ url: i, altText: '' })) : [],
        stock: p.quantity || 0,
        SKU: skuVal || undefined,
        sku: skuVal || undefined,
        attributes: {
          color: p.attributes?.color || [],
          size: p.size || [],
          material: p.attributes?.material || ''
        },
        productCode: p.productCode || undefined,
        quantity: p.quantity || 0,
        GSTRate: p.GSTRate || 0,
        brand: p.brand || '',
        fabricType: p.fabricType || '',
        size: p.size || [],
        colour: p.colour || p.attributes?.color || [],
        dimensions: { asString: p.dimension || '' },
        price: (typeof p.price === 'number') ? p.price : (p.price?.net_amount || null),
        salePrice: p.salePrice || null,
        tags: p.tags || [],
        keywords: p.keywords || [],
        specifications: p.specifications || [],
        additionalInfo: p.additionalInfo || [],
        metaTitle: p.metaTitle || '',
        metaDescription: p.metaDescription || '',
        isFeatured: p.isFeatured || false,
        isActive: (typeof p.isPublished === 'boolean') ? p.isPublished : true,
        isPublished: (typeof p.isPublished === 'boolean') ? p.isPublished : true,
        isDeleted: !!p.isDeleted,
        ratings: p.ratings || { average: 0, count: 0 },
        category: null,
        subcategory: null,
      };

      // Don't set p_price.price_code if absent; remove null/undefined fields and drop empty p_price
      if (doc.p_price) {
        if (!doc.p_price.hasOwnProperty('price_code') || !doc.p_price.price_code) {
          delete doc.p_price.price_code;
        }
        for (const k of Object.keys(doc.p_price)) {
          if (doc.p_price[k] === null || typeof doc.p_price[k] === 'undefined') {
            delete doc.p_price[k];
          }
        }
        if (Object.keys(doc.p_price).length === 0) {
          delete doc.p_price;
        }
      }

      if ('p_code' in doc && !doc.p_code) delete doc.p_code;
      return doc;
    }

    // ensure slug is non-unique so duplicates allowed
    const coll = mongoose.connection.collection('products');
    try {
      try { await coll.dropIndex('slug_1'); console.log('Dropped existing slug_1 index (if existed).'); } catch (e) { /* ignore */ }
      await coll.createIndex({ slug: 1 });
      console.log('Ensured non-unique slug index.');
    } catch (err) {
      console.warn('Could not modify slug index:', err.message || err);
    }

    // collect source codes
    async function collectSourceSKUs() {
      const categories = await PrintkeeCategory.find().lean();
      const printkeeCodes = [];
      for (const cat of categories) {
        if (!cat.subcategories) continue;
        for (const sub of cat.subcategories) {
          if (!sub.products) continue;
          for (const prod of sub.products) {
            const code = prod.productCode || prod.SKU || prod.sku;
            if (code) printkeeCodes.push(code);
          }
        }
      }
      const coachingProducts = await CoachingProduct.find().lean();
      const coachingCodes = coachingProducts.map(p => p.productCode || p.sku || p.SKU).filter(Boolean);
      return [...new Set([...printkeeCodes, ...coachingCodes])];
    }

    const allCodes = await collectSourceSKUs();
    console.log(`Found ${allCodes.length} unique source SKUs/productCodes.`);

    // delete previously migrated docs for safety
    console.log('Deleting previously migrated CRM products for sources printkee/coachingpromo...');
    const filters = [{ 'origin.source': 'printkee' }, { 'origin.source': 'coachingpromo' }];
    if (allCodes.length) filters.push({ s_code: { $in: allCodes } });
    const deleteResult = await CrmProduct.deleteMany({ $or: filters });
    console.log(`Deleted ${deleteResult.deletedCount} CRM products (source-based).`);

    // Upsert Printkee
    console.log('Upserting Printkee products (bulk operations)...');
    const categories = await PrintkeeCategory.find().lean();
    let ops = [];
    let totalPrintkee = 0;
    for (const cat of categories) {
      if (!cat.subcategories) continue;
      for (const sub of cat.subcategories) {
        if (!sub.products) continue;
        for (const prod of sub.products) {
          const doc = normalizePrintkeeToCRM(prod, cat, sub, prod);

          // s_code fallback
          const sCodeVal = doc.s_code || (`printkee-${prod._id}`);
          doc.s_code = sCodeVal;

          if (!doc.SKU && doc.s_code) doc.SKU = doc.s_code;
          if (!doc.sku && doc.SKU) doc.sku = doc.SKU;

          // ensure not writing p_code null
          if ('p_code' in doc && !doc.p_code) delete doc.p_code;

          // ensure p_price exists only if meaningful (cleanup already done in normalize)
          if (doc.p_price && Object.keys(doc.p_price).length === 0) delete doc.p_price;

          ops.push({
            updateOne: {
              filter: { 'origin.source': 'printkee', 'origin.productId': prod._id },
              update: { $set: doc },
              upsert: true
            }
          });

          totalPrintkee++;
          if (ops.length >= BATCH_SIZE) {
            await CrmProduct.bulkWrite(ops, { ordered: false });
            ops = [];
            console.log(`  Bulk-upserted ${totalPrintkee} Printkee products so far...`);
            await new Promise(r => setTimeout(r, PAUSE_AFTER_BATCH_MS));
          }
        }
      }
    }
    if (ops.length) {
      await CrmProduct.bulkWrite(ops, { ordered: false });
      console.log(`  Bulk-upserted total ${totalPrintkee} Printkee products.`);
      ops = [];
    }

    // Upsert Coaching
    console.log('Upserting CoachingPromo products (bulk operations)...');
    const coachingProducts = await CoachingProduct.find().lean();
    ops = [];
    let totalCoaching = 0;
    for (const p of coachingProducts) {
      const doc = normalizeCoachingToCRM(p);

      const sCodeVal = doc.s_code || (`coaching-${p._id}`);
      doc.s_code = sCodeVal;

      if (!doc.SKU && doc.s_code) doc.SKU = doc.s_code;
      if (!doc.sku && doc.SKU) doc.sku = doc.SKU;

      if ('p_code' in doc && !doc.p_code) delete doc.p_code;
      if (doc.p_price && Object.keys(doc.p_price).length === 0) delete doc.p_price;

      ops.push({
        updateOne: {
          filter: { 'origin.source': 'coachingpromo', 'origin.productId': p._id },
          update: { $set: doc },
          upsert: true
        }
      });

      totalCoaching++;
      if (ops.length >= BATCH_SIZE) {
        await CrmProduct.bulkWrite(ops, { ordered: false });
        ops = [];
        console.log(`  Bulk-upserted ${totalCoaching} CoachingPromo products so far...`);
        await new Promise(r => setTimeout(r, PAUSE_AFTER_BATCH_MS));
      }
    }
    if (ops.length) {
      await CrmProduct.bulkWrite(ops, { ordered: false });
      console.log(`  Bulk-upserted total ${totalCoaching} CoachingPromo products.`);
      ops = [];
    }

    // Post-migration: trigger pre-save for docs missing p_code (optional)
    console.log('Post-migration: generating missing p_code via model.save() ...');
    const ProductModel = require('./models/ProductData');
    const cursor = ProductModel.find({
      $or: [{ 'origin.source': 'printkee' }, { 'origin.source': 'coachingpromo' }],
      $or: [{ p_code: { $exists: false } }, { p_code: null }, { p_code: '' }]
    }).cursor();

    let generated = 0;
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      try {
        if (!doc.p_code) {
          await doc.save();
          generated++;
          if (generated % 100 === 0) console.log(`  Generated p_code for ${generated} docs...`);
        }
      } catch (err) {
        console.error('  Error saving doc _id=', doc._id, err.message || err);
      }
    }
    console.log(`Post-migration done. Generated p_code for ${generated} products.`);

    console.log('\nMigration complete. Summary:');
    console.log('  Printkee items processed:', totalPrintkee);
    console.log('  Coaching items processed:', totalCoaching);
    console.log('  p_code generated in post-step:', generated);

    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

main();

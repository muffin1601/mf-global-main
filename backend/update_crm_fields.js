// update_existing_products_fields.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const slugify = require('slugify');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
process.env.MONGODB_DISABLE_DNS_SRV = 'true';

const DRY_RUN = process.env.DRY_RUN === 'true' || false;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '200', 10);

mongoose.set('strictQuery', false);
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const Product = require('./models/ProductData'); // adjust if your path differs

async function backupAllDocs(filename) {
  console.log('Backing up all product docs to:', filename);
  const out = fs.createWriteStream(filename, { flags: 'w' });
  const cursor = Product.find().lean().cursor();
  out.write('[');
  let first = true;
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    if (!first) out.write(',\n');
    first = false;
    out.write(JSON.stringify(doc));
  }
  out.write(']');
  out.end();
  await new Promise(res => out.on('finish', res));
  console.log('Backup finished.');
}

function genSlugBase(nameOrPname, p_code, s_code) {
  const baseInput = (nameOrPname || p_code || s_code || 'product').toString().trim();
  let cand = slugify(baseInput, { lower: true, strict: true });
  if (!cand) cand = (`product-${Math.random().toString(36).slice(2,8)}`);
  // append p_code to minimize collisions
  if (p_code) return `${cand}-${p_code}`;
  return cand;
}

function genUniquePriceCode(doc) {
  // RS + last 6 of timestamp + last 4 of ObjectId
  const ts = Date.now().toString().slice(-6);
  const oidTail = doc._id ? doc._id.toString().slice(-4) : Math.random().toString(36).slice(2,6);
  return `RS${ts}${oidTail}`;
}

async function buildUpdateForDoc(doc) {
  const updates = {};

  // name
  if ((!doc.name || doc.name === '') && doc.p_name) updates.name = doc.p_name;

  // description short/long
  const hasDesc = doc.description && (doc.description.short || doc.description.long);
  if (!hasDesc && doc.p_description) {
    updates.description = Object.assign({}, doc.description || {}, { long: doc.p_description });
  }

  // SKU / sku mapping
  if ((!doc.SKU || doc.SKU === '') && doc.s_code) updates.SKU = doc.s_code;
  if ((!doc.sku || doc.sku === '') && (doc.SKU || doc.s_code)) updates.sku = (doc.SKU || doc.s_code);

  // productCode
  if ((!doc.productCode || doc.productCode === '') && doc.p_code) updates.productCode = doc.p_code;

  // price & salePrice fallback from p_price
  if ((typeof doc.price === 'undefined' || doc.price === null) && doc.p_price && typeof doc.p_price.net_amount !== 'undefined') {
    updates.price = doc.p_price.net_amount;
  }
  if ((typeof doc.salePrice === 'undefined' || doc.salePrice === null) && doc.p_price && typeof doc.p_price.sales_5_50 !== 'undefined') {
    updates.salePrice = doc.p_price.sales_5_50;
  }

  // images: populate from p_image if empty
  if ((!doc.images || !Array.isArray(doc.images) || doc.images.length === 0) && doc.p_image) {
    updates.images = [{ url: doc.p_image, altText: doc.p_name || '' }];
  }

  // dimensions: copy text dimension into dimensions.asString if missing
  if (doc.dimension && (!doc.dimensions || !doc.dimensions.asString)) {
    updates['dimensions'] = Object.assign({}, doc.dimensions || {}, { asString: doc.dimension });
  }

  // slug: generate if missing
  if ((!doc.slug || doc.slug === '') && (doc.name || doc.p_name || doc.p_code || doc.s_code)) {
    const base = genSlugBase(doc.name || doc.p_name, doc.p_code, doc.s_code);
    let candidate = base;
    // quick uniqueness check; if collision, append timestamp
    const conflict = await Product.findOne({ slug: candidate }).select('_id').lean();
    if (conflict && String(conflict._id) !== String(doc._id)) {
      candidate = `${candidate}-${Date.now().toString().slice(-4)}`;
    }
    updates.slug = candidate;
  }

  // ensure p_price exists and price_code exists
  if (!doc.p_price) {
    updates.p_price = {
      price_code: genUniquePriceCode(doc),
      basic_amount: 0,
      net_amount: 0,
      GST_rate: 0
    };
  } else if (!doc.p_price.price_code) {
    updates['p_price.price_code'] = genUniquePriceCode(doc);
  }

  return updates;
}

async function run() {
  try {
    console.log(`\nStarting update of existing products. DRY_RUN=${DRY_RUN}. batch=${BATCH_SIZE}\n`);
    const backupName = path.join(process.cwd(), `crm_backup_${Date.now()}.json`);
    await backupAllDocs(backupName);

    const cursor = Product.find().lean().cursor();
    const ops = [];
    let processed = 0;
    let toUpdate = 0;

    for (let rawDoc = await cursor.next(); rawDoc != null; rawDoc = await cursor.next()) {
      processed++;
      // load full doc (not lean) only to pass into genUniquePriceCode (we can use rawDoc._id though)
      const doc = rawDoc;
      const updates = await buildUpdateForDoc(doc);

      if (Object.keys(updates).length > 0) {
        toUpdate++;
        if (!DRY_RUN) {
          // construct updateOne op
          // Use $set with nested paths; handle p_price nested set if we created whole object
          const setObj = {};
          for (const k of Object.keys(updates)) {
            setObj[k] = updates[k];
          }
          ops.push({
            updateOne: {
              filter: { _id: doc._id },
              update: { $set: setObj }
            }
          });
        }
      }

      if (ops.length >= BATCH_SIZE) {
        if (!DRY_RUN) {
          await Product.bulkWrite(ops, { ordered: false });
        }
        console.log(`Processed ${processed} docs — queued/committed ${toUpdate} updates so far.`);
        ops.length = 0;
      }
    }

    if (ops.length > 0) {
      if (!DRY_RUN) {
        await Product.bulkWrite(ops, { ordered: false });
      }
    }

    console.log(`\nFinished scan. Processed ${processed} documents. ${toUpdate} required updates.`);

    if (DRY_RUN) {
      console.log('DRY_RUN was true — no changes were written. Run without DRY_RUN to apply updates.');
    } else {
      console.log('Updates applied to database.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error during update:', err);
    process.exit(1);
  }
}

run();

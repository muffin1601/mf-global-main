# Complete database mapping

Generated from the actual MongoDB inventory at 2026-11-17T07:48:49.110Z and Prisma schema. Every observed field is listed. Unknown/irregular product, quotation and vendor attributes are retained in JSONB rather than discarded.

## activitylogs → ActivityLog

| MongoDB field | Observed type | PostgreSQL destination | PostgreSQL type | Transformation |
|---|---|---|---|---|
| __v | number | Not migrated | — | Mongoose internal version; no business value |
| _id | objectId | ActivityLog.legacyId | text / uuid relation | ObjectId converted to lowercase 24-character hex and retained |
| action | string | ActivityLog.action | text | Preserved |
| details | object | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.clients | array | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.clients[] | string | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.company | string | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.email | string | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.fileName | string | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.fromDate | string | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.imageChanged | boolean | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.inserted | number | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.leadId | string | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.leadsCount | number | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.module | string | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.name | string | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.permission | string | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.phone | string | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.productCode | string | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.productId | objectId | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.recipients | array | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.recipients[] | null | string | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.rows | number | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.skipped | number | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.timestamp | string | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.toDate | string | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.truncated | boolean | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.type | string | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.updates | array | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.updates[] | object | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.updates[].callStatus | string | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.updates[].category | string | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.updates[].company | string | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.updates[].contact | null | string | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.updates[].datatype | string | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.updates[].email | null | string | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.updates[].followUpDate | null | string | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.updates[].id | string | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.updates[].location | string | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.updates[].name | string | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.updates[].permission | string | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.updates[].phone | null | string | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.updates[].remarks | string | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.updates[].requirements | string | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| details.username | string | ActivityLog.details | jsonb | Complete irregular audit payload preserved |
| name | string | ActivityLog.actorName | text | Preserved |
| role | string | ActivityLog.actorRole | text | Preserved |
| timestamp | date | ActivityLog.occurredAt | timestamptz | Preserved |
| userId | string | ActivityLog.actorUserCode + userId | text | User code retained even when actor no longer exists |

## blogs → BlogPost

| MongoDB field | Observed type | PostgreSQL destination | PostgreSQL type | Transformation |
|---|---|---|---|---|
| __v | number | Not migrated | — | Mongoose internal version; no business value |
| _id | objectId | BlogPost.legacyId | text / uuid relation | ObjectId converted to lowercase 24-character hex and retained |
| author | string | BlogPost.author | text | Preserved exactly |
| content | string | BlogPost.content | text | Preserved exactly |
| createdAt | date | BlogPost.createdAt | timestamptz | Preserved exactly |
| media | string | BlogPost.mediaPath | text | Preserved exactly |
| title | string | BlogPost.title | text | Preserved; deterministic slug added |

## careerapplications → CareerApplication

| MongoDB field | Observed type | PostgreSQL destination | PostgreSQL type | Transformation |
|---|---|---|---|---|
| — | Empty collection | Existing destination model where applicable | — | Recheck during final delta scan |


## careerjobs → CareerJob

| MongoDB field | Observed type | PostgreSQL destination | PostgreSQL type | Transformation |
|---|---|---|---|---|
| __v | number | Not migrated | — | Mongoose internal version; no business value |
| _id | objectId | CareerJob.legacyId | text / uuid relation | ObjectId converted to lowercase 24-character hex and retained |
| benefits | string | CareerJob.benefits | typed scalar | Enum casing normalized; values otherwise preserved |
| createdAt | date | CareerJob.createdAt | timestamptz | Enum casing normalized; values otherwise preserved |
| deadline | date | CareerJob.deadline | timestamptz | Enum casing normalized; values otherwise preserved |
| department | string | CareerJob.department | typed scalar | Enum casing normalized; values otherwise preserved |
| description | string | CareerJob.description | typed scalar | Enum casing normalized; values otherwise preserved |
| displayOrder | number | CareerJob.displayOrder | typed scalar | Enum casing normalized; values otherwise preserved |
| employmentType | string | CareerJob.employmentType | typed scalar | Enum casing normalized; values otherwise preserved |
| experience | string | CareerJob.experience | typed scalar | Enum casing normalized; values otherwise preserved |
| isPublished | boolean | CareerJob.isPublished | typed scalar | Enum casing normalized; values otherwise preserved |
| location | string | CareerJob.location | typed scalar | Enum casing normalized; values otherwise preserved |
| opensAt | date | CareerJob.opensAt | timestamptz | Enum casing normalized; values otherwise preserved |
| publishedAt | date | CareerJob.publishedAt | timestamptz | Enum casing normalized; values otherwise preserved |
| qualifications | string | CareerJob.qualifications | typed scalar | Enum casing normalized; values otherwise preserved |
| responsibilities | string | CareerJob.responsibilities | typed scalar | Enum casing normalized; values otherwise preserved |
| salaryRange | string | CareerJob.salaryRange | typed scalar | Enum casing normalized; values otherwise preserved |
| skills | string | CareerJob.skills | typed scalar | Enum casing normalized; values otherwise preserved |
| status | string | CareerJob.status | typed scalar | Enum casing normalized; values otherwise preserved |
| title | string | CareerJob.title | typed scalar | Enum casing normalized; values otherwise preserved |
| updatedAt | date | CareerJob.updatedAt | timestamptz | Enum casing normalized; values otherwise preserved |
| vacancies | number | CareerJob.vacancies | typed scalar | Enum casing normalized; values otherwise preserved |
| workMode | string | CareerJob.workMode | typed scalar | Enum casing normalized; values otherwise preserved |

## careerloginattempts → Not migrated

| MongoDB field | Observed type | PostgreSQL destination | PostgreSQL type | Transformation |
|---|---|---|---|---|
| — | Empty collection | Existing destination model where applicable | — | Recheck during final delta scan |


## careersessions → Not migrated

| MongoDB field | Observed type | PostgreSQL destination | PostgreSQL type | Transformation |
|---|---|---|---|---|
| — | Empty collection | Existing destination model where applicable | — | Recheck during final delta scan |


## careersettings → Not migrated

| MongoDB field | Observed type | PostgreSQL destination | PostgreSQL type | Transformation |
|---|---|---|---|---|
| — | Empty collection | Existing destination model where applicable | — | Recheck during final delta scan |


## categories → Category

| MongoDB field | Observed type | PostgreSQL destination | PostgreSQL type | Transformation |
|---|---|---|---|---|
| __v | number | Not migrated | — | Mongoose internal version; no business value |
| _id | objectId | Category.legacyId | text / uuid relation | ObjectId converted to lowercase 24-character hex and retained |
| cat_id | string | Category.code | text | Preserved exactly |
| name | string | Category.name | text | Preserved exactly |

## clientdatas → Lead / LeadAssignment

| MongoDB field | Observed type | PostgreSQL destination | PostgreSQL type | Transformation |
|---|---|---|---|---|
| __v | number | Not migrated | — | Mongoose internal version; no business value |
| _id | objectId | Lead / LeadAssignment.legacyId | text / uuid relation | ObjectId converted to lowercase 24-character hex and retained |
| additionalContacts | array | Lead.additionalContacts | jsonb | Array preserved |
| assignedTo | array | LeadAssignment | relational rows | Embedded users and view/update/delete flags normalized; unresolved IDs reported |
| assignedTo[] | object | LeadAssignment | relational rows | Embedded users and view/update/delete flags normalized; unresolved IDs reported |
| assignedTo[]._id | objectId | LeadAssignment | relational rows | Embedded users and view/update/delete flags normalized; unresolved IDs reported |
| assignedTo[].permissions | object | LeadAssignment | relational rows | Embedded users and view/update/delete flags normalized; unresolved IDs reported |
| assignedTo[].permissions.delete | boolean | LeadAssignment | relational rows | Embedded users and view/update/delete flags normalized; unresolved IDs reported |
| assignedTo[].permissions.update | boolean | LeadAssignment | relational rows | Embedded users and view/update/delete flags normalized; unresolved IDs reported |
| assignedTo[].permissions.view | boolean | LeadAssignment | relational rows | Embedded users and view/update/delete flags normalized; unresolved IDs reported |
| assignedTo[].user | object | LeadAssignment | relational rows | Embedded users and view/update/delete flags normalized; unresolved IDs reported |
| assignedTo[].user._id | objectId | LeadAssignment | relational rows | Embedded users and view/update/delete flags normalized; unresolved IDs reported |
| assignedTo[].user.name | string | LeadAssignment | relational rows | Embedded users and view/update/delete flags normalized; unresolved IDs reported |
| billingAddress | null | object | Lead.billingAddress | jsonb | Structure, nulls and empty strings preserved |
| billingAddress.city | string | Lead.billingAddress | jsonb | Structure, nulls and empty strings preserved |
| billingAddress.country | string | Lead.billingAddress | jsonb | Structure, nulls and empty strings preserved |
| billingAddress.postalCode | string | Lead.billingAddress | jsonb | Structure, nulls and empty strings preserved |
| billingAddress.state | string | Lead.billingAddress | jsonb | Structure, nulls and empty strings preserved |
| billingAddress.street | string | Lead.billingAddress | jsonb | Structure, nulls and empty strings preserved |
| callingdate | null | Lead.callingDate | timestamptz | Value and empty/null distinction preserved |
| callStatus | string | Lead.callStatus | text / nullable | Value and empty/null distinction preserved |
| callStatus_lc | string | Derived from canonical fields | generated/query semantics | Not copied as authority; relational indexes replace shadow values |
| category | null | string | Lead.category | text / nullable | Value and empty/null distinction preserved |
| category_lc | null | string | Derived from canonical fields | generated/query semantics | Not copied as authority; relational indexes replace shadow values |
| company | string | Lead.company | text / nullable | Value and empty/null distinction preserved |
| contact | null | string | Lead.contact | text / nullable | Value and empty/null distinction preserved |
| createdAt | date | Lead.createdAt | timestamptz | Value and empty/null distinction preserved |
| datatype | string | Lead.dataType | text / nullable | Value and empty/null distinction preserved |
| datatype_lc | string | Derived from canonical fields | generated/query semantics | Not copied as authority; relational indexes replace shadow values |
| email | null | string | Lead.email | text / nullable | Value and empty/null distinction preserved |
| fileName | null | string | Lead.fileName | text / nullable | Value and empty/null distinction preserved |
| fileName_lc | null | string | Derived from canonical fields | generated/query semantics | Not copied as authority; relational indexes replace shadow values |
| followUpDate | date | null | Lead.followUpDate | timestamptz | Value and empty/null distinction preserved |
| followUpDateOne | date | null | Lead.followUpDateOne | text / nullable | Value and empty/null distinction preserved |
| followUpDateThree | date | null | Lead.followUpDateThree | text / nullable | Value and empty/null distinction preserved |
| followUpDateTwo | date | null | Lead.followUpDateTwo | text / nullable | Value and empty/null distinction preserved |
| inquiryDate | string | Lead.inquiryDate | timestamptz | Value and empty/null distinction preserved |
| isAssigned | boolean | Derived from canonical fields | generated/query semantics | Not copied as authority; relational indexes replace shadow values |
| location | null | string | Lead.location | text / nullable | Value and empty/null distinction preserved |
| location_lc | null | string | Derived from canonical fields | generated/query semantics | Not copied as authority; relational indexes replace shadow values |
| name | string | Lead.name | text / nullable | Value and empty/null distinction preserved |
| phone | null | string | Lead.phone | text / nullable | Value and empty/null distinction preserved |
| quantity | null | number | Lead.quantity | numeric(14,3) | Value and empty/null distinction preserved |
| remarks | string | Lead.remarks | text / nullable | Value and empty/null distinction preserved |
| requirements | string | Lead.requirements | text / nullable | Value and empty/null distinction preserved |
| shippingAddress | null | Lead.shippingAddress | jsonb | Structure, nulls and empty strings preserved |
| state | null | string | Lead.state | text / nullable | Value and empty/null distinction preserved |
| state_lc | null | string | Derived from canonical fields | generated/query semantics | Not copied as authority; relational indexes replace shadow values |
| status | string | Lead.status | text / nullable | Value and empty/null distinction preserved |
| status_lc | string | Derived from canonical fields | generated/query semantics | Not copied as authority; relational indexes replace shadow values |
| updatedAt | date | Lead.updatedAt | timestamptz | Value and empty/null distinction preserved |

## clientpermissions → LegacyClientPermission / LeadPermission

| MongoDB field | Observed type | PostgreSQL destination | PostgreSQL type | Transformation |
|---|---|---|---|---|
| __v | number | Not migrated | — | Mongoose internal version; no business value |
| _id | objectId | LegacyClientPermission / LeadPermission.legacyId | text / uuid relation | ObjectId converted to lowercase 24-character hex and retained |
| clientId | objectId | LegacyClientPermission.legacyClientId | text | Preserved without forcing invalid foreign keys |
| permission | string | LegacyClientPermission.permission and LeadPermission flags | text + boolean | Every source row archived; resolvable view/update/delete values also become effective flags |
| userId | objectId | LegacyClientPermission.legacyUserId | text | Preserved without forcing invalid foreign keys |

## comments → BlogComment / LegacyOrphanRecord

| MongoDB field | Observed type | PostgreSQL destination | PostgreSQL type | Transformation |
|---|---|---|---|---|
| __v | number | Not migrated | — | Mongoose internal version; no business value |
| _id | objectId | BlogComment / LegacyOrphanRecord.legacyId | text / uuid relation | ObjectId converted to lowercase 24-character hex and retained |
| blogId | objectId | BlogComment.blogId or LegacyOrphanRecord | uuid / jsonb | Resolve by blog legacy ID; orphan source retained losslessly |
| createdAt | date | BlogComment.createdAt | timestamptz | Preserved |
| text | string | BlogComment.text | text | Preserved |
| user | string | BlogComment.userName | text | Preserved |

## companysettings → CompanySettings

| MongoDB field | Observed type | PostgreSQL destination | PostgreSQL type | Transformation |
|---|---|---|---|---|
| __v | number | Not migrated | — | Mongoose internal version; no business value |
| _id | objectId | CompanySettings.legacyId | text / uuid relation | ObjectId converted to lowercase 24-character hex and retained |
| address | string | CompanySettings.address | text | Preserved exactly |
| bankDetails | object | CompanySettings.bankDetails | jsonb | Nested object preserved |
| bankDetails.accountHolder | string | CompanySettings.bankDetails | jsonb | Nested object preserved |
| bankDetails.accountNumber | string | CompanySettings.bankDetails | jsonb | Nested object preserved |
| bankDetails.bankName | string | CompanySettings.bankDetails | jsonb | Nested object preserved |
| bankDetails.ifscCode | string | CompanySettings.bankDetails | jsonb | Nested object preserved |
| bankDetails.upiId | string | CompanySettings.bankDetails | jsonb | Nested object preserved |
| companyName | string | CompanySettings.companyName | text | Preserved exactly |
| createdAt | date | CompanySettings.createdAt | timestamptz | Preserved exactly |
| gst | string | CompanySettings.gst | text | Preserved exactly |
| invoicePrefix | string | CompanySettings.invoicePrefix | text | Preserved exactly |
| invoiceStart | number | CompanySettings.invoiceStart | integer | Preserved exactly |
| key | string | CompanySettings.key | text | Preserved exactly |
| pan | string | CompanySettings.pan | text | Preserved exactly |
| quotationPrefix | string | CompanySettings.quotationPrefix | text | Preserved exactly |
| updatedAt | date | CompanySettings.updatedAt | timestamptz | Preserved exactly |

## counters → LegacyCounter

| MongoDB field | Observed type | PostgreSQL destination | PostgreSQL type | Transformation |
|---|---|---|---|---|
| __v | number | Not migrated | — | Mongoose internal version; no business value |
| _id | objectId | LegacyCounter.legacyId | text / uuid relation | ObjectId converted to lowercase 24-character hex and retained |
| role | string | LegacyCounter.role | text | Preserved for sequence continuity |
| seq | number | LegacyCounter.seq | integer | Preserved for sequence continuity |

## importhistories → LeadImportJob / LeadImportRow

| MongoDB field | Observed type | PostgreSQL destination | PostgreSQL type | Transformation |
|---|---|---|---|---|
| — | Empty collection | Existing destination model where applicable | — | Recheck during final delta scan |


## products → Product / ProductPrice

| MongoDB field | Observed type | PostgreSQL destination | PostgreSQL type | Transformation |
|---|---|---|---|---|
| __v | number | Not migrated | — | Mongoose internal version; no business value |
| _id | objectId | Product / ProductPrice.legacyId | text / uuid relation | ObjectId converted to lowercase 24-character hex and retained |
| additionalInfo | array | Product.legacyData.additionalInfo | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| attributes | object | Product.legacyData.attributes | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| attributes.color | array | Product.legacyData.attributes.color | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| attributes.color[] | string | Product.legacyData.attributes.color[] | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| attributes.material | string | Product.legacyData.attributes.material | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| attributes.size | array | Product.legacyData.attributes.size | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| attributes.size[] | string | Product.legacyData.attributes.size[] | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| brand | string | Product.legacyData.brand | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| cat_id | string | Product.legacyCategoryCode / Product.categoryId + Product.legacyData | jsonb | Typed field plus lossless source snapshot |
| category | null | objectId | Product.legacyData.category | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| colour | array | Product.legacyData.colour | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| colour[] | string | Product.legacyData.colour[] | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| createdAt | date | Product.createdAt + Product.legacyData | jsonb | Typed field plus lossless source snapshot |
| createdBy | null | objectId | Product.legacyData.createdBy | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| description | object | Product.legacyData.description | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| description.long | string | Product.legacyData.description.long | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| description.short | string | Product.legacyData.description.short | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| dimension | string | Product.dimension + Product.legacyData | jsonb | Typed field plus lossless source snapshot |
| dimensions | object | Product.legacyData.dimensions | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| dimensions.asString | string | Product.legacyData.dimensions.asString | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| dimensions.height | number | Product.legacyData.dimensions.height | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| dimensions.length | number | Product.legacyData.dimensions.length | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| dimensions.weight | null | Product.legacyData.dimensions.weight | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| dimensions.width | number | Product.legacyData.dimensions.width | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| fabricType | string | Product.legacyData.fabricType | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| GST_rate | number | Product.gstRate + Product.legacyData | numeric + jsonb | Typed field plus lossless source snapshot |
| GSTRate | number | Product.gstRate + Product.legacyData | numeric + jsonb | Typed field plus lossless source snapshot |
| HSN_code | string | Product.hsnCode + Product.legacyData | jsonb | Typed field plus lossless source snapshot |
| images | array | Product.legacyData.images | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| images[] | object | Product.legacyData.images[] | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| images[]._id | objectId | Product.legacyData.images[]._id | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| images[].altText | string | Product.legacyData.images[].altText | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| images[].url | string | Product.legacyData.images[].url | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| isActive | boolean | Product.legacyData.isActive | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| isDeleted | boolean | Product.legacyData.isDeleted | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| isFeatured | boolean | Product.legacyData.isFeatured | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| isPublished | boolean | Product.legacyData.isPublished | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| keywords | array | Product.legacyData.keywords | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| keywords[] | string | Product.legacyData.keywords[] | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| metaDescription | string | Product.legacyData.metaDescription | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| metaTitle | string | Product.legacyData.metaTitle | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| name | string | Product.legacyData.name | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| origin | object | Product.legacyData.origin | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| origin.categoryId | string | Product.legacyData.origin.categoryId | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| origin.productId | string | Product.legacyData.origin.productId | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| origin.source | string | Product.legacyData.origin.source | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| origin.subcategoryId | string | Product.legacyData.origin.subcategoryId | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| p_code | string | Product.code + Product.legacyData | jsonb | Typed field plus lossless source snapshot |
| p_color | string | Product.color + Product.legacyData | jsonb | Typed field plus lossless source snapshot |
| p_description | string | Product.description + Product.legacyData | jsonb | Typed field plus lossless source snapshot |
| p_image | null | string | Product.imagePath + Product.legacyData | jsonb | Typed field plus lossless source snapshot |
| p_name | string | Product.name + Product.legacyData | jsonb | Typed field plus lossless source snapshot |
| p_price | object | Product.legacyData.p_price | numeric + jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| p_price.basic_amount | number | ProductPrice.basicAmount + Product.legacyData | numeric + jsonb | Typed field plus lossless source snapshot |
| p_price.currency | string | Product.legacyData.p_price.currency | numeric + jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| p_price.GST_rate | number | ProductPrice.gstRate + Product.legacyData | numeric + jsonb | Typed field plus lossless source snapshot |
| p_price.net_amount | number | ProductPrice.netAmount + Product.legacyData | numeric + jsonb | Typed field plus lossless source snapshot |
| p_price.price_code | string | ProductPrice.priceCode + Product.legacyData | numeric + jsonb | Typed field plus lossless source snapshot |
| p_price.purchase_price | number | ProductPrice.purchasePrice + Product.legacyData | numeric + jsonb | Typed field plus lossless source snapshot |
| p_price.salePrice | null | Product.legacyData.p_price.salePrice | numeric + jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| p_price.sales_100_above | number | ProductPrice.sales100Above + Product.legacyData | numeric + jsonb | Typed field plus lossless source snapshot |
| p_price.sales_50_100 | number | ProductPrice.sales50To100 + Product.legacyData | numeric + jsonb | Typed field plus lossless source snapshot |
| p_type | string | Product.type + Product.legacyData | jsonb | Typed field plus lossless source snapshot |
| price | null | number | Product.legacyData.price | numeric + jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| productCode | string | Product.legacyData.productCode | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| quantity | number | Product.legacyData.quantity | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| ratings | object | Product.legacyData.ratings | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| ratings.average | number | Product.legacyData.ratings.average | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| ratings.count | number | Product.legacyData.ratings.count | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| s_code | string | Product.secondaryCode + Product.legacyData | jsonb | Typed field plus lossless source snapshot |
| salePrice | null | Product.legacyData.salePrice | numeric + jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| size | array | Product.legacyData.size | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| size[] | string | Product.legacyData.size[] | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| sku | string | Product.legacyData.sku | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| SKU | string | Product.legacyData.SKU | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| slug | string | Product.legacyData.slug | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| specifications | array | Product.legacyData.specifications | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| status | string | Product.status + Product.legacyData | jsonb | Typed field plus lossless source snapshot |
| stock | number | Product.legacyData.stock | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| subcategory | null | objectId | Product.legacyData.subcategory | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| subImages | array | Product.legacyData.subImages | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| subImages[] | object | Product.legacyData.subImages[] | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| subImages[]._id | objectId | Product.legacyData.subImages[]._id | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| subImages[].altText | string | Product.legacyData.subImages[].altText | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| subImages[].url | string | Product.legacyData.subImages[].url | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| tags | array | Product.legacyData.tags | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| tags[] | string | Product.legacyData.tags[] | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |
| updatedAt | date | Product.updatedAt + Product.legacyData | jsonb | Typed field plus lossless source snapshot |
| updatedBy | null | objectId | Product.legacyData.updatedBy | jsonb | Irregular website/catalogue attribute preserved losslessly in JSONB |

## quotations → Quotation / QuotationItem

| MongoDB field | Observed type | PostgreSQL destination | PostgreSQL type | Transformation |
|---|---|---|---|---|
| __v | number | Not migrated | — | Mongoose internal version; no business value |
| _id | objectId | Quotation / QuotationItem.legacyId | text / uuid relation | ObjectId converted to lowercase 24-character hex and retained |
| bankDetails | object | Quotation.bankDetails | jsonb | Document snapshot retained |
| bankDetails._id | objectId | Quotation.bankDetails | jsonb | Document snapshot retained |
| bankDetails.accountHolder | string | Quotation.bankDetails | jsonb | Document snapshot retained |
| bankDetails.accountNumber | string | Quotation.bankDetails | jsonb | Document snapshot retained |
| bankDetails.bankName | string | Quotation.bankDetails | jsonb | Document snapshot retained |
| bankDetails.ifscCode | string | Quotation.bankDetails | jsonb | Document snapshot retained |
| bankDetails.upiId | string | Quotation.bankDetails | jsonb | Document snapshot retained |
| createdAt | date | Quotation.createdAt + Quotation.legacyData | timestamptz | Preserved |
| invoiceDetails | object | Quotation.invoiceDetails | jsonb | Document snapshot and dates retained |
| invoiceDetails._id | objectId | Quotation.invoiceDetails | jsonb | Document snapshot and dates retained |
| invoiceDetails.date | date | Quotation.invoiceDetails | jsonb | Document snapshot and dates retained |
| invoiceDetails.number | string | Quotation.invoiceDetails | jsonb | Document snapshot and dates retained |
| invoiceDetails.placeOfSupply | string | Quotation.invoiceDetails | jsonb | Document snapshot and dates retained |
| invoiceDetails.poNo | string | Quotation.invoiceDetails | jsonb | Document snapshot and dates retained |
| invoiceDetails.prefix | string | Quotation.invoiceDetails | jsonb | Document snapshot and dates retained |
| invoiceDetails.validityDate | date | Quotation.invoiceDetails | jsonb | Document snapshot and dates retained |
| invoiceDetails.validityDays | number | Quotation.invoiceDetails | jsonb | Document snapshot and dates retained |
| items | array | QuotationItem / Quotation.legacyData | relational + jsonb | Items normalized in original order; source snapshot retained; Decimal used for money |
| items[] | object | QuotationItem / Quotation.legacyData | relational + jsonb | Items normalized in original order; source snapshot retained; Decimal used for money |
| items[]._id | objectId | QuotationItem / Quotation.legacyData | relational + jsonb | Items normalized in original order; source snapshot retained; Decimal used for money |
| items[].discount | number | QuotationItem / Quotation.legacyData | relational + jsonb | Items normalized in original order; source snapshot retained; Decimal used for money |
| items[].hsn | string | QuotationItem / Quotation.legacyData | relational + jsonb | Items normalized in original order; source snapshot retained; Decimal used for money |
| items[].name | string | QuotationItem / Quotation.legacyData | relational + jsonb | Items normalized in original order; source snapshot retained; Decimal used for money |
| items[].price | number | QuotationItem / Quotation.legacyData | relational + jsonb | Items normalized in original order; source snapshot retained; Decimal used for money |
| items[].qty | number | QuotationItem / Quotation.legacyData | relational + jsonb | Items normalized in original order; source snapshot retained; Decimal used for money |
| items[].tax | number | QuotationItem / Quotation.legacyData | relational + jsonb | Items normalized in original order; source snapshot retained; Decimal used for money |
| notes | string | Quotation.notes + Quotation.legacyData | text / jsonb | Preserved |
| party | object | Quotation.party | jsonb | Document snapshot retained including embedded IDs |
| party._id | objectId | Quotation.party | jsonb | Document snapshot retained including embedded IDs |
| party.billToAddress | string | Quotation.party | jsonb | Document snapshot retained including embedded IDs |
| party.company | string | Quotation.party | jsonb | Document snapshot retained including embedded IDs |
| party.name | string | Quotation.party | jsonb | Document snapshot retained including embedded IDs |
| party.pan | string | Quotation.party | jsonb | Document snapshot retained including embedded IDs |
| party.phone | string | Quotation.party | jsonb | Document snapshot retained including embedded IDs |
| party.selectedShippingAddress | object | Quotation.party | jsonb | Document snapshot retained including embedded IDs |
| party.selectedShippingAddress._id | objectId | Quotation.party | jsonb | Document snapshot retained including embedded IDs |
| party.selectedShippingAddress.address | string | Quotation.party | jsonb | Document snapshot retained including embedded IDs |
| party.selectedShippingAddress.name | string | Quotation.party | jsonb | Document snapshot retained including embedded IDs |
| party.selectedShippingAddress.state | string | Quotation.party | jsonb | Document snapshot retained including embedded IDs |
| party.shippingAddresses | array | Quotation.party | jsonb | Document snapshot retained including embedded IDs |
| party.shippingAddresses[] | object | Quotation.party | jsonb | Document snapshot retained including embedded IDs |
| party.shippingAddresses[]._id | objectId | Quotation.party | jsonb | Document snapshot retained including embedded IDs |
| party.shippingAddresses[].address | string | Quotation.party | jsonb | Document snapshot retained including embedded IDs |
| party.shippingAddresses[].name | string | Quotation.party | jsonb | Document snapshot retained including embedded IDs |
| party.shippingAddresses[].state | string | Quotation.party | jsonb | Document snapshot retained including embedded IDs |
| party.state | string | Quotation.party | jsonb | Document snapshot retained including embedded IDs |
| summary | object | Quotation.summarySnapshot and typed totals | jsonb + numeric(16,2) | Summary retained; totals recomputed with original server algorithm and reconciled |
| summary._id | objectId | Quotation.summarySnapshot and typed totals | jsonb + numeric(16,2) | Summary retained; totals recomputed with original server algorithm and reconciled |
| summary.additionalCharges | number | Quotation.summarySnapshot and typed totals | jsonb + numeric(16,2) | Summary retained; totals recomputed with original server algorithm and reconciled |
| summary.amountReceived | number | Quotation.summarySnapshot and typed totals | jsonb + numeric(16,2) | Summary retained; totals recomputed with original server algorithm and reconciled |
| summary.applyTCS | boolean | Quotation.summarySnapshot and typed totals | jsonb + numeric(16,2) | Summary retained; totals recomputed with original server algorithm and reconciled |
| summary.autoRoundOff | boolean | Quotation.summarySnapshot and typed totals | jsonb + numeric(16,2) | Summary retained; totals recomputed with original server algorithm and reconciled |
| summary.discount | number | Quotation.summarySnapshot and typed totals | jsonb + numeric(16,2) | Summary retained; totals recomputed with original server algorithm and reconciled |
| summary.discountType | string | Quotation.summarySnapshot and typed totals | jsonb + numeric(16,2) | Summary retained; totals recomputed with original server algorithm and reconciled |
| summary.paymentMethod | string | Quotation.summarySnapshot and typed totals | jsonb + numeric(16,2) | Summary retained; totals recomputed with original server algorithm and reconciled |
| summary.roundOffAmount | number | Quotation.summarySnapshot and typed totals | jsonb + numeric(16,2) | Summary retained; totals recomputed with original server algorithm and reconciled |
| summary.roundOffSign | string | Quotation.summarySnapshot and typed totals | jsonb + numeric(16,2) | Summary retained; totals recomputed with original server algorithm and reconciled |
| terms | string | Quotation.terms + Quotation.legacyData | text / jsonb | Preserved |
| updatedAt | date | Quotation.updatedAt + Quotation.legacyData | timestamptz | Preserved |
| user | objectId | Quotation.userId | uuid foreign key | Resolved through User.legacyId; unresolved records archived |

## users → User

| MongoDB field | Observed type | PostgreSQL destination | PostgreSQL type | Transformation |
|---|---|---|---|---|
| __v | number | Not migrated | — | Mongoose internal version; no business value |
| _id | objectId | User.legacyId | text / uuid relation | ObjectId converted to lowercase 24-character hex and retained |
| email | string | User.email | text | Preserved exactly |
| enabled | boolean | User.enabled | boolean | Preserved exactly |
| location | string | User.location | text | Preserved exactly |
| name | string | User.name | text | Preserved exactly |
| password | string | Supabase Auth recovery flow | Not copied | bcrypt hashes are not exposed or imported; user activates through approved recovery/invitation |
| role | string | User.role | text | admin/user normalized to ADMIN/USER |
| userId | string | User.userId | text | Preserved exactly |
| username | string | User.username | text | Preserved exactly |

## vendoractivities → VendorActivity

| MongoDB field | Observed type | PostgreSQL destination | PostgreSQL type | Transformation |
|---|---|---|---|---|
| — | Empty collection | Existing destination model where applicable | — | Recheck during final delta scan |


## vendorcategories → VendorCategory

| MongoDB field | Observed type | PostgreSQL destination | PostgreSQL type | Transformation |
|---|---|---|---|---|
| — | Empty collection | Existing destination model where applicable | — | Recheck during final delta scan |


## vendordocuments → VendorDocument

| MongoDB field | Observed type | PostgreSQL destination | PostgreSQL type | Transformation |
|---|---|---|---|---|
| — | Empty collection | Existing destination model where applicable | — | Recheck during final delta scan |


## vendorevaluations → VendorEvaluation

| MongoDB field | Observed type | PostgreSQL destination | PostgreSQL type | Transformation |
|---|---|---|---|---|
| — | Empty collection | Existing destination model where applicable | — | Recheck during final delta scan |


## vendorimportjobs → VendorImportJob / VendorImportRow

| MongoDB field | Observed type | PostgreSQL destination | PostgreSQL type | Transformation |
|---|---|---|---|---|
| — | Empty collection | Existing destination model where applicable | — | Recheck during final delta scan |


## vendorproducts → VendorProduct / VendorPriceTier

| MongoDB field | Observed type | PostgreSQL destination | PostgreSQL type | Transformation |
|---|---|---|---|---|
| — | Empty collection | Existing destination model where applicable | — | Recheck during final delta scan |


## vendors → Vendor / VendorContact / VendorAddress

| MongoDB field | Observed type | PostgreSQL destination | PostgreSQL type | Transformation |
|---|---|---|---|---|
| __v | number | Not migrated | — | Mongoose internal version; no business value |
| _id | objectId | Vendor / VendorContact / VendorAddress.legacyId | text / uuid relation | ObjectId converted to lowercase 24-character hex and retained |
| addr1 | string | VendorAddress.line1 + Vendor.legacyData | text / jsonb | Normalized typed field plus complete source snapshot |
| addr2 | string | VendorAddress.line2 + Vendor.legacyData | text / jsonb | Normalized typed field plus complete source snapshot |
| cat_id | string | Vendor.legacyData.cat_id | text / jsonb | Legacy attribute preserved in JSONB |
| city | string | VendorAddress.city + Vendor.legacyData | text / jsonb | Normalized typed field plus complete source snapshot |
| contact_name | string | VendorContact.name + Vendor.legacyData | text / jsonb | Normalized typed field plus complete source snapshot |
| email | string | Vendor.email + Vendor.legacyData | text / jsonb | Normalized typed field plus complete source snapshot |
| name | string | Vendor.name + Vendor.legacyData | text / jsonb | Normalized typed field plus complete source snapshot |
| phone | string | Vendor.phone + Vendor.legacyData | text / jsonb | Normalized typed field plus complete source snapshot |
| pin_code | string | VendorAddress.postalCode + Vendor.legacyData | text / jsonb | Normalized typed field plus complete source snapshot |
| products | array | Vendor.legacyData.products | text / jsonb | Legacy attribute preserved in JSONB |
| products[] | string | Vendor.legacyData.products[] | text / jsonb | Legacy attribute preserved in JSONB |
| state | string | VendorAddress.state + Vendor.legacyData | text / jsonb | Normalized typed field plus complete source snapshot |
| type | string | Vendor.legacyData.type | text / jsonb | Legacy attribute preserved in JSONB |
| v_code | string | Vendor.vendorCode + Vendor.legacyData | text / jsonb | Normalized typed field plus complete source snapshot |

## visitors → VisitorDay / VisitorEvent

| MongoDB field | Observed type | PostgreSQL destination | PostgreSQL type | Transformation |
|---|---|---|---|---|
| __v | number | Not migrated | — | Mongoose internal version; no business value |
| _id | objectId | VisitorDay / VisitorEvent.legacyId | text / uuid relation | ObjectId converted to lowercase 24-character hex and retained |
| count | number | VisitorDay.count | integer | Preserved exactly |
| date | string | VisitorDay.date | date | Preserved exactly |
| visitors | array | VisitorEvent | relational rows | Timestamp/location/device preserved; raw IP transformed to keyed HMAC, never stored |
| visitors[] | object | VisitorEvent | relational rows | Timestamp/location/device preserved; raw IP transformed to keyed HMAC, never stored |
| visitors[]._id | objectId | VisitorEvent | relational rows | Timestamp/location/device preserved; raw IP transformed to keyed HMAC, never stored |
| visitors[].city | string | VisitorEvent | relational rows | Timestamp/location/device preserved; raw IP transformed to keyed HMAC, never stored |
| visitors[].device | string | VisitorEvent | relational rows | Timestamp/location/device preserved; raw IP transformed to keyed HMAC, never stored |
| visitors[].ip | string | VisitorEvent | relational rows | Timestamp/location/device preserved; raw IP transformed to keyed HMAC, never stored |
| visitors[].region | string | VisitorEvent | relational rows | Timestamp/location/device preserved; raw IP transformed to keyed HMAC, never stored |
| visitors[].timestamp | date | VisitorEvent | relational rows | Timestamp/location/device preserved; raw IP transformed to keyed HMAC, never stored |

## Explicit security transformations

- MongoDB bcrypt password hashes are never copied. Supabase Auth accounts are linked through an approved activation/reset flow.
- Visitor IP addresses are converted to keyed HMAC-SHA256 using `IP_HASH_SALT`; raw IPs are not stored in PostgreSQL.
- Mongoose `__v` is framework metadata and is not migrated.
- Unresolved records are stored in `LegacyClientPermission` or `LegacyOrphanRecord` with source hashes and complete non-secret source data.
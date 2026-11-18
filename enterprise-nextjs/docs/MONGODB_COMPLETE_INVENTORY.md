# MongoDB complete inventory

Generated from a read-only bounded inspection at 2026-11-17T07:48:49.110Z. No document values, credentials, password hashes, or raw IPs are included.

- Collections: **25**
- Documents: **13885**
- Field sampling limit: **500** per collection (head/tail bounded sample; all collections here are fully sampled except high-volume activity and permission collections).

## Collection counts

| Collection | Documents | Sampled | Observed fields | Indexes |
|---|---:|---:|---:|---:|
| activitylogs | 4222 | 500 | 49 | 3 |
| blogs | 1 | 1 | 7 | 1 |
| careerapplications | 0 | 0 | 0 | 5 |
| careerjobs | 3 | 3 | 23 | 3 |
| careerloginattempts | 0 | 0 | 0 | 3 |
| careersessions | 0 | 0 | 0 | 3 |
| careersettings | 0 | 0 | 0 | 2 |
| categories | 12 | 12 | 4 | 3 |
| clientdatas | 62 | 62 | 51 | 26 |
| clientpermissions | 9006 | 500 | 5 | 1 |
| comments | 1 | 1 | 6 | 1 |
| companysettings | 1 | 1 | 18 | 2 |
| counters | 12 | 12 | 4 | 2 |
| importhistories | 0 | 0 | 0 | 4 |
| products | 125 | 125 | 91 | 10 |
| quotations | 18 | 18 | 62 | 3 |
| users | 11 | 11 | 10 | 4 |
| vendoractivities | 0 | 0 | 0 | 3 |
| vendorcategories | 0 | 0 | 0 | 3 |
| vendordocuments | 0 | 0 | 0 | 3 |
| vendorevaluations | 0 | 0 | 0 | 2 |
| vendorimportjobs | 0 | 0 | 0 | 3 |
| vendorproducts | 0 | 0 | 0 | 4 |
| vendors | 3 | 3 | 16 | 10 |
| visitors | 408 | 408 | 12 | 2 |

## activitylogs

Documents: 4222. Destination: ActivityLog.

| Field path | Observed BSON types | Sample occurrences | Nulls | Empty strings | ObjectId candidate |
|---|---|---:|---:|---:|---|
| __v | number | 500 | 0 | 0 | No |
| _id | objectId | 500 | 0 | 0 | Yes |
| action | string | 500 | 0 | 0 | No |
| details | object | 500 | 0 | 0 | No |
| details.clients | array | 1 | 0 | 0 | No |
| details.clients[] | string | 2 | 0 | 0 | No |
| details.company | string | 3 | 0 | 1 | No |
| details.email | string | 3 | 0 | 1 | No |
| details.fileName | string | 57 | 0 | 0 | No |
| details.fromDate | string | 21 | 0 | 0 | No |
| details.imageChanged | boolean | 15 | 0 | 0 | No |
| details.inserted | number | 57 | 0 | 0 | No |
| details.leadId | string | 193 | 0 | 0 | No |
| details.leadsCount | number | 1 | 0 | 0 | No |
| details.module | string | 1 | 0 | 0 | No |
| details.name | string | 3 | 0 | 1 | No |
| details.permission | string | 1 | 0 | 0 | No |
| details.phone | string | 3 | 0 | 1 | No |
| details.productCode | string | 19 | 0 | 0 | No |
| details.productId | objectId | 34 | 0 | 0 | Yes |
| details.recipients | array | 11 | 0 | 0 | No |
| details.recipients[] | null | string | 123 | 59 | 0 | No |
| details.rows | number | 1 | 0 | 0 | No |
| details.skipped | number | 57 | 0 | 0 | No |
| details.timestamp | string | 112 | 0 | 0 | No |
| details.toDate | string | 21 | 0 | 0 | No |
| details.truncated | boolean | 1 | 0 | 0 | No |
| details.type | string | 1 | 0 | 0 | No |
| details.updates | array | 67 | 0 | 0 | No |
| details.updates[] | object | 861 | 0 | 0 | No |
| details.updates[].callStatus | string | 1714 | 0 | 0 | No |
| details.updates[].category | string | 1714 | 0 | 72 | No |
| details.updates[].company | string | 1084 | 0 | 0 | No |
| details.updates[].contact | null | string | 1694 | 1358 | 52 | No |
| details.updates[].datatype | string | 1694 | 0 | 122 | No |
| details.updates[].email | null | string | 1714 | 1672 | 4 | No |
| details.updates[].followUpDate | null | string | 1710 | 1494 | 0 | No |
| details.updates[].id | string | 1714 | 0 | 0 | No |
| details.updates[].location | string | 1714 | 0 | 538 | No |
| details.updates[].name | string | 1714 | 0 | 1578 | No |
| details.updates[].permission | string | 612 | 0 | 0 | No |
| details.updates[].phone | null | string | 1722 | 274 | 0 | No |
| details.updates[].remarks | string | 1714 | 0 | 1620 | No |
| details.updates[].requirements | string | 152 | 0 | 48 | No |
| details.username | string | 112 | 0 | 0 | No |
| name | string | 500 | 0 | 0 | No |
| role | string | 500 | 0 | 0 | No |
| timestamp | date | 500 | 0 | 0 | No |
| userId | string | 500 | 0 | 0 | No |

Indexes:
- _id_: {"_id":1}
- userId_1_timestamp_-1: {"userId":1,"timestamp":-1}
- timestamp_-1: {"timestamp":-1}
- File reference details.fileName: observed 57; local existing 0; local missing 57; remote 0; binary 0; unverifiable 0.

## blogs

Documents: 1. Destination: BlogPost.

| Field path | Observed BSON types | Sample occurrences | Nulls | Empty strings | ObjectId candidate |
|---|---|---:|---:|---:|---|
| __v | number | 1 | 0 | 0 | No |
| _id | objectId | 1 | 0 | 0 | Yes |
| author | string | 1 | 0 | 0 | No |
| content | string | 1 | 0 | 0 | No |
| createdAt | date | 1 | 0 | 0 | No |
| media | string | 1 | 0 | 0 | No |
| title | string | 1 | 0 | 0 | No |

Indexes:
- _id_: {"_id":1}
- File reference media: observed 1; local existing 0; local missing 0; remote 1; binary 0; unverifiable 0.

## careerapplications

Documents: 0. Destination: CareerApplication.

| Field path | Observed BSON types | Sample occurrences | Nulls | Empty strings | ObjectId candidate |
|---|---|---:|---:|---:|---|

Indexes:
- _id_: {"_id":1}
- jobId_1: {"jobId":1}
- submissionKey_1: {"submissionKey":1}; unique; sparse
- createdAt_-1: {"createdAt":-1}
- status_1_createdAt_-1: {"status":1,"createdAt":-1}

## careerjobs

Documents: 3. Destination: CareerJob.

| Field path | Observed BSON types | Sample occurrences | Nulls | Empty strings | ObjectId candidate |
|---|---|---:|---:|---:|---|
| __v | number | 3 | 0 | 0 | No |
| _id | objectId | 3 | 0 | 0 | Yes |
| benefits | string | 3 | 0 | 3 | No |
| createdAt | date | 3 | 0 | 0 | No |
| deadline | date | 3 | 0 | 0 | No |
| department | string | 3 | 0 | 0 | No |
| description | string | 3 | 0 | 0 | No |
| displayOrder | number | 3 | 0 | 0 | No |
| employmentType | string | 3 | 0 | 0 | No |
| experience | string | 3 | 0 | 0 | No |
| isPublished | boolean | 3 | 0 | 0 | No |
| location | string | 3 | 0 | 0 | No |
| opensAt | date | 3 | 0 | 0 | No |
| publishedAt | date | 3 | 0 | 0 | No |
| qualifications | string | 3 | 0 | 0 | No |
| responsibilities | string | 3 | 0 | 0 | No |
| salaryRange | string | 3 | 0 | 3 | No |
| skills | string | 3 | 0 | 0 | No |
| status | string | 3 | 0 | 0 | No |
| title | string | 3 | 0 | 0 | No |
| updatedAt | date | 3 | 0 | 0 | No |
| vacancies | number | 3 | 0 | 0 | No |
| workMode | string | 3 | 0 | 0 | No |

Indexes:
- _id_: {"_id":1}
- status_1_isPublished_1_deadline_1: {"status":1,"isPublished":1,"deadline":1}
- createdAt_-1: {"createdAt":-1}

## careerloginattempts

Documents: 0. Destination: Not migrated.

| Field path | Observed BSON types | Sample occurrences | Nulls | Empty strings | ObjectId candidate |
|---|---|---:|---:|---:|---|

Indexes:
- _id_: {"_id":1}
- ipHash_1: {"ipHash":1}; unique
- updatedAt_1: {"updatedAt":1}

## careersessions

Documents: 0. Destination: Not migrated.

| Field path | Observed BSON types | Sample occurrences | Nulls | Empty strings | ObjectId candidate |
|---|---|---:|---:|---:|---|

Indexes:
- _id_: {"_id":1}
- tokenHash_1: {"tokenHash":1}; unique
- expiresAt_1: {"expiresAt":1}

## careersettings

Documents: 0. Destination: Not migrated.

| Field path | Observed BSON types | Sample occurrences | Nulls | Empty strings | ObjectId candidate |
|---|---|---:|---:|---:|---|

Indexes:
- _id_: {"_id":1}
- key_1: {"key":1}; unique

## categories

Documents: 12. Destination: Category.

| Field path | Observed BSON types | Sample occurrences | Nulls | Empty strings | ObjectId candidate |
|---|---|---:|---:|---:|---|
| __v | number | 12 | 0 | 0 | No |
| _id | objectId | 12 | 0 | 0 | Yes |
| cat_id | string | 12 | 0 | 0 | No |
| name | string | 12 | 0 | 0 | No |

Indexes:
- _id_: {"_id":1}
- cat_id_1: {"cat_id":1}; unique
- name_1: {"name":1}; unique

## clientdatas

Documents: 62. Destination: Lead / LeadAssignment.

| Field path | Observed BSON types | Sample occurrences | Nulls | Empty strings | ObjectId candidate |
|---|---|---:|---:|---:|---|
| __v | number | 62 | 0 | 0 | No |
| _id | objectId | 62 | 0 | 0 | Yes |
| additionalContacts | array | 62 | 0 | 0 | No |
| assignedTo | array | 62 | 0 | 0 | No |
| assignedTo[] | object | 49 | 0 | 0 | No |
| assignedTo[]._id | objectId | 98 | 0 | 0 | Yes |
| assignedTo[].permissions | object | 98 | 0 | 0 | No |
| assignedTo[].permissions.delete | boolean | 98 | 0 | 0 | No |
| assignedTo[].permissions.update | boolean | 98 | 0 | 0 | No |
| assignedTo[].permissions.view | boolean | 98 | 0 | 0 | No |
| assignedTo[].user | object | 98 | 0 | 0 | No |
| assignedTo[].user._id | objectId | 98 | 0 | 0 | Yes |
| assignedTo[].user.name | string | 98 | 0 | 0 | No |
| billingAddress | null | object | 62 | 14 | 0 | No |
| billingAddress.city | string | 1 | 0 | 0 | No |
| billingAddress.country | string | 1 | 0 | 1 | No |
| billingAddress.postalCode | string | 1 | 0 | 1 | No |
| billingAddress.state | string | 48 | 0 | 21 | No |
| billingAddress.street | string | 48 | 0 | 47 | No |
| callingdate | null | 62 | 62 | 0 | No |
| callStatus | string | 62 | 0 | 0 | No |
| callStatus_lc | string | 62 | 0 | 0 | No |
| category | null | string | 49 | 5 | 1 | No |
| category_lc | null | string | 49 | 5 | 1 | No |
| company | string | 59 | 0 | 4 | No |
| contact | null | string | 49 | 45 | 2 | No |
| createdAt | date | 62 | 0 | 0 | No |
| datatype | string | 62 | 0 | 1 | No |
| datatype_lc | string | 62 | 0 | 1 | No |
| email | null | string | 62 | 21 | 4 | No |
| fileName | null | string | 62 | 15 | 0 | No |
| fileName_lc | null | string | 62 | 15 | 0 | No |
| followUpDate | date | null | 62 | 15 | 0 | No |
| followUpDateOne | date | null | 62 | 20 | 0 | No |
| followUpDateThree | date | null | 62 | 57 | 0 | No |
| followUpDateTwo | date | null | 62 | 44 | 0 | No |
| inquiryDate | string | 60 | 0 | 0 | No |
| isAssigned | boolean | 62 | 0 | 0 | No |
| location | null | string | 56 | 31 | 4 | No |
| location_lc | null | string | 56 | 31 | 4 | No |
| name | string | 59 | 0 | 3 | No |
| phone | null | string | 62 | 1 | 3 | No |
| quantity | null | number | 49 | 1 | 0 | No |
| remarks | string | 47 | 0 | 9 | No |
| requirements | string | 54 | 0 | 32 | No |
| shippingAddress | null | 62 | 62 | 0 | No |
| state | null | string | 49 | 21 | 1 | No |
| state_lc | null | string | 49 | 21 | 1 | No |
| status | string | 62 | 0 | 0 | No |
| status_lc | string | 62 | 0 | 0 | No |
| updatedAt | date | 62 | 0 | 0 | No |

Indexes:
- _id_: {"_id":1}
- inquiryDate_1_phone_1_autocreated: {"inquiryDate":1,"phone":1}
- phone_1: {"phone":1}
- email_1: {"email":1}
- contact_1: {"contact":1}
- status_1: {"status":1}
- callStatus_1: {"callStatus":1}
- category_1: {"category":1}
- datatype_1: {"datatype":1}
- followUpDate_1: {"followUpDate":1}
- inquiryDate_1: {"inquiryDate":1}
- createdAt_-1: {"createdAt":-1}
- assignedTo.user._id_1: {"assignedTo.user._id":1}
- assignedTo.user._id_1_status_1: {"assignedTo.user._id":1,"status":1}
- status_1_createdAt_-1: {"status":1,"createdAt":-1}
- assignedTo.user.name_1_status_1: {"assignedTo.user.name":1,"status":1}
- assignedTo.user.name_1_followUpDate_1: {"assignedTo.user.name":1,"followUpDate":1}
- category_lc_1: {"category_lc":1}
- location_lc_1: {"location_lc":1}
- state_lc_1: {"state_lc":1}
- datatype_lc_1: {"datatype_lc":1}
- callStatus_lc_1: {"callStatus_lc":1}
- status_lc_1: {"status_lc":1}
- fileName_lc_1: {"fileName_lc":1}
- isAssigned_1: {"isAssigned":1}
- createdBy_1: {"createdBy":1}
- Duplicate check email: 3 groups / 6 sampled documents.
- Duplicate check phone: 2 groups / 4 sampled documents.
- File reference fileName: observed 47; local existing 0; local missing 47; remote 0; binary 0; unverifiable 0.
- File reference fileName_lc: observed 47; local existing 0; local missing 47; remote 0; binary 0; unverifiable 0.

## clientpermissions

Documents: 9006. Destination: LegacyClientPermission / LeadPermission.

| Field path | Observed BSON types | Sample occurrences | Nulls | Empty strings | ObjectId candidate |
|---|---|---:|---:|---:|---|
| __v | number | 500 | 0 | 0 | No |
| _id | objectId | 500 | 0 | 0 | Yes |
| clientId | objectId | 500 | 0 | 0 | Yes |
| permission | string | 500 | 0 | 0 | No |
| userId | objectId | 500 | 0 | 0 | Yes |

Indexes:
- _id_: {"_id":1}

## comments

Documents: 1. Destination: BlogComment / LegacyOrphanRecord.

| Field path | Observed BSON types | Sample occurrences | Nulls | Empty strings | ObjectId candidate |
|---|---|---:|---:|---:|---|
| __v | number | 1 | 0 | 0 | No |
| _id | objectId | 1 | 0 | 0 | Yes |
| blogId | objectId | 1 | 0 | 0 | Yes |
| createdAt | date | 1 | 0 | 0 | No |
| text | string | 1 | 0 | 0 | No |
| user | string | 1 | 0 | 0 | No |

Indexes:
- _id_: {"_id":1}

## companysettings

Documents: 1. Destination: CompanySettings.

| Field path | Observed BSON types | Sample occurrences | Nulls | Empty strings | ObjectId candidate |
|---|---|---:|---:|---:|---|
| __v | number | 1 | 0 | 0 | No |
| _id | objectId | 1 | 0 | 0 | Yes |
| address | string | 1 | 0 | 1 | No |
| bankDetails | object | 1 | 0 | 0 | No |
| bankDetails.accountHolder | string | 1 | 0 | 1 | No |
| bankDetails.accountNumber | string | 1 | 0 | 1 | No |
| bankDetails.bankName | string | 1 | 0 | 1 | No |
| bankDetails.ifscCode | string | 1 | 0 | 1 | No |
| bankDetails.upiId | string | 1 | 0 | 1 | No |
| companyName | string | 1 | 0 | 0 | No |
| createdAt | date | 1 | 0 | 0 | No |
| gst | string | 1 | 0 | 1 | No |
| invoicePrefix | string | 1 | 0 | 0 | No |
| invoiceStart | number | 1 | 0 | 0 | No |
| key | string | 1 | 0 | 0 | No |
| pan | string | 1 | 0 | 1 | No |
| quotationPrefix | string | 1 | 0 | 0 | No |
| updatedAt | date | 1 | 0 | 0 | No |

Indexes:
- _id_: {"_id":1}
- key_1: {"key":1}; unique

## counters

Documents: 12. Destination: LegacyCounter.

| Field path | Observed BSON types | Sample occurrences | Nulls | Empty strings | ObjectId candidate |
|---|---|---:|---:|---:|---|
| __v | number | 12 | 0 | 0 | No |
| _id | objectId | 12 | 0 | 0 | Yes |
| role | string | 12 | 0 | 0 | No |
| seq | number | 12 | 0 | 0 | No |

Indexes:
- _id_: {"_id":1}
- role_1: {"role":1}; unique

## importhistories

Documents: 0. Destination: LeadImportJob / LeadImportRow.

| Field path | Observed BSON types | Sample occurrences | Nulls | Empty strings | ObjectId candidate |
|---|---|---:|---:|---:|---|

Indexes:
- _id_: {"_id":1}
- userId_1: {"userId":1}
- createdAt_-1: {"createdAt":-1}
- userId_1_createdAt_-1: {"userId":1,"createdAt":-1}

## products

Documents: 125. Destination: Product / ProductPrice.

| Field path | Observed BSON types | Sample occurrences | Nulls | Empty strings | ObjectId candidate |
|---|---|---:|---:|---:|---|
| __v | number | 125 | 0 | 0 | No |
| _id | objectId | 125 | 0 | 0 | Yes |
| additionalInfo | array | 39 | 0 | 0 | No |
| attributes | object | 39 | 0 | 0 | No |
| attributes.color | array | 39 | 0 | 0 | No |
| attributes.color[] | string | 1 | 0 | 0 | No |
| attributes.material | string | 1 | 0 | 1 | No |
| attributes.size | array | 39 | 0 | 0 | No |
| attributes.size[] | string | 5 | 0 | 0 | No |
| brand | string | 1 | 0 | 0 | No |
| cat_id | string | 125 | 0 | 0 | No |
| category | null | objectId | 39 | 38 | 0 | Yes |
| colour | array | 39 | 0 | 0 | No |
| colour[] | string | 1 | 0 | 0 | No |
| createdAt | date | 125 | 0 | 0 | No |
| createdBy | null | objectId | 58 | 39 | 0 | Yes |
| description | object | 76 | 0 | 0 | No |
| description.long | string | 76 | 0 | 0 | No |
| description.short | string | 1 | 0 | 0 | No |
| dimension | string | 125 | 0 | 93 | No |
| dimensions | object | 1 | 0 | 0 | No |
| dimensions.asString | string | 1 | 0 | 0 | No |
| dimensions.height | number | 1 | 0 | 0 | No |
| dimensions.length | number | 1 | 0 | 0 | No |
| dimensions.weight | null | 1 | 1 | 0 | No |
| dimensions.width | number | 1 | 0 | 0 | No |
| fabricType | string | 1 | 0 | 0 | No |
| GST_rate | number | 1 | 0 | 0 | No |
| GSTRate | number | 1 | 0 | 0 | No |
| HSN_code | string | 125 | 0 | 45 | No |
| images | array | 40 | 0 | 0 | No |
| images[] | object | 3 | 0 | 0 | No |
| images[]._id | objectId | 6 | 0 | 0 | Yes |
| images[].altText | string | 6 | 0 | 0 | No |
| images[].url | string | 6 | 0 | 0 | No |
| isActive | boolean | 39 | 0 | 0 | No |
| isDeleted | boolean | 39 | 0 | 0 | No |
| isFeatured | boolean | 39 | 0 | 0 | No |
| isPublished | boolean | 39 | 0 | 0 | No |
| keywords | array | 39 | 0 | 0 | No |
| keywords[] | string | 4 | 0 | 0 | No |
| metaDescription | string | 1 | 0 | 0 | No |
| metaTitle | string | 1 | 0 | 0 | No |
| name | string | 76 | 0 | 0 | No |
| origin | object | 39 | 0 | 0 | No |
| origin.categoryId | string | 1 | 0 | 0 | No |
| origin.productId | string | 1 | 0 | 0 | No |
| origin.source | string | 39 | 0 | 0 | No |
| origin.subcategoryId | string | 1 | 0 | 0 | No |
| p_code | string | 124 | 0 | 0 | No |
| p_color | string | 125 | 0 | 43 | No |
| p_description | string | 125 | 0 | 14 | No |
| p_image | null | string | 92 | 40 | 0 | No |
| p_name | string | 125 | 0 | 0 | No |
| p_price | object | 125 | 0 | 0 | No |
| p_price.basic_amount | number | 124 | 0 | 0 | No |
| p_price.currency | string | 8 | 0 | 0 | No |
| p_price.GST_rate | number | 124 | 0 | 0 | No |
| p_price.net_amount | number | 124 | 0 | 0 | No |
| p_price.price_code | string | 124 | 0 | 0 | No |
| p_price.purchase_price | number | 124 | 0 | 0 | No |
| p_price.salePrice | null | 8 | 8 | 0 | No |
| p_price.sales_100_above | number | 1 | 0 | 0 | No |
| p_price.sales_50_100 | number | 1 | 0 | 0 | No |
| p_type | string | 125 | 0 | 12 | No |
| price | null | number | 76 | 1 | 0 | No |
| productCode | string | 76 | 0 | 0 | No |
| quantity | number | 39 | 0 | 0 | No |
| ratings | object | 39 | 0 | 0 | No |
| ratings.average | number | 39 | 0 | 0 | No |
| ratings.count | number | 39 | 0 | 0 | No |
| s_code | string | 125 | 0 | 0 | No |
| salePrice | null | 39 | 39 | 0 | No |
| size | array | 39 | 0 | 0 | No |
| size[] | string | 5 | 0 | 0 | No |
| sku | string | 76 | 0 | 0 | No |
| SKU | string | 76 | 0 | 0 | No |
| slug | string | 76 | 0 | 0 | No |
| specifications | array | 39 | 0 | 0 | No |
| status | string | 19 | 0 | 0 | No |
| stock | number | 39 | 0 | 0 | No |
| subcategory | null | objectId | 39 | 38 | 0 | Yes |
| subImages | array | 39 | 0 | 0 | No |
| subImages[] | object | 4 | 0 | 0 | No |
| subImages[]._id | objectId | 8 | 0 | 0 | Yes |
| subImages[].altText | string | 8 | 0 | 8 | No |
| subImages[].url | string | 8 | 0 | 0 | No |
| tags | array | 39 | 0 | 0 | No |
| tags[] | string | 4 | 0 | 0 | No |
| updatedAt | date | 125 | 0 | 0 | No |
| updatedBy | null | objectId | 59 | 39 | 0 | Yes |

Indexes:
- _id_: {"_id":1}
- p_price.price_code_1: {"p_price.price_code":1}; unique
- p_code_1: {"p_code":1}; unique
- SKU_1: {"SKU":1}; unique; sparse
- sku_1: {"sku":1}; sparse
- slug_1: {"slug":1}
- cat_id_1_updatedAt_-1: {"cat_id":1,"updatedAt":-1}
- p_name_1: {"p_name":1}
- status_1: {"status":1}
- status_1_updatedAt_-1: {"status":1,"updatedAt":-1}
- Duplicate check cat_id: 6 groups / 121 sampled documents.
- File reference images: observed 40; local existing 0; local missing 0; remote 0; binary 0; unverifiable 40.
- File reference images[].url: observed 3; local existing 0; local missing 3; remote 0; binary 0; unverifiable 0.
- File reference p_image: observed 52; local existing 0; local missing 52; remote 0; binary 0; unverifiable 0.
- File reference subImages[].url: observed 4; local existing 0; local missing 4; remote 0; binary 0; unverifiable 0.

## quotations

Documents: 18. Destination: Quotation / QuotationItem.

| Field path | Observed BSON types | Sample occurrences | Nulls | Empty strings | ObjectId candidate |
|---|---|---:|---:|---:|---|
| __v | number | 18 | 0 | 0 | No |
| _id | objectId | 18 | 0 | 0 | Yes |
| bankDetails | object | 18 | 0 | 0 | No |
| bankDetails._id | objectId | 18 | 0 | 0 | Yes |
| bankDetails.accountHolder | string | 18 | 0 | 0 | No |
| bankDetails.accountNumber | string | 18 | 0 | 0 | No |
| bankDetails.bankName | string | 18 | 0 | 0 | No |
| bankDetails.ifscCode | string | 18 | 0 | 0 | No |
| bankDetails.upiId | string | 18 | 0 | 0 | No |
| createdAt | date | 18 | 0 | 0 | No |
| invoiceDetails | object | 18 | 0 | 0 | No |
| invoiceDetails._id | objectId | 18 | 0 | 0 | Yes |
| invoiceDetails.date | date | 18 | 0 | 0 | No |
| invoiceDetails.number | string | 18 | 0 | 0 | No |
| invoiceDetails.placeOfSupply | string | 18 | 0 | 0 | No |
| invoiceDetails.poNo | string | 18 | 0 | 18 | No |
| invoiceDetails.prefix | string | 18 | 0 | 0 | No |
| invoiceDetails.validityDate | date | 18 | 0 | 0 | No |
| invoiceDetails.validityDays | number | 18 | 0 | 0 | No |
| items | array | 18 | 0 | 0 | No |
| items[] | object | 32 | 0 | 0 | No |
| items[]._id | objectId | 64 | 0 | 0 | Yes |
| items[].discount | number | 64 | 0 | 0 | No |
| items[].hsn | string | 52 | 0 | 2 | No |
| items[].name | string | 64 | 0 | 0 | No |
| items[].price | number | 64 | 0 | 0 | No |
| items[].qty | number | 64 | 0 | 0 | No |
| items[].tax | number | 64 | 0 | 0 | No |
| notes | string | 18 | 0 | 18 | No |
| party | object | 18 | 0 | 0 | No |
| party._id | objectId | 18 | 0 | 0 | Yes |
| party.billToAddress | string | 18 | 0 | 3 | No |
| party.company | string | 18 | 0 | 0 | No |
| party.name | string | 18 | 0 | 0 | No |
| party.pan | string | 18 | 0 | 0 | No |
| party.phone | string | 18 | 0 | 0 | No |
| party.selectedShippingAddress | object | 18 | 0 | 0 | No |
| party.selectedShippingAddress._id | objectId | 18 | 0 | 0 | Yes |
| party.selectedShippingAddress.address | string | 18 | 0 | 3 | No |
| party.selectedShippingAddress.name | string | 18 | 0 | 0 | No |
| party.selectedShippingAddress.state | string | 18 | 0 | 0 | No |
| party.shippingAddresses | array | 18 | 0 | 0 | No |
| party.shippingAddresses[] | object | 18 | 0 | 0 | No |
| party.shippingAddresses[]._id | objectId | 36 | 0 | 0 | Yes |
| party.shippingAddresses[].address | string | 36 | 0 | 6 | No |
| party.shippingAddresses[].name | string | 36 | 0 | 0 | No |
| party.shippingAddresses[].state | string | 36 | 0 | 0 | No |
| party.state | string | 18 | 0 | 0 | No |
| summary | object | 18 | 0 | 0 | No |
| summary._id | objectId | 18 | 0 | 0 | Yes |
| summary.additionalCharges | number | 18 | 0 | 0 | No |
| summary.amountReceived | number | 18 | 0 | 0 | No |
| summary.applyTCS | boolean | 18 | 0 | 0 | No |
| summary.autoRoundOff | boolean | 18 | 0 | 0 | No |
| summary.discount | number | 18 | 0 | 0 | No |
| summary.discountType | string | 18 | 0 | 0 | No |
| summary.paymentMethod | string | 18 | 0 | 0 | No |
| summary.roundOffAmount | number | 18 | 0 | 0 | No |
| summary.roundOffSign | string | 18 | 0 | 0 | No |
| terms | string | 18 | 0 | 0 | No |
| updatedAt | date | 18 | 0 | 0 | No |
| user | objectId | 18 | 0 | 0 | Yes |

Indexes:
- _id_: {"_id":1}
- user_1_createdAt_-1: {"user":1,"createdAt":-1}
- createdAt_-1: {"createdAt":-1}

## users

Documents: 11. Destination: User.

| Field path | Observed BSON types | Sample occurrences | Nulls | Empty strings | ObjectId candidate |
|---|---|---:|---:|---:|---|
| __v | number | 11 | 0 | 0 | No |
| _id | objectId | 11 | 0 | 0 | Yes |
| email | string | 11 | 0 | 0 | No |
| enabled | boolean | 11 | 0 | 0 | No |
| location | string | 5 | 0 | 0 | No |
| name | string | 11 | 0 | 0 | No |
| password | string | 11 | 0 | 0 | No |
| role | string | 11 | 0 | 0 | No |
| userId | string | 11 | 0 | 0 | No |
| username | string | 11 | 0 | 0 | No |

Indexes:
- _id_: {"_id":1}
- username_1: {"username":1}; unique
- email_1: {"email":1}
- role_1_enabled_1: {"role":1,"enabled":1}

## vendoractivities

Documents: 0. Destination: VendorActivity.

| Field path | Observed BSON types | Sample occurrences | Nulls | Empty strings | ObjectId candidate |
|---|---|---:|---:|---:|---|

Indexes:
- _id_: {"_id":1}
- vendor_1_createdAt_-1: {"vendor":1,"createdAt":-1}
- dueDate_1_completedAt_1: {"dueDate":1,"completedAt":1}

## vendorcategories

Documents: 0. Destination: VendorCategory.

| Field path | Observed BSON types | Sample occurrences | Nulls | Empty strings | ObjectId candidate |
|---|---|---:|---:|---:|---|

Indexes:
- _id_: {"_id":1}
- code_1: {"code":1}; unique
- nameNorm_1: {"nameNorm":1}; unique

## vendordocuments

Documents: 0. Destination: VendorDocument.

| Field path | Observed BSON types | Sample occurrences | Nulls | Empty strings | ObjectId candidate |
|---|---|---:|---:|---:|---|

Indexes:
- _id_: {"_id":1}
- vendor_1_status_1_createdAt_-1: {"vendor":1,"status":1,"createdAt":-1}
- expiryDate_1_status_1: {"expiryDate":1,"status":1}

## vendorevaluations

Documents: 0. Destination: VendorEvaluation.

| Field path | Observed BSON types | Sample occurrences | Nulls | Empty strings | ObjectId candidate |
|---|---|---:|---:|---:|---|

Indexes:
- _id_: {"_id":1}
- vendor_1_evaluationDate_-1: {"vendor":1,"evaluationDate":-1}

## vendorimportjobs

Documents: 0. Destination: VendorImportJob / VendorImportRow.

| Field path | Observed BSON types | Sample occurrences | Nulls | Empty strings | ObjectId candidate |
|---|---|---:|---:|---:|---|

Indexes:
- _id_: {"_id":1}
- userId_1: {"userId":1}
- createdAt_-1: {"createdAt":-1}

## vendorproducts

Documents: 0. Destination: VendorProduct / VendorPriceTier.

| Field path | Observed BSON types | Sample occurrences | Nulls | Empty strings | ObjectId candidate |
|---|---|---:|---:|---:|---|

Indexes:
- _id_: {"_id":1}
- vendor_1_isActive_1_effectiveFrom_-1: {"vendor":1,"isActive":1,"effectiveFrom":-1}
- product_1_isActive_1: {"product":1,"isActive":1}
- vendor_1_product_1_effectiveFrom_1: {"vendor":1,"product":1,"effectiveFrom":1}

## vendors

Documents: 3. Destination: Vendor / VendorContact / VendorAddress.

| Field path | Observed BSON types | Sample occurrences | Nulls | Empty strings | ObjectId candidate |
|---|---|---:|---:|---:|---|
| __v | number | 3 | 0 | 0 | No |
| _id | objectId | 3 | 0 | 0 | Yes |
| addr1 | string | 3 | 0 | 2 | No |
| addr2 | string | 3 | 0 | 2 | No |
| cat_id | string | 3 | 0 | 2 | No |
| city | string | 3 | 0 | 2 | No |
| contact_name | string | 3 | 0 | 1 | No |
| email | string | 3 | 0 | 3 | No |
| name | string | 3 | 0 | 0 | No |
| phone | string | 3 | 0 | 2 | No |
| pin_code | string | 3 | 0 | 1 | No |
| products | array | 3 | 0 | 0 | No |
| products[] | string | 3 | 0 | 2 | No |
| state | string | 3 | 0 | 2 | No |
| type | string | 3 | 0 | 1 | No |
| v_code | string | 3 | 0 | 0 | No |

Indexes:
- _id_: {"_id":1}
- v_code_1: {"v_code":1}; unique
- nameNorm_1: {"nameNorm":1}
- gstinNorm_1: {"gstinNorm":1}
- panNorm_1: {"panNorm":1}
- emailNorm_1: {"emailNorm":1}
- phoneNorm_1: {"phoneNorm":1}
- isArchived_1_status_1_createdAt_-1: {"isArchived":1,"status":1,"createdAt":-1}
- isArchived_1_category_1: {"isArchived":1,"category":1}
- isArchived_1_owner_1: {"isArchived":1,"owner":1}

## visitors

Documents: 408. Destination: VisitorDay / VisitorEvent.

| Field path | Observed BSON types | Sample occurrences | Nulls | Empty strings | ObjectId candidate |
|---|---|---:|---:|---:|---|
| __v | number | 408 | 0 | 0 | No |
| _id | objectId | 408 | 0 | 0 | Yes |
| count | number | 408 | 0 | 0 | No |
| date | string | 408 | 0 | 0 | No |
| visitors | array | 408 | 0 | 0 | No |
| visitors[] | object | 1645 | 0 | 0 | No |
| visitors[]._id | objectId | 3290 | 0 | 0 | Yes |
| visitors[].city | string | 3290 | 0 | 0 | No |
| visitors[].device | string | 3290 | 0 | 0 | No |
| visitors[].ip | string | 3290 | 0 | 0 | No |
| visitors[].region | string | 3290 | 0 | 0 | No |
| visitors[].timestamp | date | 3290 | 0 | 0 | No |

Indexes:
- _id_: {"_id":1}
- date_1: {"date":1}; unique

## Interpretation limits

Field occurrence counts describe bounded sampled occurrences, not business-record totals for nested arrays. Document counts and index metadata are exact at scan time. A final inventory/delta scan is required immediately before cutover.
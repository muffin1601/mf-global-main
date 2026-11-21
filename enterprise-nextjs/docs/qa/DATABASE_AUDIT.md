# Database audit

All service tests use a disposable PostgreSQL instance. The browser uses a separate local crm_e2e instance. Seven migrations were present after the phone identity change. The new migration was verified against the populated local fixture.

**Release blocker DB-DEL.** The 20261120145700 migration deletes every USER and their quotations. A fresh-install migration test does not exercise this on populated data. Production execution history, verified recovery point, backup restoration and row reconciliation remain open. Do not apply this migration chain to production pending reconciliation. The audit did not edit historical migrations.

## Prisma relationships

| Model | Related fields |
|---|---|
| User | createdLeads Lead[] @relation("LeadCreator")<br>assignments LeadAssignment[]<br>activities ActivityLog[]<br>quotations Quotation[]<br>importJobs LeadImportJob[]<br>vendorImportJobs VendorImportJob[]<br>ownedVendors Vendor[] @relation("VendorOwner")<br>createdVendors Vendor[] @relation("VendorCreator")<br>vendorActivities VendorActivity[]<br>vendorDocuments VendorDocument[]<br>vendorEvaluations VendorEvaluation[]<br>leadPermissions LeadPermission[]<br>assignmentEvents LeadAssignmentEvent[] @relation("AssignmentEventUser")<br>assignmentActions LeadAssignmentEvent[] @relation("AssignmentEventActor")<br>createdActivities Activity[] @relation("ActivityCreator")<br>assignedActivities Activity[] @relation("ActivityAssignee")<br>completedActivities Activity[] @relation("ActivityCompleter")<br>activityComments ActivityComment[]<br>savedViews SavedView[] |
| UserSequence |  |
| Lead | tags String[] @default([])<br>createdBy User? @relation("LeadCreator", fields: [createdById], references: [id], onDelete: SetNull)<br>assignments LeadAssignment[]<br>permissions LeadPermission[]<br>importRows LeadImportRow[]<br>importJob LeadImportJob? @relation("ImportedLeads", fields: [importJobId], references: [id], onDelete: SetNull)<br>statusHistory LeadStatusHistory[]<br>assignmentEvents LeadAssignmentEvent[]<br>activities Activity[] |
| LeadAssignment | lead Lead @relation(fields: [leadId], references: [id], onDelete: Cascade)<br>user User @relation(fields: [userId], references: [id], onDelete: Cascade) |
| LeadPermission | lead Lead @relation(fields: [leadId], references: [id], onDelete: Cascade)<br>user User @relation(fields: [userId], references: [id], onDelete: Cascade) |
| LeadImportJob | user User? @relation(fields: [userId], references: [id], onDelete: SetNull)<br>rows LeadImportRow[]<br>leads Lead[] @relation("ImportedLeads") |
| LeadImportRow | job LeadImportJob @relation(fields: [jobId], references: [id], onDelete: Cascade)<br>lead Lead? @relation(fields: [leadId], references: [id], onDelete: SetNull) |
| Category | products Product[] |
| Product | category Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)<br>vendorProducts VendorProduct[] |
| ProductPrice | product Product @relation(fields: [productId], references: [id], onDelete: Cascade) |
| Quotation | user User @relation(fields: [userId], references: [id], onDelete: Restrict)<br>items QuotationItem[] |
| QuotationItem | quotation Quotation @relation(fields: [quotationId], references: [id], onDelete: Cascade) |
| VendorCategory | vendors Vendor[] |
| Vendor | tags String[]<br>category VendorCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)<br>owner User? @relation("VendorOwner", fields: [ownerId], references: [id], onDelete: SetNull)<br>createdBy User? @relation("VendorCreator", fields: [createdById], references: [id], onDelete: SetNull)<br>contacts VendorContact[]<br>addresses VendorAddress[]<br>products VendorProduct[]<br>activities VendorActivity[]<br>documents VendorDocument[]<br>evaluations VendorEvaluation[] |
| VendorContact | vendor Vendor @relation(fields: [vendorId], references: [id], onDelete: Cascade) |
| VendorAddress | vendor Vendor @relation(fields: [vendorId], references: [id], onDelete: Cascade) |
| VendorProduct | vendor Vendor @relation(fields: [vendorId], references: [id], onDelete: Cascade)<br>product Product @relation(fields: [productId], references: [id], onDelete: Restrict)<br>priceTiers VendorPriceTier[] |
| VendorPriceTier | vendorProduct VendorProduct @relation(fields: [vendorProductId], references: [id], onDelete: Cascade) |
| VendorActivity | vendor Vendor @relation(fields: [vendorId], references: [id], onDelete: Cascade)<br>createdBy User? @relation(fields: [createdById], references: [id], onDelete: SetNull) |
| VendorDocument | vendor Vendor @relation(fields: [vendorId], references: [id], onDelete: Cascade)<br>uploadedBy User? @relation(fields: [uploadedById], references: [id], onDelete: SetNull) |
| VendorEvaluation | vendor Vendor @relation(fields: [vendorId], references: [id], onDelete: Cascade)<br>evaluatedBy User? @relation(fields: [evaluatedById], references: [id], onDelete: SetNull) |
| VendorImportJob | headers String[]<br>user User? @relation(fields: [userId], references: [id], onDelete: SetNull)<br>rows VendorImportRow[] |
| VendorImportRow | job VendorImportJob @relation(fields: [jobId], references: [id], onDelete: Cascade) |
| BlogPost | comments BlogComment[] |
| BlogComment | blog BlogPost @relation(fields: [blogId], references: [id], onDelete: Cascade) |
| CareerJob | applications CareerApplication[] |
| CareerApplication | job CareerJob @relation(fields: [jobId], references: [id], onDelete: Restrict) |
| CareerAdminSetting |  |
| CareerAdminSession |  |
| CareerLoginAttempt |  |
| ContactSubmission |  |
| VisitorDay | visitors VisitorEvent[] |
| VisitorEvent | day VisitorDay @relation(fields: [dayId], references: [id], onDelete: Cascade) |
| ActivityLog | user User? @relation(fields: [userId], references: [id], onDelete: SetNull) |
| CompanySettings |  |
| LegacyCounter |  |
| MigrationCheckpoint |  |
| LegacyClientPermission |  |
| LegacyOrphanRecord |  |
| LeadStatusHistory | lead Lead @relation(fields: [leadId], references: [id], onDelete: Cascade) |
| IntegrationRun |  |
| RateLimitBucket |  |
| InvoiceCounter |  |
| LeadAssignmentEvent | lead Lead @relation(fields: [leadId], references: [id], onDelete: Cascade)<br>user User? @relation("AssignmentEventUser", fields: [userId], references: [id], onDelete: SetNull)<br>actor User? @relation("AssignmentEventActor", fields: [actorId], references: [id], onDelete: SetNull) |
| Activity | lead Lead? @relation(fields: [leadId], references: [id], onDelete: Cascade)<br>createdBy User? @relation("ActivityCreator", fields: [createdById], references: [id], onDelete: SetNull)<br>assignee User? @relation("ActivityAssignee", fields: [assigneeId], references: [id], onDelete: SetNull)<br>completedBy User? @relation("ActivityCompleter", fields: [completedById], references: [id], onDelete: SetNull)<br>comments ActivityComment[] |
| ActivityComment | activity Activity @relation(fields: [activityId], references: [id], onDelete: Cascade)<br>author User? @relation(fields: [authorId], references: [id], onDelete: SetNull) |
| SavedView | user User @relation(fields: [userId], references: [id], onDelete: Cascade) |

## Physical constraints and indexes

See [the Prisma schema](../../prisma/schema.prisma) and [migration SQL](../../prisma/migrations). The functional phone and contact indexes use the same canonical key as manual and import checks. They are nonunique so historical duplicates can be preserved and reconciled. Index creation time and write locking need a staging-sized rehearsal.

Legacy Mongoose models retained for comparison are blog, CareerApplication, CareerJob, CareerLoginAttempt, CareerSession, CareerSettings, Category, ClientData, ClientPermission, CoachingProduct, comment, Counter, ImportHistory, PrintkeeCategory, ProductData, Quote, Tasks, User, UserActivity, UserPerformance, VendorActivity, VendorCategory, VendorData, VendorDocument, VendorEvaluation, VendorImportJob, VendorProduct, Visitor.

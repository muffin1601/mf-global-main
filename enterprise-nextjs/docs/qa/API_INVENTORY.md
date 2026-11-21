# API inventory

| Path | Method | Handler |
|---|---|---|
| /api/activity/log | POST | [src/app/api/activity/log/route.ts](../../src/app/api/activity/log/route.ts) |
| /api/blogs/comments | POST | [src/app/api/blogs/comments/route.ts](../../src/app/api/blogs/comments/route.ts) |
| /api/blogs/comments/[blogId] | GET | [src/app/api/blogs/comments/[blogId]/route.ts](../../src/app/api/blogs/comments/[blogId]/route.ts) |
| /api/blogs/post-blogs | POST | [src/app/api/blogs/post-blogs/route.ts](../../src/app/api/blogs/post-blogs/route.ts) |
| /api/blogs | GET | [src/app/api/blogs/route.ts](../../src/app/api/blogs/route.ts) |
| /api/blogs/[id] | GET | [src/app/api/blogs/[id]/route.ts](../../src/app/api/blogs/[id]/route.ts) |
| /api/careers/admin/applications | GET | [src/app/api/careers/admin/applications/route.ts](../../src/app/api/careers/admin/applications/route.ts) |
| /api/careers/admin/applications/[id]/resume | GET | [src/app/api/careers/admin/applications/[id]/resume/route.ts](../../src/app/api/careers/admin/applications/[id]/resume/route.ts) |
| /api/careers/admin/applications/[id] | GET | [src/app/api/careers/admin/applications/[id]/route.ts](../../src/app/api/careers/admin/applications/[id]/route.ts) |
| /api/careers/admin/applications/[id] | PATCH | [src/app/api/careers/admin/applications/[id]/route.ts](../../src/app/api/careers/admin/applications/[id]/route.ts) |
| /api/careers/admin/applications/[id] | DELETE | [src/app/api/careers/admin/applications/[id]/route.ts](../../src/app/api/careers/admin/applications/[id]/route.ts) |
| /api/careers/admin/change-pin | POST | [src/app/api/careers/admin/change-pin/route.ts](../../src/app/api/careers/admin/change-pin/route.ts) |
| /api/careers/admin/csrf | POST | [src/app/api/careers/admin/csrf/route.ts](../../src/app/api/careers/admin/csrf/route.ts) |
| /api/careers/admin/export | GET | [src/app/api/careers/admin/export/route.ts](../../src/app/api/careers/admin/export/route.ts) |
| /api/careers/admin/jobs | GET | [src/app/api/careers/admin/jobs/route.ts](../../src/app/api/careers/admin/jobs/route.ts) |
| /api/careers/admin/jobs | POST | [src/app/api/careers/admin/jobs/route.ts](../../src/app/api/careers/admin/jobs/route.ts) |
| /api/careers/admin/jobs/[id] | PUT | [src/app/api/careers/admin/jobs/[id]/route.ts](../../src/app/api/careers/admin/jobs/[id]/route.ts) |
| /api/careers/admin/jobs/[id] | DELETE | [src/app/api/careers/admin/jobs/[id]/route.ts](../../src/app/api/careers/admin/jobs/[id]/route.ts) |
| /api/careers/admin/login | POST | [src/app/api/careers/admin/login/route.ts](../../src/app/api/careers/admin/login/route.ts) |
| /api/careers/admin/logout | POST | [src/app/api/careers/admin/logout/route.ts](../../src/app/api/careers/admin/logout/route.ts) |
| /api/careers/admin/session | GET | [src/app/api/careers/admin/session/route.ts](../../src/app/api/careers/admin/session/route.ts) |
| /api/careers/admin/stats | GET | [src/app/api/careers/admin/stats/route.ts](../../src/app/api/careers/admin/stats/route.ts) |
| /api/careers/apply | POST | [src/app/api/careers/apply/route.ts](../../src/app/api/careers/apply/route.ts) |
| /api/careers/jobs | GET | [src/app/api/careers/jobs/route.ts](../../src/app/api/careers/jobs/route.ts) |
| /api/careers/jobs/[id] | GET | [src/app/api/careers/jobs/[id]/route.ts](../../src/app/api/careers/jobs/[id]/route.ts) |
| /api/categories | GET | [src/app/api/categories/route.ts](../../src/app/api/categories/route.ts) |
| /api/categories | POST | [src/app/api/categories/route.ts](../../src/app/api/categories/route.ts) |
| /api/categories/[id] | PUT | [src/app/api/categories/[id]/route.ts](../../src/app/api/categories/[id]/route.ts) |
| /api/categories/[id] | DELETE | [src/app/api/categories/[id]/route.ts](../../src/app/api/categories/[id]/route.ts) |
| /api/coachinpromo/capture-lead | POST | [src/app/api/coachinpromo/capture-lead/route.ts](../../src/app/api/coachinpromo/capture-lead/route.ts) |
| /api/contact | POST | [src/app/api/contact/route.ts](../../src/app/api/contact/route.ts) |
| /api/cron/tradeindia | GET | [src/app/api/cron/tradeindia/route.ts](../../src/app/api/cron/tradeindia/route.ts) |
| /api/giftaguru/capture-lead | POST | [src/app/api/giftaguru/capture-lead/route.ts](../../src/app/api/giftaguru/capture-lead/route.ts) |
| /api/health | GET | [src/app/api/health/route.ts](../../src/app/api/health/route.ts) |
| /api/lead-import/check | POST | [src/app/api/lead-import/check/route.ts](../../src/app/api/lead-import/check/route.ts) |
| /api/lead-import/history | GET | [src/app/api/lead-import/history/route.ts](../../src/app/api/lead-import/history/route.ts) |
| /api/lead-import/jobs | POST | [src/app/api/lead-import/jobs/route.ts](../../src/app/api/lead-import/jobs/route.ts) |
| /api/lead-import/jobs/[id]/batch | POST | [src/app/api/lead-import/jobs/[id]/batch/route.ts](../../src/app/api/lead-import/jobs/[id]/batch/route.ts) |
| /api/lead-import/report/[id] | GET | [src/app/api/lead-import/report/[id]/route.ts](../../src/app/api/lead-import/report/[id]/route.ts) |
| /api/lead-import/sample | GET | [src/app/api/lead-import/sample/route.ts](../../src/app/api/lead-import/sample/route.ts) |
| /api/leads/export | GET | [src/app/api/leads/export/route.ts](../../src/app/api/leads/export/route.ts) |
| /api/printkee/capture-lead | POST | [src/app/api/printkee/capture-lead/route.ts](../../src/app/api/printkee/capture-lead/route.ts) |
| /api/products/code-preview | GET | [src/app/api/products/code-preview/route.ts](../../src/app/api/products/code-preview/route.ts) |
| /api/products | GET | [src/app/api/products/route.ts](../../src/app/api/products/route.ts) |
| /api/products | POST | [src/app/api/products/route.ts](../../src/app/api/products/route.ts) |
| /api/products/search | GET | [src/app/api/products/search/route.ts](../../src/app/api/products/search/route.ts) |
| /api/products/[id] | GET | [src/app/api/products/[id]/route.ts](../../src/app/api/products/[id]/route.ts) |
| /api/products/[id] | PUT | [src/app/api/products/[id]/route.ts](../../src/app/api/products/[id]/route.ts) |
| /api/products/[id] | DELETE | [src/app/api/products/[id]/route.ts](../../src/app/api/products/[id]/route.ts) |
| /api/quotations/clients | GET | [src/app/api/quotations/clients/route.ts](../../src/app/api/quotations/clients/route.ts) |
| /api/quotations/[id]/pdf | GET | [src/app/api/quotations/[id]/pdf/route.ts](../../src/app/api/quotations/[id]/pdf/route.ts) |
| /api/reports/lead-insertion/export | GET | [src/app/api/reports/lead-insertion/export/route.ts](../../src/app/api/reports/lead-insertion/export/route.ts) |
| /api/search | GET | [src/app/api/search/route.ts](../../src/app/api/search/route.ts) |
| /api/send-email | POST | [src/app/api/send-email/route.ts](../../src/app/api/send-email/route.ts) |
| /api/vendors/export | GET | [src/app/api/vendors/export/route.ts](../../src/app/api/vendors/export/route.ts) |
| /api/vendors/import/template | GET | [src/app/api/vendors/import/template/route.ts](../../src/app/api/vendors/import/template/route.ts) |
| /api/vendors/import/upload | POST | [src/app/api/vendors/import/upload/route.ts](../../src/app/api/vendors/import/upload/route.ts) |
| /api/vendors/import/[jobId]/report | GET | [src/app/api/vendors/import/[jobId]/report/route.ts](../../src/app/api/vendors/import/[jobId]/report/route.ts) |
| /api/vendors | GET | [src/app/api/vendors/route.ts](../../src/app/api/vendors/route.ts) |
| /api/vendors/[id]/audit | GET | [src/app/api/vendors/[id]/audit/route.ts](../../src/app/api/vendors/[id]/audit/route.ts) |
| /api/vendors/[id]/documents | GET | [src/app/api/vendors/[id]/documents/route.ts](../../src/app/api/vendors/[id]/documents/route.ts) |
| /api/vendors/[id]/documents | POST | [src/app/api/vendors/[id]/documents/route.ts](../../src/app/api/vendors/[id]/documents/route.ts) |
| /api/vendors/[id]/documents/[docId]/file | GET | [src/app/api/vendors/[id]/documents/[docId]/file/route.ts](../../src/app/api/vendors/[id]/documents/[docId]/file/route.ts) |
| /api/vendors/[id]/documents/[docId]/file | PUT | [src/app/api/vendors/[id]/documents/[docId]/file/route.ts](../../src/app/api/vendors/[id]/documents/[docId]/file/route.ts) |
| /auth/callback | GET | [src/app/auth/callback/route.ts](../../src/app/auth/callback/route.ts) |
| /auth/signout | POST | [src/app/auth/signout/route.ts](../../src/app/auth/signout/route.ts) |

## Server actions

| Module | Export |
|---|---|
| [src/app/(auth)/crm/login/actions.ts](../../src/app/%28auth%29/crm/login/actions.ts) | loginAction |
| [src/app/(crm)/crm/activities/actions.ts](../../src/app/%28crm%29/crm/activities/actions.ts) | createActivityAction |
| [src/app/(crm)/crm/activities/actions.ts](../../src/app/%28crm%29/crm/activities/actions.ts) | updateActivityAction |
| [src/app/(crm)/crm/activities/actions.ts](../../src/app/%28crm%29/crm/activities/actions.ts) | completeActivityAction |
| [src/app/(crm)/crm/activities/actions.ts](../../src/app/%28crm%29/crm/activities/actions.ts) | reopenActivityAction |
| [src/app/(crm)/crm/activities/actions.ts](../../src/app/%28crm%29/crm/activities/actions.ts) | cancelActivityAction |
| [src/app/(crm)/crm/activities/actions.ts](../../src/app/%28crm%29/crm/activities/actions.ts) | deleteActivityAction |
| [src/app/(crm)/crm/activities/actions.ts](../../src/app/%28crm%29/crm/activities/actions.ts) | commentActivityAction |
| [src/app/(crm)/crm/lead-management/actions.ts](../../src/app/%28crm%29/crm/lead-management/actions.ts) | createLeadAction |
| [src/app/(crm)/crm/lead-management/actions.ts](../../src/app/%28crm%29/crm/lead-management/actions.ts) | updateLeadAction |
| [src/app/(crm)/crm/lead-management/actions.ts](../../src/app/%28crm%29/crm/lead-management/actions.ts) | checkDuplicateAction |
| [src/app/(crm)/crm/lead-management/actions.ts](../../src/app/%28crm%29/crm/lead-management/actions.ts) | getLeadDetailAction |
| [src/app/(crm)/crm/lead-management/actions.ts](../../src/app/%28crm%29/crm/lead-management/actions.ts) | addContactAction |
| [src/app/(crm)/crm/lead-management/actions.ts](../../src/app/%28crm%29/crm/lead-management/actions.ts) | deleteContactAction |
| [src/app/(crm)/crm/lead-management/actions.ts](../../src/app/%28crm%29/crm/lead-management/actions.ts) | deleteLeadsAction |
| [src/app/(crm)/crm/lead-management/actions.ts](../../src/app/%28crm%29/crm/lead-management/actions.ts) | deleteAllFilteredAction |
| [src/app/(crm)/crm/lead-management/actions.ts](../../src/app/%28crm%29/crm/lead-management/actions.ts) | bulkUpdateAction |
| [src/app/(crm)/crm/lead-management/actions.ts](../../src/app/%28crm%29/crm/lead-management/actions.ts) | assignLeadsAction |
| [src/app/(crm)/crm/lead-management/actions.ts](../../src/app/%28crm%29/crm/lead-management/actions.ts) | removeAssignmentsAction |
| [src/app/(crm)/crm/lead-management/actions.ts](../../src/app/%28crm%29/crm/lead-management/actions.ts) | transferAssignmentsAction |
| [src/app/(crm)/crm/lead-management/actions.ts](../../src/app/%28crm%29/crm/lead-management/actions.ts) | bulkSetFieldsAction |
| [src/app/(crm)/crm/quotations/actions.ts](../../src/app/%28crm%29/crm/quotations/actions.ts) | saveQuotationAction |
| [src/app/(crm)/crm/quotations/actions.ts](../../src/app/%28crm%29/crm/quotations/actions.ts) | deleteQuotationAction |
| [src/app/(crm)/crm/user-management/actions.ts](../../src/app/%28crm%29/crm/user-management/actions.ts) | createUserAction |
| [src/app/(crm)/crm/user-management/actions.ts](../../src/app/%28crm%29/crm/user-management/actions.ts) | toggleUserAction |
| [src/app/(crm)/crm/user-management/actions.ts](../../src/app/%28crm%29/crm/user-management/actions.ts) | changePasswordAction |
| [src/app/(crm)/crm/user-management/actions.ts](../../src/app/%28crm%29/crm/user-management/actions.ts) | updateUserAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | createVendorAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | updateVendorAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | checkDuplicatesAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | setStatusAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | changeStatusAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | bulkStatusAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | archiveAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | restoreAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | bulkArchiveAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | deleteVendorAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | addContactAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | updateContactAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | primaryContactAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | deleteContactAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | addAddressAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | updateAddressAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | primaryAddressAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | deleteAddressAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | addProductAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | updateProductAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | deleteProductAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | addActivityAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | updateActivityAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | deleteActivityAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | addEvaluationAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | deleteEvaluationAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | updateDocumentAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | archiveDocumentAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | deleteDocumentAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | createCategoryAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | updateCategoryAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | deleteCategoryAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | validateImportAction |
| [src/app/(crm)/crm/vendors/actions.ts](../../src/app/%28crm%29/crm/vendors/actions.ts) | commitImportAction |
| [src/app/(crm)/crm/views-actions.ts](../../src/app/%28crm%29/crm/views-actions.ts) | saveViewAction |
| [src/app/(crm)/crm/views-actions.ts](../../src/app/%28crm%29/crm/views-actions.ts) | deleteViewAction |

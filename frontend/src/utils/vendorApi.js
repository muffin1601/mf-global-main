// Vendor Management API client.
//
// Wraps axios (which already attaches the bearer token via the interceptor in
// main.jsx) and normalises every failure into a single shape, so screens never
// have to unpick axios error objects or show a raw server string to the user.

import axios from 'axios';

const BASE = `${import.meta.env.VITE_API_URL}/vendor-management`;

// A failure the UI can render directly.
export class VendorApiError extends Error {
  constructor(message, { status = 0, errors = [], data = {} } = {}) {
    super(message);
    this.name = 'VendorApiError';
    this.status = status;
    this.errors = errors;
    this.data = data;
  }
}

// Turn any axios rejection into a VendorApiError carrying a sentence a
// non-technical user can act on.
const toVendorError = (error) => {
  if (axios.isCancel?.(error) || error?.code === 'ERR_CANCELED') {
    const cancelled = new VendorApiError('Request cancelled', { status: 0 });
    cancelled.cancelled = true;
    return cancelled;
  }

  const status = error?.response?.status ?? 0;
  const data = error?.response?.data ?? {};

  if (!error?.response) {
    return new VendorApiError(
      'Cannot reach the server. Check your connection and try again.',
      { status: 0 }
    );
  }

  const fallbacks = {
    400: 'Some of the information provided is not valid.',
    401: 'Your session has expired. Please sign in again.',
    403: 'You do not have permission to perform this action.',
    404: 'That record could not be found. It may have been deleted.',
    409: 'This conflicts with an existing record.',
    410: 'That upload is no longer available. Please try again.',
    413: 'That file is too large.',
    415: 'That file type is not supported.',
    429: 'Too many requests. Please wait a moment and try again.',
    500: 'Something went wrong on the server. Please try again.',
    503: 'The service is temporarily unavailable. Please try again shortly.',
  };

  const message = data.message || fallbacks[status] || 'Something went wrong. Please try again.';

  return new VendorApiError(message, { status, errors: data.errors || [], data });
};

const request = async (config) => {
  try {
    const res = await axios({ ...config, url: `${BASE}${config.url}` });
    return res.data;
  } catch (error) {
    throw toVendorError(error);
  }
};

// A 401 means the token has expired or been revoked. Clear the stale session so
// the app's route guards send the user back to the login screen rather than
// leaving them on a permanently failing page.
export const handleExpiredSession = (error) => {
  if (error?.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.assign('/crm/login');
    return true;
  }
  return false;
};

// Drop empty filter values so the query string stays clean and the backend
// treats "not set" and "" identically.
const toParams = (filters = {}) => {
  const params = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      if (!value.length) return;
      params[key] = value.join(',');
      return;
    }
    params[key] = value;
  });
  return params;
};

export const vendorApi = {
  // --- Reference data & dashboard ---
  meta: () => request({ method: 'get', url: '/vendors/meta' }),
  summary: () => request({ method: 'get', url: '/vendors/summary' }),

  // --- Vendors ---
  list: (filters = {}, { signal } = {}) =>
    request({ method: 'get', url: '/vendors', params: toParams(filters), signal }),
  get: (id) => request({ method: 'get', url: `/vendors/${id}` }),
  create: (payload) => request({ method: 'post', url: '/vendors', data: payload }),
  update: (id, payload) => request({ method: 'put', url: `/vendors/${id}`, data: payload }),
  checkDuplicates: (payload, { signal } = {}) =>
    request({ method: 'post', url: '/vendors/check-duplicates', data: payload, signal }),
  setStatus: (id, status, reason) =>
    request({ method: 'patch', url: `/vendors/${id}/status`, data: { status, reason } }),
  archive: (id, reason) => request({ method: 'patch', url: `/vendors/${id}/archive`, data: { reason } }),
  restore: (id) => request({ method: 'patch', url: `/vendors/${id}/restore` }),
  remove: (id, confirmCode) =>
    request({ method: 'delete', url: `/vendors/${id}`, data: { confirmCode } }),
  bulkStatus: (ids, status) =>
    request({ method: 'patch', url: '/vendors/bulk/status', data: { ids, status } }),
  bulkArchive: (ids, restore = false) =>
    request({ method: 'patch', url: '/vendors/bulk/archive', data: { ids, restore } }),
  audit: (id, params = {}) => request({ method: 'get', url: `/vendors/${id}/audit`, params }),

  // --- Contacts ---
  contacts: (id) => request({ method: 'get', url: `/vendors/${id}/contacts` }),
  addContact: (id, data) => request({ method: 'post', url: `/vendors/${id}/contacts`, data }),
  updateContact: (id, contactId, data) =>
    request({ method: 'put', url: `/vendors/${id}/contacts/${contactId}`, data }),
  setPrimaryContact: (id, contactId) =>
    request({ method: 'patch', url: `/vendors/${id}/contacts/${contactId}/primary` }),
  deleteContact: (id, contactId) =>
    request({ method: 'delete', url: `/vendors/${id}/contacts/${contactId}` }),

  // --- Addresses ---
  addresses: (id) => request({ method: 'get', url: `/vendors/${id}/addresses` }),
  addAddress: (id, data) => request({ method: 'post', url: `/vendors/${id}/addresses`, data }),
  updateAddress: (id, addressId, data) =>
    request({ method: 'put', url: `/vendors/${id}/addresses/${addressId}`, data }),
  deleteAddress: (id, addressId) =>
    request({ method: 'delete', url: `/vendors/${id}/addresses/${addressId}` }),

  // --- Products & pricing ---
  products: (id, params = {}) => request({ method: 'get', url: `/vendors/${id}/products`, params }),
  addProduct: (id, data) => request({ method: 'post', url: `/vendors/${id}/products`, data }),
  updateProduct: (id, itemId, data) =>
    request({ method: 'put', url: `/vendors/${id}/products/${itemId}`, data }),
  deleteProduct: (id, itemId) =>
    request({ method: 'delete', url: `/vendors/${id}/products/${itemId}` }),
  vendorsForProduct: (productId) => request({ method: 'get', url: `/vendors/by-product/${productId}` }),

  // --- Documents ---
  documents: (id, params = {}) => request({ method: 'get', url: `/vendors/${id}/documents`, params }),
  uploadDocument: (id, formData, onUploadProgress) =>
    request({ method: 'post', url: `/vendors/${id}/documents`, data: formData, onUploadProgress }),
  replaceDocumentFile: (id, docId, formData) =>
    request({ method: 'put', url: `/vendors/${id}/documents/${docId}/file`, data: formData }),
  updateDocument: (id, docId, data) =>
    request({ method: 'put', url: `/vendors/${id}/documents/${docId}`, data }),
  deleteDocument: (id, docId) =>
    request({ method: 'delete', url: `/vendors/${id}/documents/${docId}` }),

  // --- Activities ---
  activities: (id, params = {}) => request({ method: 'get', url: `/vendors/${id}/activities`, params }),
  addActivity: (id, data) => request({ method: 'post', url: `/vendors/${id}/activities`, data }),
  updateActivity: (id, activityId, data) =>
    request({ method: 'put', url: `/vendors/${id}/activities/${activityId}`, data }),
  deleteActivity: (id, activityId) =>
    request({ method: 'delete', url: `/vendors/${id}/activities/${activityId}` }),

  // --- Performance ---
  evaluations: (id, params = {}) => request({ method: 'get', url: `/vendors/${id}/evaluations`, params }),
  addEvaluation: (id, data) => request({ method: 'post', url: `/vendors/${id}/evaluations`, data }),
  deleteEvaluation: (id, evalId) =>
    request({ method: 'delete', url: `/vendors/${id}/evaluations/${evalId}` }),
  leaderboard: (params = {}) => request({ method: 'get', url: '/vendors/leaderboard', params }),

  // --- Categories ---
  categories: (params = {}) => request({ method: 'get', url: '/categories', params }),
  createCategory: (data) => request({ method: 'post', url: '/categories', data }),
  updateCategory: (id, data) => request({ method: 'put', url: `/categories/${id}`, data }),
  deleteCategory: (id, reassignTo) =>
    request({ method: 'delete', url: `/categories/${id}`, data: { reassignTo } }),

  // --- Import ---
  importUpload: (formData) => request({ method: 'post', url: '/import/upload', data: formData }),
  importValidate: (jobId, mapping) =>
    request({ method: 'post', url: '/import/validate', data: { jobId, mapping } }),
  importCommit: (jobId) => request({ method: 'post', url: '/import/commit', data: { jobId } }),
};

/* --------------------------------------------------------------------------
 * File responses
 *
 * Exports, import reports, templates and document downloads all need the
 * Authorization header, so they cannot be plain <a href> links. Each is
 * fetched as a blob and handed to the browser through a temporary object URL.
 * ------------------------------------------------------------------------ */
const downloadBlob = async (url, { params = {}, filename, inline = false } = {}) => {
  let response;
  try {
    response = await axios.get(`${BASE}${url}`, { params, responseType: 'blob' });
  } catch (error) {
    // An error response is still a blob; read it back so the real message shows.
    if (error?.response?.data instanceof Blob) {
      try {
        const text = await error.response.data.text();
        const parsed = JSON.parse(text);
        throw new VendorApiError(parsed.message || 'The download failed.', {
          status: error.response.status,
        });
      } catch (parseError) {
        if (parseError instanceof VendorApiError) throw parseError;
      }
    }
    throw toVendorError(error);
  }

  const blobUrl = URL.createObjectURL(response.data);

  if (inline) {
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
    // Give the new tab time to claim the URL before it is revoked.
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    return;
  }

  const name = filename
    || /filename="?([^"]+)"?/.exec(response.headers?.['content-disposition'] || '')?.[1]
    || 'download';

  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
};

export const vendorFiles = {
  exportCsv: (filters = {}) => downloadBlob('/export', { params: toParams(filters) }),
  importTemplate: () => downloadBlob('/import/template', { filename: 'vendor-import-template.csv' }),
  importReport: (jobId) => downloadBlob(`/import/${jobId}/report`, { filename: `vendor-import-report-${jobId}.csv` }),
  downloadDocument: (vendorId, docId, filename) =>
    downloadBlob(`/vendors/${vendorId}/documents/${docId}/file`, { filename }),
  previewDocument: (vendorId, docId) =>
    downloadBlob(`/vendors/${vendorId}/documents/${docId}/file`, {
      params: { disposition: 'inline' },
      inline: true,
    }),
};

export default vendorApi;

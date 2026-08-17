// Vendor contacts and addresses.
//
// Both are embedded sub-documents on the vendor, so these endpoints load the
// parent, mutate the array and save — which keeps the "exactly one primary
// contact / one default address" invariant in the model's save hook rather
// than duplicating that rule per route.

const express = require('express');

const router = express.Router({ mergeParams: true });

const Vendor = require('../../models/VendorData');
const authenticate = require('../../middleware/auth');
const { requireVendorPermission } = require('../../middleware/vendorPermissions');
const { validateContact, validateAddress } = require('../../utils/vendorValidators');
const { ok, fail, isValidId, handleError, logVendorAudit, pick } = require('../../utils/vendorHelpers');

const CONTACT_FIELDS = [
  'fullName', 'designation', 'department', 'email', 'phone', 'whatsapp',
  'altPhone', 'contactType', 'isPrimary', 'notes', 'isActive',
];

const ADDRESS_FIELDS = [
  'addressType', 'line1', 'line2', 'landmark', 'city', 'state', 'country',
  'pincode', 'isDefault',
];

// Load the vendor named by :vendorId, or answer 404/400. Every route below
// needs it, so it runs as router-level middleware — the id is validated before
// it is ever used in a query.
const loadVendor = async (req, res, next) => {
  try {
    if (!isValidId(req.params.vendorId)) return fail(res, 400, 'Invalid vendor id');
    const vendor = await Vendor.findById(req.params.vendorId);
    if (!vendor) return fail(res, 404, 'Vendor not found');
    req.vendor = vendor;
    return next();
  } catch (err) {
    return handleError(res, err, 'loadVendor');
  }
};

/* ============================== CONTACTS ============================== */

router.get('/:vendorId/contacts', authenticate, requireVendorPermission('vendor.view'), loadVendor, (req, res) => {
  const contacts = [...req.vendor.contacts].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  return ok(res, { contacts });
});

router.post('/:vendorId/contacts', authenticate, requireVendorPermission('vendor.edit'), loadVendor, async (req, res) => {
  try {
    const errors = validateContact(req.body);
    if (errors.length) return fail(res, 400, errors[0], { errors });

    if (req.vendor.contacts.length >= 50) {
      return fail(res, 400, 'A vendor can have at most 50 contacts');
    }

    const contact = pick(req.body, CONTACT_FIELDS);
    // A newly flagged primary demotes the others (the model hook keeps exactly
    // one primary; doing it here makes the intent explicit).
    if (contact.isPrimary) req.vendor.contacts.forEach((c) => { c.isPrimary = false; });

    req.vendor.contacts.push(contact);
    req.vendor.updatedBy = req.user._id;
    await req.vendor.save();

    const created = req.vendor.contacts[req.vendor.contacts.length - 1];
    await logVendorAudit(req, 'Vendor contact added', {
      vendorId: req.vendor._id, v_code: req.vendor.v_code, contactName: created.fullName,
    });

    return ok(res, { contact: created }, 201);
  } catch (err) {
    return handleError(res, err, 'POST contacts');
  }
});

router.put('/:vendorId/contacts/:contactId', authenticate, requireVendorPermission('vendor.edit'), loadVendor, async (req, res) => {
  try {
    const contact = req.vendor.contacts.id(req.params.contactId);
    if (!contact) return fail(res, 404, 'Contact not found');

    const merged = { ...contact.toObject(), ...pick(req.body, CONTACT_FIELDS) };
    const errors = validateContact(merged);
    if (errors.length) return fail(res, 400, errors[0], { errors });

    const updates = pick(req.body, CONTACT_FIELDS);
    if (updates.isPrimary) {
      req.vendor.contacts.forEach((c) => { c.isPrimary = false; });
    }
    Object.assign(contact, updates);

    req.vendor.updatedBy = req.user._id;
    await req.vendor.save();

    await logVendorAudit(req, 'Vendor contact updated', {
      vendorId: req.vendor._id, v_code: req.vendor.v_code, contactName: contact.fullName,
    });

    return ok(res, { contact });
  } catch (err) {
    return handleError(res, err, 'PUT contact');
  }
});

// Dedicated endpoint so promoting a contact is one intentional click rather
// than an edit that could accidentally leave zero or two primaries.
router.patch('/:vendorId/contacts/:contactId/primary', authenticate, requireVendorPermission('vendor.edit'), loadVendor, async (req, res) => {
  try {
    const contact = req.vendor.contacts.id(req.params.contactId);
    if (!contact) return fail(res, 404, 'Contact not found');

    req.vendor.contacts.forEach((c) => { c.isPrimary = false; });
    contact.isPrimary = true;
    req.vendor.updatedBy = req.user._id;
    await req.vendor.save();

    await logVendorAudit(req, 'Vendor primary contact changed', {
      vendorId: req.vendor._id, v_code: req.vendor.v_code, contactName: contact.fullName,
    });

    return ok(res, { contacts: req.vendor.contacts });
  } catch (err) {
    return handleError(res, err, 'PATCH primary contact');
  }
});

router.delete('/:vendorId/contacts/:contactId', authenticate, requireVendorPermission('vendor.edit'), loadVendor, async (req, res) => {
  try {
    const contact = req.vendor.contacts.id(req.params.contactId);
    if (!contact) return fail(res, 404, 'Contact not found');

    const name = contact.fullName;
    contact.deleteOne();
    req.vendor.updatedBy = req.user._id;
    await req.vendor.save(); // the save hook re-promotes a primary if needed

    await logVendorAudit(req, 'Vendor contact deleted', {
      vendorId: req.vendor._id, v_code: req.vendor.v_code, contactName: name,
    });

    return ok(res, { contacts: req.vendor.contacts });
  } catch (err) {
    return handleError(res, err, 'DELETE contact');
  }
});

/* ============================== ADDRESSES ============================== */

router.get('/:vendorId/addresses', authenticate, requireVendorPermission('vendor.view'), loadVendor, (req, res) => {
  const addresses = [...req.vendor.addresses].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  return ok(res, { addresses });
});

router.post('/:vendorId/addresses', authenticate, requireVendorPermission('vendor.edit'), loadVendor, async (req, res) => {
  try {
    const errors = validateAddress(req.body);
    if (errors.length) return fail(res, 400, errors[0], { errors });

    if (req.vendor.addresses.length >= 25) {
      return fail(res, 400, 'A vendor can have at most 25 addresses');
    }

    const address = pick(req.body, ADDRESS_FIELDS);
    if (address.isDefault) req.vendor.addresses.forEach((a) => { a.isDefault = false; });

    req.vendor.addresses.push(address);
    req.vendor.updatedBy = req.user._id;
    await req.vendor.save();

    const created = req.vendor.addresses[req.vendor.addresses.length - 1];
    await logVendorAudit(req, 'Vendor address added', {
      vendorId: req.vendor._id, v_code: req.vendor.v_code, addressType: created.addressType,
    });

    return ok(res, { address: created }, 201);
  } catch (err) {
    return handleError(res, err, 'POST address');
  }
});

router.put('/:vendorId/addresses/:addressId', authenticate, requireVendorPermission('vendor.edit'), loadVendor, async (req, res) => {
  try {
    const address = req.vendor.addresses.id(req.params.addressId);
    if (!address) return fail(res, 404, 'Address not found');

    const merged = { ...address.toObject(), ...pick(req.body, ADDRESS_FIELDS) };
    const errors = validateAddress(merged);
    if (errors.length) return fail(res, 400, errors[0], { errors });

    const updates = pick(req.body, ADDRESS_FIELDS);
    if (updates.isDefault) req.vendor.addresses.forEach((a) => { a.isDefault = false; });
    Object.assign(address, updates);

    req.vendor.updatedBy = req.user._id;
    await req.vendor.save();

    await logVendorAudit(req, 'Vendor address updated', {
      vendorId: req.vendor._id, v_code: req.vendor.v_code, addressType: address.addressType,
    });

    return ok(res, { address });
  } catch (err) {
    return handleError(res, err, 'PUT address');
  }
});

router.delete('/:vendorId/addresses/:addressId', authenticate, requireVendorPermission('vendor.edit'), loadVendor, async (req, res) => {
  try {
    const address = req.vendor.addresses.id(req.params.addressId);
    if (!address) return fail(res, 404, 'Address not found');

    const type = address.addressType;
    address.deleteOne();
    req.vendor.updatedBy = req.user._id;
    await req.vendor.save();

    await logVendorAudit(req, 'Vendor address deleted', {
      vendorId: req.vendor._id, v_code: req.vendor.v_code, addressType: type,
    });

    return ok(res, { addresses: req.vendor.addresses });
  } catch (err) {
    return handleError(res, err, 'DELETE address');
  }
});

module.exports = router;
module.exports.loadVendor = loadVendor;

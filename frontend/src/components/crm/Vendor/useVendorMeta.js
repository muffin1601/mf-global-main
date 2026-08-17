// Shared vendor reference data (statuses, categories, owners) plus the calling
// user's effective permissions, fetched once per screen from /vendors/meta.
//
// Permissions returned here mirror the server's own table. They drive what the
// UI *shows*; the server independently enforces what the user can *do*.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { vendorApi } from '../../../utils/vendorApi';
import { reportError } from './VendorUI';

const EMPTY_META = {
  statuses: [],
  priorities: [],
  types: [],
  addressTypes: [],
  contactTypes: [],
  documentTypes: [],
  activityTypes: [],
  paymentMethods: [],
  currencies: [],
  categories: [],
  owners: [],
  permissions: [],
};

export const useVendorMeta = () => {
  const [meta, setMeta] = useState(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await vendorApi.meta();
      setMeta({ ...EMPTY_META, ...data });
    } catch (err) {
      setError(err.message);
      reportError(err, 'Unable to load vendor settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const can = useCallback(
    (permission) => meta.permissions.includes(permission),
    [meta.permissions]
  );

  return useMemo(
    () => ({ meta, loading, error, reload: load, can }),
    [meta, loading, error, load, can]
  );
};

// Debounce a rapidly-changing value (used for the search box, so typing does
// not fire a request per keystroke).
export const useDebounced = (value, delay = 400) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
};

export default useVendorMeta;

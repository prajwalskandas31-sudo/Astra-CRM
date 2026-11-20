/** RA Periodic Report Block client (backend/ra_periodic_report.py). */
import { backendFetch } from './leegalityService';

const json = async (path, options) => (await backendFetch(path, options)).json();

export const loadRaPeriodicReport = (period) => json(`/ra-periodic-report?${new URLSearchParams({ period })}`);

export const saveRaPeriodicReport = (period, data) =>
  json(`/ra-periodic-report?${new URLSearchParams({ period })}`, { method: 'PUT', body: JSON.stringify({ data }) });

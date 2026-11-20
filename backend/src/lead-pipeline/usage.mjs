// Monthly usage counters so free tiers are never exceeded.
import { query } from './db.mjs';

const currentPeriod = () => new Date().toISOString().slice(0, 7); // 'YYYY-MM'

/**
 * Atomically add `units` to this month's counter for `provider`.
 * Returns true if allowed, false if it would exceed the monthly limit.
 */
export async function reserve(provider, units = 1, monthlyLimit = null) {
  const { rows } = await query(
    `INSERT INTO api_usage (provider, period, units_used, monthly_limit)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (provider, period) DO UPDATE
       SET units_used = api_usage.units_used + EXCLUDED.units_used,
           monthly_limit = COALESCE(EXCLUDED.monthly_limit, api_usage.monthly_limit)
       WHERE COALESCE(EXCLUDED.monthly_limit, api_usage.monthly_limit) IS NULL
          OR api_usage.units_used + EXCLUDED.units_used
             <= COALESCE(EXCLUDED.monthly_limit, api_usage.monthly_limit)
     RETURNING units_used`,
    [provider, currentPeriod(), units, monthlyLimit]
  );
  return rows.length > 0;
}

/** Give units back when a call failed before it consumed anything. */
export async function refund(provider, units = 1) {
  await query(
    `UPDATE api_usage SET units_used = GREATEST(units_used - $3, 0)
     WHERE provider = $1 AND period = $2`,
    [provider, currentPeriod(), units]
  );
}

export async function usageReport() {
  const { rows } = await query(
    `SELECT provider, units_used, monthly_limit FROM api_usage WHERE period = $1 ORDER BY provider`,
    [currentPeriod()]
  );
  return rows;
}

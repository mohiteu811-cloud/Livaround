'use client';

import { useState, useEffect } from 'react';
import { api } from './api';

const IS_COMMERCIAL = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === 'true';

interface FeaturesResponse {
  plan: string | null;
  features: Record<string, boolean>;
}

let cachedFeatures: FeaturesResponse | null = null;
let fetchPromise: Promise<FeaturesResponse> | null = null;

function fetchFeatures(): Promise<FeaturesResponse> {
  if (!IS_COMMERCIAL) {
    const result: FeaturesResponse = { plan: null, features: {} };
    cachedFeatures = result;
    return Promise.resolve(result);
  }
  if (cachedFeatures) return Promise.resolve(cachedFeatures);
  if (fetchPromise) return fetchPromise;

  fetchPromise = api.billing
    .features()
    .then((data) => {
      cachedFeatures = data;
      fetchPromise = null;
      return data;
    })
    .catch(() => {
      fetchPromise = null;
      // On error, fall back to open-source defaults
      const fallback: FeaturesResponse = { plan: null, features: {} };
      return fallback;
    });

  return fetchPromise;
}

/** Clear the cache so the next hook mount re-fetches. */
export function invalidateFeatureCache() {
  cachedFeatures = null;
  fetchPromise = null;
}

/**
 * Minimum plan needed for each feature (only the ones that are gated).
 * Features not listed here are available on all plans.
 */
const FEATURE_MIN_PLAN: Record<string, string> = {
  ownerReports: 'pro',
  shiftMarketplace: 'pro',
  apiAccess: 'pro',
  prioritySupport: 'pro',
  whiteLabel: 'agency',
  multiOrg: 'agency',
};

/**
 * React hook for gating UI elements by feature.
 *
 * When IS_COMMERCIAL is false (open-source mode), always returns
 * { allowed: true, requiredPlan: null, loading: false }.
 */
export function useFeatureGate(featureName: string): {
  allowed: boolean;
  requiredPlan: string | null;
  loading: boolean;
} {
  const [loading, setLoading] = useState(!cachedFeatures && IS_COMMERCIAL);
  const [features, setFeatures] = useState<FeaturesResponse | null>(cachedFeatures);

  useEffect(() => {
    let cancelled = false;
    fetchFeatures().then((data) => {
      if (!cancelled) {
        setFeatures(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  if (!IS_COMMERCIAL) {
    return { allowed: true, requiredPlan: null, loading: false };
  }

  if (loading || !features) {
    return { allowed: false, requiredPlan: null, loading: true };
  }

  const allowed = features.features[featureName] === true;
  const requiredPlan = allowed ? null : (FEATURE_MIN_PLAN[featureName] ?? 'pro');

  return { allowed, requiredPlan, loading: false };
}

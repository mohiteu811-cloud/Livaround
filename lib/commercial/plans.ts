export interface PlanDefinition {
  name: string;
  pricePerProperty: number | null;
  flatPrice: number | null;
  maxProperties: number | null;
  features: Record<string, boolean>;
}

export const PLAN_HIERARCHY = ['community', 'pro', 'agency'] as const;

export type PlanName = (typeof PLAN_HIERARCHY)[number];

export const PLANS: Record<PlanName, PlanDefinition> = {
  community: {
    name: 'community',
    pricePerProperty: null,
    flatPrice: null,
    maxProperties: null,
    features: {
      propertyManagement: true,
      bookingCalendar: true,
      taskScheduling: true,
      workerApp: true,
      inventoryTracking: true,
      maintenanceRequests: true,
      guestApp: true,
      opsGuide: true,
      ownerReports: false,
      shiftMarketplace: false,
      apiAccess: false,
      prioritySupport: false,
      whiteLabel: false,
      multiOrg: false,
    },
  },

  pro: {
    name: 'pro',
    pricePerProperty: 10,
    flatPrice: null,
    maxProperties: null,
    features: {
      propertyManagement: true,
      bookingCalendar: true,
      taskScheduling: true,
      workerApp: true,
      inventoryTracking: true,
      maintenanceRequests: true,
      guestApp: true,
      opsGuide: true,
      ownerReports: true,
      shiftMarketplace: true,
      apiAccess: true,
      prioritySupport: true,
      whiteLabel: false,
      multiOrg: false,
    },
  },

  agency: {
    name: 'agency',
    pricePerProperty: null,
    flatPrice: 100,
    maxProperties: null,
    features: {
      propertyManagement: true,
      bookingCalendar: true,
      taskScheduling: true,
      workerApp: true,
      inventoryTracking: true,
      maintenanceRequests: true,
      guestApp: true,
      opsGuide: true,
      ownerReports: true,
      shiftMarketplace: true,
      apiAccess: true,
      prioritySupport: true,
      whiteLabel: true,
      multiOrg: true,
    },
  },
};

export function getPlanByName(name: string): PlanDefinition | undefined {
  return PLANS[name as PlanName];
}

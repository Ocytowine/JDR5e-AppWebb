export type RestType = "short_rest" | "long_rest";

export type RechargePolicy = RestType | "none";

export interface RechargeableResource {
  id: string;
  current: number;
  max: number;
  recharge?: RechargePolicy;
}

export function applyRestToResources(
  resources: RechargeableResource[],
  restType: RestType
): RechargeableResource[] {
  const fullResetOn = restType === "long_rest"
    ? new Set<RechargePolicy>(["short_rest", "long_rest"])
    : new Set<RechargePolicy>(["short_rest"]);

  return resources.map(resource => {
    const policy = resource.recharge ?? "none";
    if (policy === "none") return resource;
    if (fullResetOn.has(policy)) {
      return { ...resource, current: resource.max };
    }
    return resource;
  });
}

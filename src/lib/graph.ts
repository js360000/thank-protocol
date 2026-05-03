import type {
  DependencyRecord,
  DependencyScan,
  FundingAllocation,
  FundingPlan,
  FundingStrategy,
  VerificationLevel
} from "./types.js";

export interface FundingPlanOptions {
  amount: number;
  currency: string;
  strategy: FundingStrategy;
}

export function buildFundingPlan(scan: DependencyScan, options: FundingPlanOptions): FundingPlan {
  const verified = scan.dependencies.filter((dependency) => dependency.verified && dependency.repo);
  const unfundedDependencies = scan.dependencies.filter((dependency) => !dependency.verified);

  if (verified.length === 0 || options.amount <= 0) {
    return {
      generatedAt: new Date().toISOString(),
      root: scan.root,
      amount: options.amount,
      currency: options.currency,
      strategy: options.strategy,
      allocations: [],
      unfundedDependencies,
      totals: {
        allocated: 0,
        verifiedDependencies: 0,
        unfundedDependencies: unfundedDependencies.length
      }
    };
  }

  const weighted = groupByFundingDestination(verified, options.strategy);
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);

  let remainingAmount = roundCurrency(options.amount);
  let remainingBps = 10_000;
  const allocations: FundingAllocation[] = weighted.map((destination, index) => {
    const isLast = index === weighted.length - 1;
    const amount = isLast
      ? remainingAmount
      : roundCurrency((options.amount * destination.weight) / totalWeight);
    const shareBps = isLast ? remainingBps : Math.round((amount / options.amount) * 10_000);
    remainingAmount = roundCurrency(remainingAmount - amount);
    remainingBps -= shareBps;

    return {
      dependencyId: destination.dependencyIds[0],
      dependencyIds: destination.dependencyIds,
      name: destination.name,
      ecosystem: destination.ecosystems.join(", "),
      repo: destination.repo,
      verificationLevel: destination.verificationLevel,
      amount,
      currency: options.currency,
      shareBps,
      weight: destination.weight
    };
  });

  const allocated = allocations.reduce((sum, allocation) => sum + allocation.amount, 0);

  return {
    generatedAt: new Date().toISOString(),
    root: scan.root,
    amount: options.amount,
    currency: options.currency,
    strategy: options.strategy,
    allocations,
    unfundedDependencies,
    totals: {
      allocated: roundCurrency(allocated),
      verifiedDependencies: verified.length,
      unfundedDependencies: unfundedDependencies.length
    }
  };
}

export function createReceiptId(root: string, generatedAt: string) {
  const normalized = `${root}:${generatedAt}`.toLowerCase();
  let hash = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash << 5) - hash + normalized.charCodeAt(index);
    hash |= 0;
  }

  return `thank_${Math.abs(hash).toString(16).padStart(8, "0")}`;
}

interface WeightedDestination {
  repo: string;
  name: string;
  ecosystems: string[];
  dependencyIds: string[];
  verificationLevel: VerificationLevel;
  weight: number;
}

function groupByFundingDestination(
  dependencies: DependencyRecord[],
  strategy: FundingStrategy
): WeightedDestination[] {
  const groups = new Map<string, WeightedDestination>();

  for (const dependency of dependencies) {
    if (!dependency.repo) {
      continue;
    }

    const key = dependency.repo.toLowerCase();
    const existing = groups.get(key);
    const dependencyWeight = calculateWeight(dependency, strategy);

    if (!existing) {
      groups.set(key, {
        repo: dependency.repo,
        name: dependency.repo.split("/").at(-1) ?? dependency.name,
        ecosystems: [dependency.ecosystem],
        dependencyIds: [dependency.id],
        verificationLevel: dependency.verificationLevel ?? 0,
        weight: dependencyWeight
      });
      continue;
    }

    existing.dependencyIds.push(dependency.id);
    existing.dependencyIds.sort();
    existing.weight += dependencyWeight;
    existing.verificationLevel = Math.max(
      existing.verificationLevel,
      dependency.verificationLevel ?? 0
    ) as VerificationLevel;
    if (!existing.ecosystems.includes(dependency.ecosystem)) {
      existing.ecosystems.push(dependency.ecosystem);
      existing.ecosystems.sort();
    }
  }

  return [...groups.values()].sort((left, right) => {
    if (right.weight !== left.weight) {
      return right.weight - left.weight;
    }
    return left.repo.localeCompare(right.repo);
  });
}

function calculateWeight(dependency: DependencyRecord, strategy: FundingStrategy) {
  if (strategy === "equal") {
    return 1;
  }

  const directWeight = dependency.relationship === "direct" || dependency.relationship === "runtime" ? 2 : 1;

  if (strategy === "direct-weighted") {
    return directWeight;
  }

  return Math.max(1, directWeight + dependency.sourceCount + verificationBoost(dependency.verificationLevel));
}

function verificationBoost(level: VerificationLevel | undefined) {
  if (!level) {
    return 0;
  }
  return level * 0.25;
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

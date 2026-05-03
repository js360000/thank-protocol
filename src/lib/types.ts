export type VerificationLevel = 0 | 1 | 2 | 3 | 4;

export type DependencyRelationship = "direct" | "transitive" | "runtime" | "development";

export type FundingStrategy = "equal" | "direct-weighted" | "centrality";

export interface ChainWallet {
  address: string;
  chains: string[];
}

export interface ThankMaintainer {
  github: string;
  share: number;
  wallet: string;
}

export interface ThankUpstream {
  repo: string;
  share: number;
}

export interface ThankManifest {
  version: 1;
  project: {
    name: string;
    repo: string;
    website?: string;
    description?: string;
  };
  wallets: {
    primary: ChainWallet;
  };
  maintainers: ThankMaintainer[];
  splits: {
    maintainers: number;
    upstream: number;
    protocol: number;
  };
  upstream: ThankUpstream[];
  verification?: {
    github?: "required" | "optional" | "none";
    signed_commit?: "required" | "optional" | "none";
    dns_txt?: "required" | "optional" | "none";
  };
}

export interface RegistryProject {
  repo: string;
  name: string;
  description: string;
  website?: string;
  verificationLevel: VerificationLevel;
  manifest: string;
  wallet: string;
  packages: string[];
  maintainers: string[];
  funding: {
    receivedUsd: number;
    upstreamFundedUsd: number;
    dependenciesSupported: number;
    lastPayment: string;
  };
}

export interface RegistryFile {
  generatedAt: string;
  projects: RegistryProject[];
}

export interface DependencyRecord {
  id: string;
  name: string;
  ecosystem: string;
  version?: string;
  relationship: DependencyRelationship;
  sourceFile: string;
  sourceCount: number;
  verified: boolean;
  repo?: string;
  verificationLevel?: VerificationLevel;
  fundingManifest?: string;
}

export interface DependencyScan {
  root: string;
  scannedAt: string;
  dependencies: DependencyRecord[];
  ecosystems: Record<string, number>;
  filesInspected: string[];
  totals: {
    dependencies: number;
    direct: number;
    transitive: number;
    verified: number;
    missingFunding: number;
  };
}

export interface FundingAllocation {
  dependencyId: string;
  dependencyIds: string[];
  name: string;
  ecosystem: string;
  repo: string;
  verificationLevel: VerificationLevel;
  amount: number;
  currency: string;
  shareBps: number;
  weight: number;
}

export interface FundingPlan {
  generatedAt: string;
  root: string;
  amount: number;
  currency: string;
  strategy: FundingStrategy;
  allocations: FundingAllocation[];
  unfundedDependencies: DependencyRecord[];
  totals: {
    allocated: number;
    verifiedDependencies: number;
    unfundedDependencies: number;
  };
}

export interface FundingReceipt {
  id: string;
  generatedAt: string;
  donor?: string;
  message?: string;
  project: string;
  amount: number;
  currency: string;
  transactionReference: string | null;
  mode: "offline-plan" | "onchain";
  allocations: FundingAllocation[];
}

export interface DashboardData {
  generatedAt: string;
  scan: DependencyScan;
  fundingPlan: FundingPlan;
  registry: RegistryFile;
  receipts: FundingReceipt[];
}

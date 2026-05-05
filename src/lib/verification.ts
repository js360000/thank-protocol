import { createManifestCommitment, normalizeRepo } from "./protocol.js";
import type { ManifestValidationResult } from "./manifest.js";
import type { ThankManifest } from "./types.js";

export type VerificationStatus = "pass" | "warn" | "fail" | "skip";

export interface VerificationCheck {
  id: string;
  label: string;
  status: VerificationStatus;
  required: boolean;
  detail: string;
  action?: string;
}

export interface DnsProofEvidence {
  checked: boolean;
  recordName?: string;
  records: string[];
  error?: string;
}

export interface SignedCommitEvidence {
  checked: boolean;
  commit: string;
  verified: boolean;
  detail?: string;
}

export interface VerificationReport {
  manifest: {
    path?: string;
    name: string;
    repo: string;
    website?: string;
  };
  projectId: `0x${string}`;
  manifestHash: `0x${string}`;
  gitRemote?: string;
  level: 0 | 1 | 2 | 3;
  readyForRegistry: boolean;
  checks: VerificationCheck[];
  expectedDnsProof?: {
    name: string;
    value: string;
  };
  nextActions: string[];
}

export interface VerificationReportOptions {
  manifestPath?: string;
  gitRemote?: string;
  validationWarnings?: string[];
  dnsProof?: DnsProofEvidence;
  signedCommit?: SignedCommitEvidence;
}

const zeroAddress = /^0x0{40}$/i;

export function createVerificationReport(
  validation: ManifestValidationResult,
  options: VerificationReportOptions = {}
): VerificationReport {
  if (!validation.valid || !validation.manifest) {
    const checks: VerificationCheck[] = [
      {
        id: "manifest-schema",
        label: "Manifest schema",
        status: "fail",
        required: true,
        detail: validation.errors.join("; ") || "Manifest did not pass validation.",
        action: "Run thank validate and fix every manifest error."
      }
    ];
    return {
      manifest: {
        path: options.manifestPath,
        name: "unknown",
        repo: "unknown"
      },
      projectId: "0x0000000000000000000000000000000000000000000000000000000000000000",
      manifestHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
      level: 0,
      readyForRegistry: false,
      checks,
      nextActions: collectNextActions(checks)
    };
  }

  const manifest = validation.manifest;
  const commitment = createManifestCommitment(manifest);
  const checks: VerificationCheck[] = [];

  checks.push({
    id: "manifest-schema",
    label: "Manifest schema",
    status: "pass",
    required: true,
    detail: "Manifest matches the THANK v1 schema and accounting rules."
  });

  addValidationWarnings(checks, options.validationWarnings ?? validation.warnings);
  addGitHubPolicyCheck(checks, manifest);
  addGitRemoteCheck(checks, manifest, options.gitRemote);
  addWalletChecks(checks, manifest);
  addMaintainerChecks(checks, manifest);
  addUpstreamCheck(checks, manifest);
  addSignedCommitCheck(checks, manifest, options.signedCommit);
  addDnsCheck(checks, manifest, commitment.manifestHash, options.dnsProof);

  const level = computeVerificationLevel(checks);
  const readyForRegistry = !checks.some((check) => check.required && check.status === "fail") && level >= 1;

  return {
    manifest: {
      path: options.manifestPath,
      name: manifest.project.name,
      repo: normalizeRepo(manifest.project.repo),
      website: manifest.project.website
    },
    projectId: commitment.projectId,
    manifestHash: commitment.manifestHash,
    gitRemote: options.gitRemote,
    level,
    readyForRegistry,
    checks,
    expectedDnsProof: createExpectedDnsProof(manifest, commitment.manifestHash),
    nextActions: collectNextActions(checks)
  };
}

export function normalizeGitHubRemote(remote: string | undefined): string | undefined {
  if (!remote) {
    return undefined;
  }

  return remote
    .trim()
    .replace(/^git@github.com:/i, "")
    .replace(/^https:\/\/github.com\//i, "")
    .replace(/^ssh:\/\/git@github.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

export function createExpectedDnsProof(
  manifest: ThankManifest,
  manifestHash: `0x${string}`
): { name: string; value: string } | undefined {
  if (!manifest.project.website) {
    return undefined;
  }

  let hostname: string;
  try {
    hostname = new URL(manifest.project.website).hostname.toLowerCase();
  } catch {
    return undefined;
  }

  if (!hostname) {
    return undefined;
  }

  return {
    name: `_thank.${hostname}`,
    value: `thank:v1 repo=${normalizeRepo(manifest.project.repo)} manifest=${manifestHash.toLowerCase()} wallet=${manifest.wallets.primary.address.toLowerCase()}`
  };
}

function addValidationWarnings(checks: VerificationCheck[], warnings: string[]) {
  for (const warning of warnings) {
    checks.push({
      id: `validation-warning-${checks.length}`,
      label: "Validation warning",
      status: "warn",
      required: false,
      detail: warning
    });
  }
}

function addGitHubPolicyCheck(checks: VerificationCheck[], manifest: ThankManifest) {
  const githubPolicy = manifest.verification?.github ?? "none";
  if (githubPolicy === "required") {
    checks.push({
      id: "github-policy",
      label: "GitHub policy",
      status: "pass",
      required: true,
      detail: "Manifest requires GitHub ownership proof."
    });
    return;
  }

  checks.push({
    id: "github-policy",
    label: "GitHub policy",
    status: "fail",
    required: true,
    detail: `Manifest sets verification.github to ${githubPolicy}.`,
    action: "Set verification.github: required before asking donors to trust this funding destination."
  });
}

function addGitRemoteCheck(checks: VerificationCheck[], manifest: ThankManifest, gitRemote: string | undefined) {
  const expectedRepo = normalizeRepo(manifest.project.repo);
  const actualRepo = normalizeGitHubRemote(gitRemote);

  if (actualRepo === expectedRepo) {
    checks.push({
      id: "github-remote",
      label: "GitHub repo proof",
      status: "pass",
      required: true,
      detail: `origin resolves to ${expectedRepo}.`
    });
    return;
  }

  checks.push({
    id: "github-remote",
    label: "GitHub repo proof",
    status: "fail",
    required: true,
    detail: gitRemote ? `origin resolves to ${actualRepo ?? gitRemote}, expected ${expectedRepo}.` : "No origin remote was found.",
    action: `Run from a checkout of ${expectedRepo}, or pass --repo-url https://github.com/${expectedRepo}.git in CI.`
  });
}

function addWalletChecks(checks: VerificationCheck[], manifest: ThankManifest) {
  const primary = manifest.wallets.primary.address;
  if (zeroAddress.test(primary)) {
    checks.push({
      id: "primary-wallet",
      label: "Primary wallet",
      status: "fail",
      required: true,
      detail: "Primary wallet is the zero address.",
      action: "Replace wallets.primary.address with the maintainer treasury or multisig address."
    });
  } else {
    checks.push({
      id: "primary-wallet",
      label: "Primary wallet",
      status: "pass",
      required: true,
      detail: `Primary wallet is ${primary}.`
    });
  }

  const zeroMaintainers = manifest.maintainers.filter((maintainer) => zeroAddress.test(maintainer.wallet));
  if (zeroMaintainers.length > 0) {
    checks.push({
      id: "maintainer-wallets",
      label: "Maintainer wallets",
      status: "fail",
      required: true,
      detail: `Zero-address maintainer wallets: ${zeroMaintainers.map((maintainer) => maintainer.github).join(", ")}.`,
      action: "Replace every maintainer zero address with a real payout wallet."
    });
  } else {
    checks.push({
      id: "maintainer-wallets",
      label: "Maintainer wallets",
      status: "pass",
      required: true,
      detail: `${manifest.maintainers.length} maintainer wallet(s) are non-zero.`
    });
  }
}

function addMaintainerChecks(checks: VerificationCheck[], manifest: ThankManifest) {
  const duplicateMaintainers = findDuplicates(manifest.maintainers.map((maintainer) => maintainer.github.toLowerCase()));
  if (duplicateMaintainers.length > 0) {
    checks.push({
      id: "maintainer-identity",
      label: "Maintainer identities",
      status: "fail",
      required: true,
      detail: `Duplicate GitHub maintainers: ${duplicateMaintainers.join(", ")}.`,
      action: "Each maintainer should appear once with their total share."
    });
    return;
  }

  checks.push({
    id: "maintainer-identity",
    label: "Maintainer identities",
    status: "pass",
    required: true,
    detail: "Maintainer GitHub handles are unique."
  });
}

function addUpstreamCheck(checks: VerificationCheck[], manifest: ThankManifest) {
  if (manifest.splits.upstream === 0) {
    checks.push({
      id: "upstream-policy",
      label: "Upstream funding",
      status: "warn",
      required: false,
      detail: "No upstream funding split is configured.",
      action: "THANK is most credible when some funding flows to upstream dependencies."
    });
    return;
  }

  checks.push({
    id: "upstream-policy",
    label: "Upstream funding",
    status: manifest.upstream.length > 0 ? "pass" : "fail",
    required: true,
    detail:
      manifest.upstream.length > 0
        ? `${manifest.upstream.length} upstream project(s) are declared.`
        : "splits.upstream is positive but no upstream projects are declared.",
    action: manifest.upstream.length > 0 ? undefined : "Add upstream entries or set splits.upstream to 0."
  });
}

function addSignedCommitCheck(
  checks: VerificationCheck[],
  manifest: ThankManifest,
  signedCommit: SignedCommitEvidence | undefined
) {
  const required = manifest.verification?.signed_commit === "required";

  if (!required && !signedCommit?.checked) {
    checks.push({
      id: "signed-commit",
      label: "Signed commit",
      status: "skip",
      required: false,
      detail: "Signed commit proof was not requested."
    });
    return;
  }

  if (signedCommit?.verified) {
    checks.push({
      id: "signed-commit",
      label: "Signed commit",
      status: "pass",
      required,
      detail: `git verify-commit passed for ${signedCommit.commit}.`
    });
    return;
  }

  checks.push({
    id: "signed-commit",
    label: "Signed commit",
    status: required ? "fail" : "warn",
    required,
    detail: signedCommit?.detail ?? "Signed commit proof was required but not checked.",
    action: "Sign the manifest commit and rerun thank verify --signed-commit."
  });
}

function addDnsCheck(
  checks: VerificationCheck[],
  manifest: ThankManifest,
  manifestHash: `0x${string}`,
  dnsProof: DnsProofEvidence | undefined
) {
  const required = manifest.verification?.dns_txt === "required";
  const expected = createExpectedDnsProof(manifest, manifestHash);

  if (!expected) {
    checks.push({
      id: "dns-txt",
      label: "DNS TXT proof",
      status: required ? "fail" : "skip",
      required,
      detail: "Manifest does not include a project.website hostname.",
      action: required ? "Add project.website or set verification.dns_txt to optional." : undefined
    });
    return;
  }

  if (!required && !dnsProof?.checked) {
    checks.push({
      id: "dns-txt",
      label: "DNS TXT proof",
      status: "skip",
      required: false,
      detail: `DNS proof was not requested. Expected TXT at ${expected.name}.`
    });
    return;
  }

  const matched = dnsProof?.records.some((record) => normalizeDnsRecord(record) === normalizeDnsRecord(expected.value));
  if (matched) {
    checks.push({
      id: "dns-txt",
      label: "DNS TXT proof",
      status: "pass",
      required,
      detail: `Matched ${expected.name}.`
    });
    return;
  }

  checks.push({
    id: "dns-txt",
    label: "DNS TXT proof",
    status: required ? "fail" : "warn",
    required,
    detail: dnsProof?.error
      ? `Could not verify ${expected.name}: ${dnsProof.error}`
      : `No matching TXT record found at ${expected.name}.`,
    action: `Publish TXT ${expected.name} with value: ${expected.value}`
  });
}

function computeVerificationLevel(checks: VerificationCheck[]): 0 | 1 | 2 | 3 {
  const hasGitHubProof = hasPassed(checks, "github-remote");
  if (!hasGitHubProof) {
    return 0;
  }

  if (hasPassed(checks, "dns-txt")) {
    return 3;
  }

  if (hasPassed(checks, "signed-commit")) {
    return 2;
  }

  return 1;
}

function hasPassed(checks: VerificationCheck[], id: string) {
  return checks.some((check) => check.id === id && check.status === "pass");
}

function collectNextActions(checks: VerificationCheck[]) {
  const actions: string[] = [];
  for (const check of checks) {
    if ((check.status === "fail" || check.status === "warn") && check.action && !actions.includes(check.action)) {
      actions.push(check.action);
    }
  }
  return actions;
}

function normalizeDnsRecord(record: string) {
  return record.trim().replace(/\s+/g, " ").toLowerCase();
}

function findDuplicates(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }

  return [...duplicates];
}

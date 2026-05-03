import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import type { ThankManifest } from "./types.js";

const ethereumAddress = /^0x[a-fA-F0-9]{40}$/;
const verificationMode = z.enum(["required", "optional", "none"]);

const manifestSchema = z.object({
  version: z.literal(1),
  project: z.object({
    name: z.string().min(1),
    repo: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
    website: z.string().url().optional(),
    description: z.string().min(1).optional()
  }),
  wallets: z.object({
    primary: z.object({
      address: z.string().regex(ethereumAddress),
      chains: z.array(z.string().min(1)).min(1)
    })
  }),
  maintainers: z
    .array(
      z.object({
        github: z.string().min(1),
        share: z.number().positive(),
        wallet: z.string().regex(ethereumAddress)
      })
    )
    .min(1),
  splits: z.object({
    maintainers: z.number().nonnegative(),
    upstream: z.number().nonnegative(),
    protocol: z.number().nonnegative()
  }),
  upstream: z.array(
    z.object({
      repo: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
      share: z.number().positive()
    })
  ),
  verification: z
    .object({
      github: verificationMode.optional(),
      signed_commit: verificationMode.optional(),
      dns_txt: verificationMode.optional()
    })
    .optional()
});

export interface ManifestValidationResult {
  valid: boolean;
  manifest?: ThankManifest;
  errors: string[];
  warnings: string[];
}

export function parseManifest(source: string): unknown {
  return YAML.parse(source);
}

export function validateManifestData(data: unknown): ManifestValidationResult {
  const parsed = manifestSchema.safeParse(data);

  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
      warnings: []
    };
  }

  const manifest = parsed.data;
  const errors: string[] = [];
  const warnings: string[] = [];

  const splitTotal = manifest.splits.maintainers + manifest.splits.upstream + manifest.splits.protocol;
  if (!nearlyEqual(splitTotal, 100)) {
    errors.push(`splits must total 100, received ${formatPercent(splitTotal)}`);
  }

  const maintainerTotal = manifest.maintainers.reduce((sum, maintainer) => sum + maintainer.share, 0);
  if (!nearlyEqual(maintainerTotal, 100)) {
    errors.push(`maintainer shares must total 100, received ${formatPercent(maintainerTotal)}`);
  }

  const upstreamTotal = manifest.upstream.reduce((sum, upstream) => sum + upstream.share, 0);
  if (manifest.upstream.length > 0 && !nearlyEqual(upstreamTotal, manifest.splits.upstream)) {
    errors.push(
      `upstream shares must total splits.upstream (${formatPercent(
        manifest.splits.upstream
      )}), received ${formatPercent(upstreamTotal)}`
    );
  }

  const duplicateRepos = findDuplicates(manifest.upstream.map((upstream) => upstream.repo.toLowerCase()));
  if (duplicateRepos.length > 0) {
    errors.push(`upstream contains duplicate repositories: ${duplicateRepos.join(", ")}`);
  }

  if (manifest.splits.protocol > 1) {
    warnings.push("protocol split is above 1%; keep protocol fees conservative for early adoption");
  }

  if (!manifest.verification || manifest.verification.github !== "required") {
    warnings.push("GitHub verification is not marked as required");
  }

  return {
    valid: errors.length === 0,
    manifest,
    errors,
    warnings
  };
}

export async function loadManifest(filePath: string): Promise<ManifestValidationResult> {
  const source = await readFile(filePath, "utf8");
  return validateManifestData(parseManifest(source));
}

export async function writeDefaultManifest(targetPath: string, options: Partial<ThankManifest> = {}) {
  const manifest = createDefaultManifest(options);
  await writeFile(targetPath, YAML.stringify(manifest), "utf8");
  return manifest;
}

export function createDefaultManifest(options: Partial<ThankManifest> = {}): ThankManifest {
  return {
    version: 1,
    project: {
      name: options.project?.name ?? path.basename(process.cwd()),
      repo: options.project?.repo ?? "owner/repository",
      website: options.project?.website ?? "https://example.org",
      description:
        options.project?.description ??
        "Open-source project using THANK Protocol recursive dependency funding."
    },
    wallets: {
      primary: {
        address:
          options.wallets?.primary.address ?? "0x0000000000000000000000000000000000000000",
        chains: options.wallets?.primary.chains ?? ["ethereum", "base", "optimism", "arbitrum"]
      }
    },
    maintainers: options.maintainers ?? [
      {
        github: "maintainer",
        share: 100,
        wallet: "0x1111111111111111111111111111111111111111"
      }
    ],
    splits: options.splits ?? {
      maintainers: 80,
      upstream: 19.5,
      protocol: 0.5
    },
    upstream: options.upstream ?? [
      {
        repo: "openssl/openssl",
        share: 10
      },
      {
        repo: "curl/curl",
        share: 5
      },
      {
        repo: "zlib-ng/zlib-ng",
        share: 4.5
      }
    ],
    verification: options.verification ?? {
      github: "required",
      signed_commit: "optional",
      dns_txt: "optional"
    }
  };
}

function nearlyEqual(left: number, right: number) {
  return Math.abs(left - right) < 0.0001;
}

function formatPercent(value: number) {
  return `${Number(value.toFixed(4))}%`;
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

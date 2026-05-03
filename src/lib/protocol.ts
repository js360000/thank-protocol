import { createHash } from "node:crypto";
import type { ThankManifest } from "./types.js";

export interface ManifestCommitment {
  projectId: `0x${string}`;
  manifestHash: `0x${string}`;
  canonicalManifest: string;
}

export function createManifestCommitment(manifest: ThankManifest): ManifestCommitment {
  const canonicalManifest = `${JSON.stringify(sortForCommitment(manifest))}\n`;

  return {
    projectId: hashBytes32(`thank:v1:project:${normalizeRepo(manifest.project.repo)}`),
    manifestHash: hashBytes32(canonicalManifest),
    canonicalManifest
  };
}

export function normalizeRepo(repo: string) {
  return repo.trim().toLowerCase();
}

function hashBytes32(value: string): `0x${string}` {
  return `0x${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function sortForCommitment(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForCommitment);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortForCommitment(item)])
    );
  }

  return value;
}

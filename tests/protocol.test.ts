import { describe, expect, it } from "vitest";
import { createDefaultManifest } from "../src/lib/manifest.js";
import { createManifestCommitment } from "../src/lib/protocol.js";

describe("protocol commitments", () => {
  it("creates stable bytes32 commitments for a manifest", () => {
    const manifest = createDefaultManifest({
      project: {
        name: "Example",
        repo: "Owner/Repo",
        website: "https://example.org",
        description: "Example project"
      }
    });

    const first = createManifestCommitment(manifest);
    const second = createManifestCommitment({
      ...manifest,
      project: {
        ...manifest.project,
        repo: "owner/repo"
      }
    });

    expect(first.projectId).toMatch(/^0x[a-f0-9]{64}$/);
    expect(first.manifestHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(first.projectId).toBe(second.projectId);
    expect(first.manifestHash).not.toBe(second.manifestHash);
  });
});

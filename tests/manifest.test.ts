import { describe, expect, it } from "vitest";
import { createDefaultManifest, validateManifestData } from "../src/lib/manifest.js";

describe("manifest validation", () => {
  it("accepts the default manifest", () => {
    const result = validateManifestData(createDefaultManifest());

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects split totals that do not equal 100", () => {
    const manifest = createDefaultManifest({
      splits: {
        maintainers: 80,
        upstream: 10,
        protocol: 0.5
      },
      upstream: [
        {
          repo: "vitejs/vite",
          share: 10
        }
      ]
    });

    const result = validateManifestData(manifest);

    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("splits must total 100");
  });

  it("rejects upstream split allocations without upstream entries", () => {
    const result = validateManifestData(
      createDefaultManifest({
        upstream: []
      })
    );

    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("upstream entries are required");
  });

  it("rejects duplicate maintainer GitHub handles", () => {
    const result = validateManifestData(
      createDefaultManifest({
        maintainers: [
          {
            github: "alice",
            share: 50,
            wallet: "0x1111111111111111111111111111111111111111"
          },
          {
            github: "Alice",
            share: 50,
            wallet: "0x2222222222222222222222222222222222222222"
          }
        ]
      })
    );

    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("duplicate GitHub handles");
  });
});

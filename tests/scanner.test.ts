import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadRegistry } from "../src/lib/registry.js";
import { scanProject } from "../src/lib/scanner.js";

describe("dependency scanner", () => {
  it("scans the sample project and resolves verified dependencies", async () => {
    const registry = await loadRegistry(path.resolve("registry/projects.json"));
    const scan = await scanProject(path.resolve("examples/sample-project"), { registry });

    expect(scan.totals.dependencies).toBeGreaterThan(8);
    expect(scan.totals.verified).toBeGreaterThanOrEqual(5);
    expect(scan.dependencies.some((dependency) => dependency.id === "npm:vite")).toBe(true);
    expect(scan.dependencies.find((dependency) => dependency.id === "npm:vite")?.verified).toBe(true);
    expect(scan.filesInspected).toContain("package.json");
  });
});

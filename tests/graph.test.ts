import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildFundingPlan } from "../src/lib/graph.js";
import { loadRegistry } from "../src/lib/registry.js";
import { scanProject } from "../src/lib/scanner.js";

describe("funding graph", () => {
  it("allocates the full requested amount across verified dependencies", async () => {
    const registry = await loadRegistry(path.resolve("registry/projects.json"));
    const scan = await scanProject(path.resolve("examples/sample-project"), { registry });
    const plan = buildFundingPlan(scan, {
      amount: 1000,
      currency: "USDC",
      strategy: "centrality"
    });

    expect(plan.allocations.length).toBeLessThan(scan.totals.verified);
    expect(plan.totals.allocated).toBe(1000);
    expect(plan.allocations.every((allocation) => allocation.amount > 0)).toBe(true);
    expect(plan.allocations.find((allocation) => allocation.repo === "facebook/react")?.dependencyIds).toEqual([
      "npm:react",
      "npm:react-dom"
    ]);
  });
});

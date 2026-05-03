import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import solc from "solc";
import { describe, expect, it } from "vitest";

describe("contract surface", () => {
  it("compiles and exposes the protocol router claim surface", async () => {
    const contractsDir = path.resolve("contracts/src");
    const files = (await readdir(contractsDir)).filter((file) => file.endsWith(".sol"));
    const sources = Object.fromEntries(
      await Promise.all(
        files.map(async (file) => [
          file,
          {
            content: await readFile(path.join(contractsDir, file), "utf8")
          }
        ])
      )
    );

    const output = JSON.parse(
      solc.compile(
        JSON.stringify({
          language: "Solidity",
          sources,
          settings: {
            outputSelection: {
              "*": {
                "*": ["abi"]
              }
            }
          }
        })
      )
    ) as {
      contracts?: Record<string, Record<string, { abi: Array<{ name?: string; type: string }> }>>;
      errors?: Array<{ severity: "error" | "warning"; formattedMessage: string }>;
    };

    expect(output.errors?.filter((diagnostic) => diagnostic.severity === "error") ?? []).toEqual([]);

    const routerAbi = output.contracts?.["ThankRouter.sol"]?.ThankRouter.abi ?? [];
    const routerNames = new Set(routerAbi.map((item) => item.name).filter(Boolean));

    expect(routerNames).toContain("fundNative");
    expect(routerNames).toContain("fundToken");
    expect(routerNames).toContain("claimNative");
    expect(routerNames).toContain("claimNativeFor");
    expect(routerNames).toContain("claimToken");
    expect(routerNames).toContain("claimTokenFor");
    expect(routerNames).toContain("AllocationQueued");
  });
});

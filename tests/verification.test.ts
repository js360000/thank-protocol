import { describe, expect, it } from "vitest";
import { createDefaultManifest, validateManifestData } from "../src/lib/manifest.js";
import { createManifestCommitment } from "../src/lib/protocol.js";
import { createExpectedDnsProof, createVerificationReport, normalizeGitHubRemote } from "../src/lib/verification.js";

const primaryWallet = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function verifiedManifest() {
  return createDefaultManifest({
    project: {
      name: "Example",
      repo: "Owner/Repo",
      website: "https://example.org",
      description: "Example project"
    },
    wallets: {
      primary: {
        address: primaryWallet,
        chains: ["base"]
      }
    }
  });
}

describe("verification reports", () => {
  it("normalizes common GitHub remote formats", () => {
    expect(normalizeGitHubRemote("git@github.com:Owner/Repo.git")).toBe("owner/repo");
    expect(normalizeGitHubRemote("https://github.com/Owner/Repo.git")).toBe("owner/repo");
    expect(normalizeGitHubRemote("ssh://git@github.com/Owner/Repo.git")).toBe("owner/repo");
  });

  it("marks a manifest registry-ready after local GitHub proof and wallet hygiene checks pass", () => {
    const validation = validateManifestData(verifiedManifest());
    const report = createVerificationReport(validation, {
      gitRemote: "git@github.com:owner/repo.git"
    });

    expect(report.readyForRegistry).toBe(true);
    expect(report.level).toBe(1);
    expect(report.checks.filter((check) => check.required && check.status === "fail")).toEqual([]);
  });

  it("fails registry readiness when payout wallets are zero addresses", () => {
    const validation = validateManifestData(
      createDefaultManifest({
        project: {
          name: "Example",
          repo: "owner/repo",
          website: "https://example.org",
          description: "Example project"
        }
      })
    );
    const report = createVerificationReport(validation, {
      gitRemote: "https://github.com/owner/repo.git"
    });

    expect(report.readyForRegistry).toBe(false);
    expect(report.checks.find((check) => check.id === "primary-wallet")?.status).toBe("fail");
  });

  it("bumps verification level when DNS TXT proof matches the manifest commitment", () => {
    const manifest = verifiedManifest();
    const validation = validateManifestData(manifest);
    const proof = createExpectedDnsProof(manifest, createManifestCommitment(manifest).manifestHash);
    expect(proof).toBeDefined();

    const report = createVerificationReport(validation, {
      gitRemote: "https://github.com/owner/repo.git",
      dnsProof: {
        checked: true,
        recordName: proof?.name,
        records: [proof?.value ?? ""]
      }
    });

    expect(report.readyForRegistry).toBe(true);
    expect(report.level).toBe(3);
    expect(report.checks.find((check) => check.id === "dns-txt")?.status).toBe("pass");
  });
});

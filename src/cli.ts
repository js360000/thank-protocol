#!/usr/bin/env node
import { execFile } from "node:child_process";
import { resolveTxt } from "node:dns/promises";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { Command } from "commander";
import { table } from "table";
import YAML from "yaml";
import { buildFundingPlan, createReceiptId } from "./lib/graph.js";
import { createDefaultManifest, loadManifest, writeDefaultManifest } from "./lib/manifest.js";
import { createManifestCommitment } from "./lib/protocol.js";
import { loadRegistry } from "./lib/registry.js";
import { scanProject } from "./lib/scanner.js";
import {
  createExpectedDnsProof,
  createVerificationReport,
  type DnsProofEvidence,
  type SignedCommitEvidence,
  type VerificationReport,
  type VerificationStatus
} from "./lib/verification.js";
import type { FundingReceipt, FundingStrategy, RegistryFile, ThankManifest } from "./lib/types.js";

const program = new Command();
const execFileAsync = promisify(execFile);

program
  .name("thank")
  .description("THANK Protocol tools for recursive open-source dependency funding.")
  .version("0.1.0");

program
  .command("init")
  .description("Create a thank.yaml funding manifest in the current directory.")
  .option("--force", "overwrite an existing thank.yaml")
  .option("--repo <owner/repo>", "GitHub repository slug")
  .option("--name <name>", "project display name")
  .action(async (options: { force?: boolean; repo?: string; name?: string }) => {
    const target = path.resolve("thank.yaml");
    if (!options.force && (await exists(target))) {
      fail("thank.yaml already exists. Use --force to overwrite it.");
    }

    const manifest = await writeDefaultManifest(target, {
      project: {
        ...createDefaultManifest().project,
        repo: options.repo ?? createDefaultManifest().project.repo,
        name: options.name ?? createDefaultManifest().project.name
      }
    });

    console.log(`Created ${path.relative(process.cwd(), target)}`);
    console.log(`Project: ${manifest.project.repo}`);
  });

program
  .command("validate")
  .description("Validate a THANK funding manifest.")
  .argument("[manifest]", "manifest path", "thank.yaml")
  .option("--json", "print machine-readable output")
  .action(async (manifestPath: string, options: { json?: boolean }) => {
    const result = await loadManifest(path.resolve(manifestPath));

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.valid ? 0 : 1;
      return;
    }

    if (result.valid) {
      console.log("Manifest is valid.");
    } else {
      console.error("Manifest is invalid.");
      for (const error of result.errors) {
        console.error(`- ${error}`);
      }
      process.exitCode = 1;
    }

    for (const warning of result.warnings) {
      console.warn(`warning: ${warning}`);
    }
  });

program
  .command("scan")
  .description("Scan a local project for dependency funding metadata.")
  .argument("[project]", "project directory", ".")
  .option("--registry <path>", "registry JSON path", "registry/projects.json")
  .option("--json", "print machine-readable output")
  .option("--out <path>", "write scan JSON to a file")
  .action(async (project: string, options: { registry: string; json?: boolean; out?: string }) => {
    const registry = await loadRegistryIfPresent(options.registry);
    const scan = await scanProject(project, { registry });

    await maybeWriteJson(options.out, scan);

    if (options.json) {
      console.log(JSON.stringify(scan, null, 2));
      return;
    }

    printScanSummary(scan);
  });

program
  .command("graph")
  .description("Build a dependency funding plan for a local project.")
  .argument("[project]", "project directory", ".")
  .option("--amount <amount>", "funding amount", parseNumber, 1000)
  .option("--currency <currency>", "funding currency", "USDC")
  .option("--strategy <strategy>", "equal, direct-weighted, or centrality", "centrality")
  .option("--registry <path>", "registry JSON path", "registry/projects.json")
  .option("--json", "print machine-readable output")
  .option("--out <path>", "write funding plan JSON to a file")
  .action(
    async (
      project: string,
      options: {
        amount: number;
        currency: string;
        strategy: FundingStrategy;
        registry: string;
        json?: boolean;
        out?: string;
      }
    ) => {
      assertStrategy(options.strategy);
      const registry = await loadRegistryIfPresent(options.registry);
      const scan = await scanProject(project, { registry });
      const plan = buildFundingPlan(scan, {
        amount: options.amount,
        currency: options.currency,
        strategy: options.strategy
      });

      await maybeWriteJson(options.out, plan);

      if (options.json) {
        console.log(JSON.stringify(plan, null, 2));
        return;
      }

      printFundingPlan(plan);
    }
  );

program
  .command("fund")
  .description("Create an auditable offline funding receipt for a dependency funding plan.")
  .argument("[project]", "project directory", ".")
  .requiredOption("--amount <amount>", "funding amount", parseNumber)
  .option("--currency <currency>", "funding currency", "USDC")
  .option("--strategy <strategy>", "equal, direct-weighted, or centrality", "centrality")
  .option("--registry <path>", "registry JSON path", "registry/projects.json")
  .option("--donor <name>", "donor display name")
  .option("--message <message>", "optional public message")
  .option("--receipt <path>", "write receipt JSON to a file", "receipts/thank-receipt.json")
  .option("--json", "print machine-readable output")
  .action(
    async (
      project: string,
      options: {
        amount: number;
        currency: string;
        strategy: FundingStrategy;
        registry: string;
        donor?: string;
        message?: string;
        receipt: string;
        json?: boolean;
      }
    ) => {
      assertStrategy(options.strategy);
      const registry = await loadRegistryIfPresent(options.registry);
      const scan = await scanProject(project, { registry });
      const plan = buildFundingPlan(scan, {
        amount: options.amount,
        currency: options.currency,
        strategy: options.strategy
      });
      const generatedAt = new Date().toISOString();
      const receipt: FundingReceipt = {
        id: createReceiptId(scan.root, generatedAt),
        generatedAt,
        donor: options.donor,
        message: options.message,
        project: scan.root,
        amount: options.amount,
        currency: options.currency,
        transactionReference: null,
        mode: "offline-plan",
        allocations: plan.allocations
      };

      await maybeWriteJson(options.receipt, receipt);

      if (options.json) {
        console.log(JSON.stringify(receipt, null, 2));
        return;
      }

      printFundingPlan(plan);
      console.log(`Receipt written to ${options.receipt}`);
    }
  );

program
  .command("badge")
  .description("Print a Markdown badge for a THANK-enabled project.")
  .argument("[manifest]", "manifest path", "thank.yaml")
  .option("--host <url>", "dashboard host", "https://thank.dev")
  .action(async (manifestPath: string, options: { host: string }) => {
    const result = await loadManifest(path.resolve(manifestPath));
    if (!result.valid || !result.manifest) {
      fail("Manifest is invalid. Run thank validate for details.");
    }
    const repo = result.manifest.project.repo;
    const encoded = encodeURIComponent(repo);
    console.log(
      `[![Funded by THANK](${options.host.replace(/\/$/, "")}/badge/${encoded})](${options.host.replace(
        /\/$/,
        ""
      )}/projects/${encoded})`
    );
  });

program
  .command("commit")
  .description("Create deterministic protocol identifiers for a THANK manifest.")
  .argument("[manifest]", "manifest path", "thank.yaml")
  .option("--json", "print machine-readable output")
  .action(async (manifestPath: string, options: { json?: boolean }) => {
    const result = await loadManifest(path.resolve(manifestPath));
    if (!result.valid || !result.manifest) {
      fail("Manifest is invalid. Run thank validate for details.");
    }

    const commitment = createManifestCommitment(result.manifest);

    if (options.json) {
      console.log(JSON.stringify(commitment, null, 2));
      return;
    }

    console.log(`Project: ${result.manifest.project.repo}`);
    console.log(`Project ID: ${commitment.projectId}`);
    console.log(`Manifest hash: ${commitment.manifestHash}`);
  });

program
  .command("verify")
  .description("Build a maintainer trust report for a THANK manifest.")
  .argument("[manifest]", "manifest path", "thank.yaml")
  .option("--repo-url <url>", "override the git remote URL used for GitHub ownership proof")
  .option("--dns", "resolve and verify the manifest DNS TXT proof")
  .option("--signed-commit", "verify a signed git commit proof")
  .option("--commit <ref>", "git commit ref used with --signed-commit", "HEAD")
  .option("--json", "print machine-readable output")
  .action(
    async (
      manifestPath: string,
      options: {
        repoUrl?: string;
        dns?: boolean;
        signedCommit?: boolean;
        commit: string;
        json?: boolean;
      }
    ) => {
      const resolvedManifestPath = path.resolve(manifestPath);
      const result = await loadManifest(resolvedManifestPath);
      const manifest = result.manifest;
      const gitRemote = options.repoUrl ?? (await getGitRemote());
      const dnsRequired = manifest?.verification?.dns_txt === "required";
      const signedCommitRequired = manifest?.verification?.signed_commit === "required";
      const dnsProof = manifest && (options.dns || dnsRequired) ? await lookupDnsProof(manifest) : undefined;
      const signedCommit =
        options.signedCommit || signedCommitRequired ? await verifySignedCommit(options.commit) : undefined;
      const report = createVerificationReport(result, {
        manifestPath: path.relative(process.cwd(), resolvedManifestPath),
        gitRemote,
        dnsProof,
        signedCommit
      });

      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
        process.exitCode = report.readyForRegistry ? 0 : 1;
        return;
      }

      printVerificationReport(report);
      process.exitCode = report.readyForRegistry ? 0 : 1;
    }
  );

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  fail(message);
});

async function loadRegistryIfPresent(registryPath: string): Promise<RegistryFile | undefined> {
  try {
    return await loadRegistry(path.resolve(registryPath));
  } catch {
    return undefined;
  }
}

function printScanSummary(scan: Awaited<ReturnType<typeof scanProject>>) {
  console.log(`Scanned: ${scan.root}`);
  console.log(`Files inspected: ${scan.filesInspected.length}`);
  console.log(
    `Dependencies: ${scan.totals.dependencies} (${scan.totals.verified} verified, ${scan.totals.missingFunding} missing funding metadata)`
  );
  console.log("");
  console.log(
    table([
      ["Ecosystem", "Count"],
      ...Object.entries(scan.ecosystems)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([ecosystem, count]) => [ecosystem, String(count)])
    ])
  );
}

function printFundingPlan(plan: ReturnType<typeof buildFundingPlan>) {
  console.log(`Funding plan for ${plan.root}`);
  console.log(`Amount: ${plan.amount.toLocaleString()} ${plan.currency}`);
  console.log(`Strategy: ${plan.strategy}`);
  console.log("");

  if (plan.allocations.length === 0) {
    console.log("No verified dependencies were found.");
    return;
  }

  console.log(
    table([
      ["Dependency", "Repo", "Amount", "Share"],
      ...plan.allocations.map((allocation) => [
        `${allocation.ecosystem}:${allocation.name}`,
        allocation.repo,
        `${allocation.amount.toLocaleString()} ${allocation.currency}`,
        `${(allocation.shareBps / 100).toFixed(2)}%`
      ])
    ])
  );
  console.log(`${plan.totals.unfundedDependencies} dependencies did not have verified funding metadata.`);
}

function printVerificationReport(report: VerificationReport) {
  console.log(`THANK verification report for ${report.manifest.repo}`);
  if (report.manifest.path) {
    console.log(`Manifest: ${report.manifest.path}`);
  }
  if (report.gitRemote) {
    console.log(`Git remote: ${report.gitRemote}`);
  }
  console.log(`Project ID: ${report.projectId}`);
  console.log(`Manifest hash: ${report.manifestHash}`);
  console.log(`Verification level: ${report.level}`);
  console.log(`Registry ready: ${report.readyForRegistry ? "yes" : "no"}`);
  console.log("");

  console.log(
    table([
      ["Status", "Check", "Required", "Detail"],
      ...report.checks.map((check) => [
        formatVerificationStatus(check.status),
        check.label,
        check.required ? "yes" : "no",
        check.detail
      ])
    ])
  );

  if (report.expectedDnsProof) {
    console.log("DNS proof:");
    console.log(`${report.expectedDnsProof.name} TXT "${report.expectedDnsProof.value}"`);
    console.log("");
  }

  if (report.nextActions.length > 0) {
    console.log("Next actions:");
    for (const action of report.nextActions) {
      console.log(`- ${action}`);
    }
  }
}

function formatVerificationStatus(status: VerificationStatus) {
  switch (status) {
    case "pass":
      return "PASS";
    case "warn":
      return "WARN";
    case "fail":
      return "FAIL";
    case "skip":
      return "SKIP";
  }
}

async function maybeWriteJson(target: string | undefined, value: unknown) {
  if (!target) {
    return;
  }
  await mkdir(path.dirname(path.resolve(target)), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseNumber(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive number, received ${value}`);
  }
  return parsed;
}

function assertStrategy(value: string): asserts value is FundingStrategy {
  if (!["equal", "direct-weighted", "centrality"].includes(value)) {
    throw new Error(`Unknown strategy "${value}". Use equal, direct-weighted, or centrality.`);
  }
}

async function getGitRemote() {
  const gitConfig = path.resolve(".git/config");
  try {
    const source = await readFile(gitConfig, "utf8");
    return source.match(/\[remote "origin"\][\s\S]*?\n\s*url = (.+)/)?.[1].trim();
  } catch {
    return undefined;
  }
}

async function lookupDnsProof(manifest: ThankManifest): Promise<DnsProofEvidence> {
  const expected = createExpectedDnsProof(manifest, createManifestCommitment(manifest).manifestHash);
  if (!expected) {
    return {
      checked: true,
      records: [],
      error: "manifest has no project.website hostname"
    };
  }

  try {
    const records = (await resolveTxt(expected.name)).map((parts) => parts.join(""));
    return {
      checked: true,
      recordName: expected.name,
      records
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      checked: true,
      recordName: expected.name,
      records: [],
      error: message
    };
  }
}

async function verifySignedCommit(commit: string): Promise<SignedCommitEvidence> {
  try {
    await execFileAsync("git", ["verify-commit", commit], { cwd: process.cwd() });
    return {
      checked: true,
      commit,
      verified: true
    };
  } catch (error) {
    const detail =
      typeof error === "object" && error && "stderr" in error && typeof error.stderr === "string"
        ? error.stderr.trim()
        : error instanceof Error
          ? error.message
          : String(error);
    return {
      checked: true,
      commit,
      verified: false,
      detail: detail || `git verify-commit failed for ${commit}`
    };
  }
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

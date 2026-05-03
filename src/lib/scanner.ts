import { readFile } from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import { XMLParser } from "fast-xml-parser";
import { parse as parseToml } from "smol-toml";
import YAML from "yaml";
import type { DependencyRecord, DependencyRelationship, DependencyScan, RegistryFile } from "./types.js";
import { buildRegistryIndex } from "./registry.js";

interface RawDependency {
  id: string;
  name: string;
  ecosystem: string;
  version?: string;
  relationship: DependencyRelationship;
  sourceFile: string;
}

export interface ScanOptions {
  registry?: RegistryFile;
}

export async function scanProject(root: string, options: ScanOptions = {}): Promise<DependencyScan> {
  const resolvedRoot = path.resolve(root);
  const files = await fg(
    [
      "package.json",
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
      "requirements*.txt",
      "pyproject.toml",
      "Cargo.toml",
      "Cargo.lock",
      "go.mod",
      "composer.json",
      "Gemfile",
      "pom.xml",
      "**/*.csproj",
      "Dockerfile",
      ".github/workflows/*.{yml,yaml}"
    ],
    {
      cwd: resolvedRoot,
      dot: true,
      onlyFiles: true,
      ignore: ["**/node_modules/**", "**/vendor/**", "**/dist/**", "**/build/**", "**/.git/**"]
    }
  );

  const rawDependencies: RawDependency[] = [];

  for (const relativeFile of files.sort()) {
    const absoluteFile = path.join(resolvedRoot, relativeFile);
    const source = await safeRead(absoluteFile);
    if (!source) {
      continue;
    }

    rawDependencies.push(...parseFile(relativeFile, source));
  }

  const registryIndex = options.registry ? buildRegistryIndex(options.registry) : undefined;
  const dependencies = mergeDependencies(rawDependencies).map((dependency) => {
    const registryProject = registryIndex?.lookupPackage(dependency.id);

    return {
      ...dependency,
      verified: Boolean(registryProject),
      repo: registryProject?.repo,
      verificationLevel: registryProject?.verificationLevel,
      fundingManifest: registryProject?.manifest
    };
  });

  const ecosystems = dependencies.reduce<Record<string, number>>((counts, dependency) => {
    counts[dependency.ecosystem] = (counts[dependency.ecosystem] ?? 0) + 1;
    return counts;
  }, {});

  return {
    root: resolvedRoot,
    scannedAt: new Date().toISOString(),
    dependencies,
    ecosystems,
    filesInspected: files,
    totals: {
      dependencies: dependencies.length,
      direct: dependencies.filter((dependency) =>
        ["direct", "runtime", "development"].includes(dependency.relationship)
      ).length,
      transitive: dependencies.filter((dependency) => dependency.relationship === "transitive").length,
      verified: dependencies.filter((dependency) => dependency.verified).length,
      missingFunding: dependencies.filter((dependency) => !dependency.verified).length
    }
  };
}

function parseFile(relativeFile: string, source: string): RawDependency[] {
  const normalized = relativeFile.replaceAll("\\", "/");
  const basename = path.basename(normalized);

  try {
    if (basename === "package.json") {
      return parsePackageJson(normalized, source);
    }
    if (basename === "package-lock.json") {
      return parsePackageLock(normalized, source);
    }
    if (basename === "pnpm-lock.yaml") {
      return parsePnpmLock(normalized, source);
    }
    if (basename === "yarn.lock") {
      return parseYarnLock(normalized, source);
    }
    if (basename.startsWith("requirements") && basename.endsWith(".txt")) {
      return parseRequirements(normalized, source);
    }
    if (basename === "pyproject.toml") {
      return parsePyproject(normalized, source);
    }
    if (basename === "Cargo.toml") {
      return parseCargoToml(normalized, source);
    }
    if (basename === "Cargo.lock") {
      return parseCargoLock(normalized, source);
    }
    if (basename === "go.mod") {
      return parseGoMod(normalized, source);
    }
    if (basename === "composer.json") {
      return parseComposer(normalized, source);
    }
    if (basename === "Gemfile") {
      return parseGemfile(normalized, source);
    }
    if (basename === "pom.xml") {
      return parsePom(normalized, source);
    }
    if (basename.endsWith(".csproj")) {
      return parseCsproj(normalized, source);
    }
    if (basename === "Dockerfile") {
      return parseDockerfile(normalized, source);
    }
    if (normalized.startsWith(".github/workflows/")) {
      return parseGitHubWorkflow(normalized, source);
    }
  } catch {
    return [];
  }

  return [];
}

function parsePackageJson(sourceFile: string, source: string): RawDependency[] {
  const json = JSON.parse(source) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
  };

  return [
    ...objectDependencies("npm", json.dependencies, "runtime", sourceFile),
    ...objectDependencies("npm", json.devDependencies, "development", sourceFile),
    ...objectDependencies("npm", json.peerDependencies, "direct", sourceFile),
    ...objectDependencies("npm", json.optionalDependencies, "direct", sourceFile)
  ];
}

function parsePackageLock(sourceFile: string, source: string): RawDependency[] {
  const json = JSON.parse(source) as {
    packages?: Record<string, { version?: string }>;
    dependencies?: Record<string, { version?: string }>;
  };
  const dependencies: RawDependency[] = [];

  if (json.packages) {
    for (const [packagePath, value] of Object.entries(json.packages)) {
      if (!packagePath.startsWith("node_modules/")) {
        continue;
      }
      const name = packagePath.replace(/^node_modules\//, "");
      dependencies.push(createDependency("npm", name, value.version, "transitive", sourceFile));
    }
  }

  if (dependencies.length === 0 && json.dependencies) {
    for (const [name, value] of Object.entries(json.dependencies)) {
      dependencies.push(createDependency("npm", name, value.version, "transitive", sourceFile));
    }
  }

  return dependencies;
}

function parsePnpmLock(sourceFile: string, source: string): RawDependency[] {
  const parsed = YAML.parse(source) as {
    importers?: Record<string, Record<string, unknown>>;
    packages?: Record<string, unknown>;
  };
  const dependencies: RawDependency[] = [];

  for (const importer of Object.values(parsed.importers ?? {})) {
    for (const section of ["dependencies", "devDependencies", "optionalDependencies"] as const) {
      const group = importer[section] as Record<string, { version?: string } | string> | undefined;
      for (const [name, value] of Object.entries(group ?? {})) {
        dependencies.push(
          createDependency(
            "npm",
            name,
            typeof value === "string" ? value : value.version,
            section === "devDependencies" ? "development" : "runtime",
            sourceFile
          )
        );
      }
    }
  }

  for (const packageKey of Object.keys(parsed.packages ?? {})) {
    const name = packageKey.replace(/^\/?(@[^/]+\/[^/]+|[^/@]+).*/, "$1");
    if (name) {
      dependencies.push(createDependency("npm", name, undefined, "transitive", sourceFile));
    }
  }

  return dependencies;
}

function parseYarnLock(sourceFile: string, source: string): RawDependency[] {
  const dependencies: RawDependency[] = [];
  const entryPattern = /^("?(@?[^@\n",]+(?:\/[^@\n",]+)?)[^:\n]*"?:)$/gm;
  let match: RegExpExecArray | null;

  while ((match = entryPattern.exec(source)) !== null) {
    const name = match[2].replace(/^npm:/, "");
    if (!name.includes(" ")) {
      dependencies.push(createDependency("npm", name, undefined, "transitive", sourceFile));
    }
  }

  return dependencies;
}

function parseRequirements(sourceFile: string, source: string): RawDependency[] {
  return source
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, "").trim())
    .filter((line) => line && !line.startsWith("-"))
    .map((line) => {
      const [, name, version] = line.match(/^([A-Za-z0-9_.-]+)(?:\[.*\])?\s*(?:==|>=|<=|~=|>|<)?\s*([^;\s]+)?/) ?? [];
      return name ? createDependency("pypi", normalizePythonName(name), version, "runtime", sourceFile) : undefined;
    })
    .filter(isDependency);
}

function parsePyproject(sourceFile: string, source: string): RawDependency[] {
  const parsed = parseToml(source) as {
    project?: { dependencies?: string[]; optionalDependencies?: Record<string, string[]> };
    tool?: { poetry?: { dependencies?: Record<string, unknown>; group?: Record<string, { dependencies?: Record<string, unknown> }> } };
  };
  const dependencies: RawDependency[] = [];

  for (const dependency of parsed.project?.dependencies ?? []) {
    const dep = pythonDependencyFromSpec(dependency, sourceFile, "runtime");
    if (dep) {
      dependencies.push(dep);
    }
  }

  for (const group of Object.values(parsed.project?.optionalDependencies ?? {})) {
    for (const dependency of group) {
      const dep = pythonDependencyFromSpec(dependency, sourceFile, "development");
      if (dep) {
        dependencies.push(dep);
      }
    }
  }

  for (const [name, version] of Object.entries(parsed.tool?.poetry?.dependencies ?? {})) {
    if (name.toLowerCase() !== "python") {
      dependencies.push(createDependency("pypi", normalizePythonName(name), String(version), "runtime", sourceFile));
    }
  }

  for (const group of Object.values(parsed.tool?.poetry?.group ?? {})) {
    for (const [name, version] of Object.entries(group.dependencies ?? {})) {
      dependencies.push(createDependency("pypi", normalizePythonName(name), String(version), "development", sourceFile));
    }
  }

  return dependencies;
}

function parseCargoToml(sourceFile: string, source: string): RawDependency[] {
  const parsed = parseToml(source) as Record<string, unknown>;
  const dependencies: RawDependency[] = [];

  for (const sectionName of ["dependencies", "dev-dependencies", "build-dependencies"]) {
    const section = parsed[sectionName] as Record<string, string | { version?: string }> | undefined;
    for (const [name, value] of Object.entries(section ?? {})) {
      dependencies.push(
        createDependency(
          "cargo",
          name,
          typeof value === "string" ? value : value.version,
          sectionName === "dev-dependencies" ? "development" : "runtime",
          sourceFile
        )
      );
    }
  }

  return dependencies;
}

function parseCargoLock(sourceFile: string, source: string): RawDependency[] {
  const parsed = parseToml(source) as { package?: Array<{ name?: string; version?: string }> };
  return (parsed.package ?? [])
    .map((dependency) =>
      dependency.name
        ? createDependency("cargo", dependency.name, dependency.version, "transitive", sourceFile)
        : undefined
    )
    .filter(isDependency);
}

function parseGoMod(sourceFile: string, source: string): RawDependency[] {
  const dependencies: RawDependency[] = [];
  let inRequireBlock = false;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.replace(/\/\/.*/, "").trim();
    if (!line) {
      continue;
    }
    if (line === "require (") {
      inRequireBlock = true;
      continue;
    }
    if (inRequireBlock && line === ")") {
      inRequireBlock = false;
      continue;
    }
    if (line.startsWith("require ")) {
      const [, name, version] = line.match(/^require\s+(\S+)\s+(\S+)/) ?? [];
      if (name) {
        dependencies.push(createDependency("go", name, version, "runtime", sourceFile));
      }
      continue;
    }
    if (inRequireBlock) {
      const [, name, version] = line.match(/^(\S+)\s+(\S+)/) ?? [];
      if (name) {
        dependencies.push(createDependency("go", name, version, line.includes("indirect") ? "transitive" : "runtime", sourceFile));
      }
    }
  }

  return dependencies;
}

function parseComposer(sourceFile: string, source: string): RawDependency[] {
  const json = JSON.parse(source) as { require?: Record<string, string>; "require-dev"?: Record<string, string> };
  return [
    ...objectDependencies("composer", omitPlatformPackages(json.require), "runtime", sourceFile),
    ...objectDependencies("composer", omitPlatformPackages(json["require-dev"]), "development", sourceFile)
  ];
}

function parseGemfile(sourceFile: string, source: string): RawDependency[] {
  const dependencies: RawDependency[] = [];
  const gemPattern = /^\s*gem\s+["']([^"']+)["'](?:,\s*["']([^"']+)["'])?/gm;
  let match: RegExpExecArray | null;

  while ((match = gemPattern.exec(source)) !== null) {
    dependencies.push(createDependency("rubygems", match[1], match[2], "runtime", sourceFile));
  }

  return dependencies;
}

function parsePom(sourceFile: string, source: string): RawDependency[] {
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(source) as {
    project?: {
      dependencies?: { dependency?: unknown };
    };
  };
  const dependencies = toArray(parsed.project?.dependencies?.dependency) as Array<{
    groupId?: string;
    artifactId?: string;
    version?: string;
    scope?: string;
  }>;

  return dependencies
    .map((dependency) =>
      dependency.groupId && dependency.artifactId
        ? createDependency(
            "maven",
            `${dependency.groupId}:${dependency.artifactId}`,
            dependency.version,
            dependency.scope === "test" ? "development" : "runtime",
            sourceFile
          )
        : undefined
    )
    .filter(isDependency);
}

function parseCsproj(sourceFile: string, source: string): RawDependency[] {
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(source) as {
    Project?: {
      ItemGroup?: unknown;
    };
  };
  const groups = toArray(parsed.Project?.ItemGroup) as Array<{ PackageReference?: unknown }>;
  const dependencies: RawDependency[] = [];

  for (const group of groups) {
    for (const reference of toArray(group.PackageReference) as Array<Record<string, string>>) {
      const name = reference["@_Include"] ?? reference["@_Update"];
      const version = reference["@_Version"] ?? reference.Version;
      if (name) {
        dependencies.push(createDependency("nuget", name, version, "runtime", sourceFile));
      }
    }
  }

  return dependencies;
}

function parseDockerfile(sourceFile: string, source: string): RawDependency[] {
  return source
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*FROM\s+([^\s]+)(?:\s+AS\s+\S+)?/i)?.[1])
    .filter((image): image is string => Boolean(image))
    .map((image) => createDependency("docker", image.split("@")[0], undefined, "runtime", sourceFile));
}

function parseGitHubWorkflow(sourceFile: string, source: string): RawDependency[] {
  const parsed = YAML.parse(source) as {
    jobs?: Record<string, { steps?: Array<{ uses?: string }> }>;
  };
  const dependencies: RawDependency[] = [];

  for (const job of Object.values(parsed.jobs ?? {})) {
    for (const step of job.steps ?? []) {
      if (step.uses) {
        dependencies.push(createDependency("github-action", step.uses, undefined, "runtime", sourceFile));
      }
    }
  }

  return dependencies;
}

function mergeDependencies(dependencies: RawDependency[]): DependencyRecord[] {
  const merged = new Map<string, DependencyRecord>();

  for (const dependency of dependencies) {
    const existing = merged.get(dependency.id);
    if (!existing) {
      merged.set(dependency.id, {
        ...dependency,
        sourceCount: 1,
        verified: false
      });
      continue;
    }

    existing.sourceCount += 1;
    existing.sourceFile = existing.sourceFile.includes(dependency.sourceFile)
      ? existing.sourceFile
      : `${existing.sourceFile}, ${dependency.sourceFile}`;
    existing.version = existing.version ?? dependency.version;
    existing.relationship = strongestRelationship(existing.relationship, dependency.relationship);
  }

  return [...merged.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function objectDependencies(
  ecosystem: string,
  dependencies: Record<string, string> | undefined,
  relationship: DependencyRelationship,
  sourceFile: string
) {
  return Object.entries(dependencies ?? {}).map(([name, version]) =>
    createDependency(ecosystem, name, version, relationship, sourceFile)
  );
}

function createDependency(
  ecosystem: string,
  name: string,
  version: string | undefined,
  relationship: DependencyRelationship,
  sourceFile: string
): RawDependency {
  const normalizedName = ecosystem === "pypi" ? normalizePythonName(name) : name;
  return {
    id: `${ecosystem}:${normalizedName}`.toLowerCase(),
    name: normalizedName,
    ecosystem,
    version,
    relationship,
    sourceFile
  };
}

function pythonDependencyFromSpec(spec: string, sourceFile: string, relationship: DependencyRelationship) {
  const [, name, version] =
    spec.match(/^([A-Za-z0-9_.-]+)(?:\[.*\])?\s*(?:==|>=|<=|~=|>|<)?\s*([^;\s]+)?/) ?? [];
  return name ? createDependency("pypi", normalizePythonName(name), version, relationship, sourceFile) : undefined;
}

function normalizePythonName(name: string) {
  return name.toLowerCase().replaceAll("_", "-");
}

function omitPlatformPackages(dependencies: Record<string, string> | undefined) {
  return Object.fromEntries(
    Object.entries(dependencies ?? {}).filter(([name]) => !["php", "ext-", "lib-"].some((prefix) => name.startsWith(prefix)))
  );
}

function strongestRelationship(
  left: DependencyRelationship,
  right: DependencyRelationship
): DependencyRelationship {
  const order: DependencyRelationship[] = ["transitive", "development", "direct", "runtime"];
  return order.indexOf(right) > order.indexOf(left) ? right : left;
}

function toArray(value: unknown): unknown[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function isDependency(value: RawDependency | undefined): value is RawDependency {
  return Boolean(value);
}

async function safeRead(filePath: string) {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
}

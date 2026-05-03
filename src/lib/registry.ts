import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RegistryFile, RegistryProject } from "./types.js";

export async function loadRegistry(registryPath = path.resolve("registry/projects.json")) {
  const source = await readFile(registryPath, "utf8");
  return JSON.parse(source) as RegistryFile;
}

export function buildRegistryIndex(registry: RegistryFile) {
  const byPackage = new Map<string, RegistryProject>();
  const byRepo = new Map<string, RegistryProject>();

  for (const project of registry.projects) {
    byRepo.set(project.repo.toLowerCase(), project);
    for (const packageId of project.packages) {
      byPackage.set(packageId.toLowerCase(), project);
    }
  }

  return {
    byPackage,
    byRepo,
    lookupPackage(packageId: string) {
      return byPackage.get(packageId.toLowerCase());
    },
    lookupRepo(repo: string) {
      return byRepo.get(repo.toLowerCase());
    }
  };
}

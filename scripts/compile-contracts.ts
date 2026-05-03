import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import solc from "solc";

const contractsDir = path.resolve("contracts/src");
const artifactsDir = path.resolve("contracts/artifacts");
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

const input = {
  language: "Solidity",
  sources,
  settings: {
    evmVersion: "shanghai",
    optimizer: {
      enabled: true,
      runs: 200
    },
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode.object"]
      }
    }
  }
};

const output = JSON.parse(solc.compile(JSON.stringify(input))) as {
  contracts?: Record<string, Record<string, unknown>>;
  errors?: Array<{ severity: "error" | "warning"; formattedMessage: string }>;
};

for (const diagnostic of output.errors ?? []) {
  const stream = diagnostic.severity === "error" ? process.stderr : process.stdout;
  stream.write(`${diagnostic.formattedMessage}\n`);
}

const hasErrors = (output.errors ?? []).some((diagnostic) => diagnostic.severity === "error");
if (hasErrors) {
  process.exit(1);
}

await mkdir(artifactsDir, { recursive: true });

for (const [sourceName, contracts] of Object.entries(output.contracts ?? {})) {
  for (const [contractName, artifact] of Object.entries(contracts)) {
    const artifactPath = path.join(artifactsDir, `${contractName}.json`);
    const artifactObject = artifact as Record<string, unknown>;
    await writeFile(
      artifactPath,
      `${JSON.stringify({ sourceName, contractName, ...artifactObject }, null, 2)}\n`,
      "utf8"
    );
  }
}

console.log(`Compiled ${files.length} Solidity files into ${path.relative(process.cwd(), artifactsDir)}`);

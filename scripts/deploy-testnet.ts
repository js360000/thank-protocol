import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  type Address,
  type Chain,
  type Hex
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, sepolia } from "viem/chains";

type Artifact = {
  abi: unknown[];
  bytecode?: {
    object?: string;
  };
  evm?: {
    bytecode?: {
      object?: string;
    };
  };
};

type DeploymentRecord = {
  contract: string;
  address: Address;
  transactionHash: Hex;
  constructorArgs: unknown[];
};

const chains: Record<string, Chain> = {
  baseSepolia,
  sepolia
};

await loadLocalEnv();

const chainName = process.env.DEPLOY_CHAIN ?? "baseSepolia";
const chain = chains[chainName];
if (!chain) {
  throw new Error(`Unsupported DEPLOY_CHAIN "${chainName}". Supported: ${Object.keys(chains).join(", ")}`);
}

const rpcUrl = process.env.RPC_URL;
if (!rpcUrl) {
  throw new Error("RPC_URL is required");
}

const privateKey = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
if (!privateKey || !/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
  throw new Error("DEPLOYER_PRIVATE_KEY must be a 32-byte hex private key");
}

const account = privateKeyToAccount(privateKey);
const protocolOwner = resolveProtocolOwner(process.env.PROTOCOL_OWNER, account.address);

const transport = http(rpcUrl);
const publicClient = createPublicClient({ chain, transport });
const walletClient = createWalletClient({ account, chain, transport });

const deployments: DeploymentRecord[] = [];

console.log(`Deploying THANK Protocol to ${chain.name} (${chain.id})`);
console.log(`Deployer: ${account.address}`);
console.log(`Protocol owner: ${protocolOwner}`);

const projectRegistry = await deploy("ProjectRegistry", [protocolOwner]);
const splitRegistry = await deploy("SplitRegistry", [protocolOwner, projectRegistry.address]);
const thankRouter = await deploy("ThankRouter", [splitRegistry.address]);
const receiptNFT = await deploy("ReceiptNFT", [protocolOwner]);
const treasury = await deploy("Treasury", [protocolOwner]);

const output = {
  protocol: "THANK",
  version: "0.1.0",
  generatedAt: new Date().toISOString(),
  chain: {
    name: chain.name,
    id: chain.id
  },
  deployer: account.address,
  protocolOwner,
  evmVersion: "shanghai",
  contracts: {
    ProjectRegistry: projectRegistry.address,
    SplitRegistry: splitRegistry.address,
    ThankRouter: thankRouter.address,
    ReceiptNFT: receiptNFT.address,
    Treasury: treasury.address
  },
  deployments
};

const outPath = path.resolve("deployments", `${chainName}-${chain.id}.json`);
await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Wrote ${path.relative(process.cwd(), outPath)}`);

async function deploy(contract: string, constructorArgs: unknown[]) {
  const artifact = await loadArtifact(contract);
  const bytecode = readBytecode(artifact);
  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode,
    args: constructorArgs,
    account,
    chain
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (!receipt.contractAddress) {
    throw new Error(`${contract} deployment did not return a contract address`);
  }

  const record: DeploymentRecord = {
    contract,
    address: receipt.contractAddress,
    transactionHash: receipt.transactionHash,
    constructorArgs
  };
  deployments.push(record);
  console.log(`${contract}: ${record.address}`);
  return record;
}

async function loadArtifact(contract: string): Promise<Artifact> {
  const artifactPath = path.resolve("contracts", "artifacts", `${contract}.json`);
  try {
    return JSON.parse(await readFile(artifactPath, "utf8")) as Artifact;
  } catch (error) {
    throw new Error(`Missing artifact for ${contract}. Run npm run compile:contracts first. ${String(error)}`);
  }
}

function readBytecode(artifact: Artifact): Hex {
  const object = artifact.evm?.bytecode?.object ?? artifact.bytecode?.object;
  if (!object) {
    throw new Error("Artifact is missing bytecode");
  }
  return `0x${object.replace(/^0x/, "")}` as Hex;
}

function resolveProtocolOwner(value: string | undefined, fallback: Address): Address {
  if (!value || value === "0x0000000000000000000000000000000000000000") {
    return fallback;
  }
  if (!isAddress(value)) {
    throw new Error("PROTOCOL_OWNER must be an EVM address");
  }
  return value;
}

async function loadLocalEnv(): Promise<void> {
  const envPath = path.resolve(".env");
  let contents: string;
  try {
    contents = await readFile(envPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw error;
  }

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = stripEnvQuotes(line.slice(separatorIndex + 1).trim());
  }
}

function stripEnvQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

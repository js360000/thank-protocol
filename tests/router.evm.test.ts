import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Common, Hardfork, Mainnet } from "@ethereumjs/common";
import { createLegacyTx } from "@ethereumjs/tx";
import {
  Account,
  Address,
  createAccount,
  createAddressFromPrivateKey,
  hexToBytes
} from "@ethereumjs/util";
import { createVM, runTx, type VM } from "@ethereumjs/vm";
import solc from "solc";
import {
  decodeFunctionResult,
  encodeDeployData,
  encodeFunctionData,
  type Abi,
  type Hex
} from "viem";
import { beforeEach, describe, expect, it } from "vitest";

const ownerKey = hexToBytes("0x1000000000000000000000000000000000000000000000000000000000000001");
const donorKey = hexToBytes("0x2000000000000000000000000000000000000000000000000000000000000002");
const claimerKey = hexToBytes("0x3000000000000000000000000000000000000000000000000000000000000003");
const recipientAKey = hexToBytes("0x4000000000000000000000000000000000000000000000000000000000000004");
const recipientBKey = hexToBytes("0x5000000000000000000000000000000000000000000000000000000000000005");

const projectId = "0x1111111111111111111111111111111111111111111111111111111111111111";
const unverifiedProjectId = "0x2222222222222222222222222222222222222222222222222222222222222222";
const manifestHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const oneEther = 1_000_000_000_000_000_000n;

describe("ThankRouter EVM behavior", () => {
  let compiled: CompiledContracts;
  let harness: EvmHarness;

  beforeEach(async () => {
    compiled = await compileContracts();
    harness = await EvmHarness.create();
  });

  it("queues native credits and lets any caller claim for a recipient", async () => {
    const { splitRegistry } = await harness.deployRegisteredProtocol();
    const router = await harness.deploy("ThankRouter.sol", "ThankRouter", [splitRegistry.address]);

    await harness.send(splitRegistry, "setSplits", [
      projectId,
      [
        { recipient: harness.recipientAAddress, basisPoints: 7000 },
        { recipient: harness.recipientBAddress, basisPoints: 3000 }
      ]
    ]);

    await harness.send(
      router,
      "fundNative",
      [projectId, "native funding test", "ipfs://receipt/native"],
      { privateKey: donorKey, value: 1000n }
    );

    await expect(harness.read(router, "nativeCredits", [harness.recipientAAddress])).resolves.toBe(700n);
    await expect(harness.read(router, "nativeCredits", [harness.recipientBAddress])).resolves.toBe(300n);
    await expect(harness.getBalance(router.address)).resolves.toBe(1000n);

    await harness.send(router, "claimNativeFor", [harness.recipientAAddress], {
      privateKey: claimerKey
    });

    await expect(harness.read(router, "nativeCredits", [harness.recipientAAddress])).resolves.toBe(0n);
    await expect(harness.getBalance(harness.recipientAAddress)).resolves.toBe(700n);
    await expect(harness.getBalance(router.address)).resolves.toBe(300n);
  });

  it("queues ERC-20 credits and transfers tokens on claim", async () => {
    const { splitRegistry } = await harness.deployRegisteredProtocol();
    const router = await harness.deploy("ThankRouter.sol", "ThankRouter", [splitRegistry.address]);
    const token = await harness.deploy("TestToken.sol", "TestToken", [
      harness.donorAddress,
      10_000n
    ]);

    await harness.send(splitRegistry, "setSplits", [
      projectId,
      [
        { recipient: harness.recipientAAddress, basisPoints: 7000 },
        { recipient: harness.recipientBAddress, basisPoints: 3000 }
      ]
    ]);
    await harness.send(token, "approve", [router.address, 1000n], { privateKey: donorKey });
    await harness.send(router, "fundToken", [
      projectId,
      token.address,
      1000n,
      "token funding test",
      "ipfs://receipt/token"
    ], { privateKey: donorKey });

    await expect(harness.read(router, "tokenCredits", [token.address, harness.recipientAAddress])).resolves.toBe(700n);
    await expect(harness.read(router, "tokenCredits", [token.address, harness.recipientBAddress])).resolves.toBe(300n);
    await expect(harness.read(token, "balanceOf", [router.address])).resolves.toBe(1000n);

    await harness.send(router, "claimTokenFor", [token.address, harness.recipientAAddress], {
      privateKey: claimerKey
    });

    await expect(harness.read(router, "tokenCredits", [token.address, harness.recipientAAddress])).resolves.toBe(0n);
    await expect(harness.read(token, "balanceOf", [harness.recipientAAddress])).resolves.toBe(700n);
    await expect(harness.read(token, "balanceOf", [router.address])).resolves.toBe(300n);
  });

  it("does not let a reverting recipient block the funding transaction", async () => {
    const { splitRegistry } = await harness.deployRegisteredProtocol();
    const router = await harness.deploy("ThankRouter.sol", "ThankRouter", [splitRegistry.address]);
    const revertingRecipient = await harness.deploy("RevertingRecipient.sol", "RevertingRecipient");

    await harness.send(splitRegistry, "setSplits", [
      projectId,
      [
        { recipient: revertingRecipient.address, basisPoints: 5000 },
        { recipient: harness.recipientBAddress, basisPoints: 5000 }
      ]
    ]);

    await harness.send(
      router,
      "fundNative",
      [projectId, "recipient can revert later", "ipfs://receipt/reverter"],
      { privateKey: donorKey, value: 1000n }
    );

    await expect(harness.read(router, "nativeCredits", [revertingRecipient.address])).resolves.toBe(500n);
    await expect(
      harness.send(router, "claimNativeFor", [revertingRecipient.address], { privateKey: claimerKey })
    ).rejects.toThrow("execution reverted");
    await expect(harness.read(router, "nativeCredits", [revertingRecipient.address])).resolves.toBe(500n);
  });

  it("rejects duplicate split recipients", async () => {
    const { splitRegistry } = await harness.deployRegisteredProtocol();

    await expect(
      harness.send(splitRegistry, "setSplits", [
        projectId,
        [
          { recipient: harness.recipientAAddress, basisPoints: 5000 },
          { recipient: harness.recipientAAddress, basisPoints: 5000 }
        ]
      ])
    ).rejects.toThrow("execution reverted");
  });

  it("allows the registered project controller to update splits", async () => {
    const { splitRegistry } = await harness.deployRegisteredProtocol();

    await harness.send(splitRegistry, "setSplits", [
      projectId,
      [
        { recipient: harness.recipientAAddress, basisPoints: 6000 },
        { recipient: harness.recipientBAddress, basisPoints: 4000 }
      ]
    ], { privateKey: donorKey });

    const splits = await harness.read(splitRegistry, "getSplits", [projectId]);

    expect(
      (splits as Array<{ recipient: string; basisPoints: number }>).map((split) => ({
        recipient: split.recipient.toLowerCase(),
        basisPoints: split.basisPoints
      }))
    ).toEqual([
      { recipient: harness.recipientAAddress, basisPoints: 6000 },
      { recipient: harness.recipientBAddress, basisPoints: 4000 }
    ]);
  });

  it("rejects split updates from non-controllers", async () => {
    const { splitRegistry } = await harness.deployRegisteredProtocol();

    await expect(
      harness.send(splitRegistry, "setSplits", [
        projectId,
        [
          { recipient: harness.recipientAAddress, basisPoints: 6000 },
          { recipient: harness.recipientBAddress, basisPoints: 4000 }
        ]
      ], { privateKey: claimerKey })
    ).rejects.toThrow("execution reverted");
  });

  it("rejects splits for unverified or deactivated projects", async () => {
    const projectRegistry = await harness.deploy("ProjectRegistry.sol", "ProjectRegistry", [
      harness.ownerAddress
    ]);
    const splitRegistry = await harness.deploy("SplitRegistry.sol", "SplitRegistry", [
      harness.ownerAddress,
      projectRegistry.address
    ]);

    await harness.registerProject(projectRegistry, unverifiedProjectId, {
      repo: "thank-protocol/unverified",
      controller: harness.donorAddress,
      verificationLevel: 0
    });

    await expect(
      harness.send(splitRegistry, "setSplits", [
        unverifiedProjectId,
        [
          { recipient: harness.recipientAAddress, basisPoints: 6000 },
          { recipient: harness.recipientBAddress, basisPoints: 4000 }
        ]
      ])
    ).rejects.toThrow("execution reverted");

    await harness.registerProject(projectRegistry, projectId, {
      repo: "thank-protocol/deactivated",
      controller: harness.donorAddress,
      verificationLevel: 1
    });
    await harness.send(projectRegistry, "deactivateProject", [projectId]);

    await expect(
      harness.send(splitRegistry, "setSplits", [
        projectId,
        [
          { recipient: harness.recipientAAddress, basisPoints: 6000 },
          { recipient: harness.recipientBAddress, basisPoints: 4000 }
        ]
      ])
    ).rejects.toThrow("execution reverted");
  });

  class EvmHarness {
    private readonly common = new Common({ chain: Mainnet, hardfork: Hardfork.Shanghai });
    private readonly nonces = new Map<string, bigint>();

    private constructor(readonly vm: VM) {}

    static async create() {
      const harness = new EvmHarness(await createVM({
        common: new Common({ chain: Mainnet, hardfork: Hardfork.Shanghai })
      }));

      for (const privateKey of [ownerKey, donorKey, claimerKey]) {
        await harness.fundAccount(privateKey, oneEther);
      }
      await harness.fundAccount(recipientAKey, 0n);
      await harness.fundAccount(recipientBKey, 0n);

      return harness;
    }

    get ownerAddress() {
      return addressOf(ownerKey);
    }

    get donorAddress() {
      return addressOf(donorKey);
    }

    get recipientAAddress() {
      return addressOf(recipientAKey);
    }

    get recipientBAddress() {
      return addressOf(recipientBKey);
    }

    async deploy(sourceName: string, contractName: string, args: readonly unknown[] = []) {
      const contract = compiled.get(sourceName, contractName);
      const data = encodeDeployData({
        abi: contract.abi,
        bytecode: contract.bytecode,
        args
      });
      const result = await this.runSignedTx({ data, privateKey: ownerKey });

      if (!result.createdAddress) {
        throw new Error(`Deployment did not return an address for ${contractName}`);
      }

      return {
        ...contract,
        address: result.createdAddress.toString()
      };
    }

    async deployRegisteredProtocol() {
      const projectRegistry = await this.deploy("ProjectRegistry.sol", "ProjectRegistry", [
        this.ownerAddress
      ]);
      const splitRegistry = await this.deploy("SplitRegistry.sol", "SplitRegistry", [
        this.ownerAddress,
        projectRegistry.address
      ]);

      await this.registerProject(projectRegistry, projectId, {
        repo: "thank-protocol/example",
        controller: this.donorAddress,
        verificationLevel: 1
      });

      return { projectRegistry, splitRegistry };
    }

    async registerProject(
      projectRegistry: DeployedContract,
      id: string,
      options: { repo: string; controller: string; verificationLevel: number }
    ) {
      await this.send(projectRegistry, "registerProject", [
        id,
        options.repo,
        `https://github.com/${options.repo}/blob/main/thank.yaml`,
        manifestHash,
        options.controller,
        options.verificationLevel
      ]);
    }

    async send(
      contract: DeployedContract,
      functionName: string,
      args: readonly unknown[] = [],
      options: { privateKey?: Uint8Array; value?: bigint } = {}
    ) {
      const data = encodeFunctionData({
        abi: contract.abi,
        functionName,
        args
      });

      return this.runSignedTx({
        to: contract.address,
        data,
        privateKey: options.privateKey ?? ownerKey,
        value: options.value ?? 0n
      });
    }

    async read(contract: DeployedContract, functionName: string, args: readonly unknown[] = []) {
      const data = encodeFunctionData({
        abi: contract.abi,
        functionName,
        args
      });
      const result = await this.vm.evm.runCall({
        to: createAddress(contract.address),
        caller: createAddress(this.ownerAddress),
        origin: createAddress(this.ownerAddress),
        data: hexToBytes(data),
        gasLimit: 10_000_000n
      });

      if (result.execResult.exceptionError) {
        throw new Error(result.execResult.exceptionError.error);
      }

      return decodeFunctionResult({
        abi: contract.abi,
        functionName,
        data: bytesToHex(result.execResult.returnValue)
      });
    }

    async getBalance(address: string) {
      const account = await this.vm.stateManager.getAccount(createAddress(address));
      return account?.balance ?? 0n;
    }

    private async fundAccount(privateKey: Uint8Array, balance: bigint) {
      const address = createAddressFromPrivateKey(privateKey);
      await this.vm.stateManager.putAccount(address, createAccount({ balance }));
      this.nonces.set(address.toString(), 0n);
    }

    private async runSignedTx(options: {
      privateKey: Uint8Array;
      to?: string;
      data: Hex;
      value?: bigint;
    }) {
      const from = addressOf(options.privateKey);
      const nonce = this.nonces.get(from) ?? 0n;
      const tx = createLegacyTx(
        {
          nonce,
          gasLimit: 8_000_000n,
          gasPrice: 10n,
          to: options.to ? createAddress(options.to) : undefined,
          value: options.value ?? 0n,
          data: hexToBytes(options.data)
        },
        { common: this.common }
      ).sign(options.privateKey);
      const result = await runTx(this.vm, {
        tx,
        skipBlockGasLimitValidation: true
      });

      this.nonces.set(from, nonce + 1n);

      if (result.execResult.exceptionError) {
        throw new Error(`execution reverted: ${result.execResult.exceptionError.error}`);
      }

      return result;
    }
  }
});

interface CompiledContract {
  abi: Abi;
  bytecode: Hex;
}

interface DeployedContract extends CompiledContract {
  address: string;
}

class CompiledContracts {
  constructor(private readonly contracts: Map<string, CompiledContract>) {}

  get(sourceName: string, contractName: string) {
    const contract = this.contracts.get(`${sourceName}:${contractName}`);
    if (!contract) {
      throw new Error(`Missing compiled contract ${sourceName}:${contractName}`);
    }
    return contract;
  }
}

async function compileContracts() {
  const contractsDir = path.resolve("contracts/src");
  const files = (await readdir(contractsDir)).filter((file) => file.endsWith(".sol"));
  const sources: Record<string, { content: string }> = Object.fromEntries(
    await Promise.all(
      files.map(async (file) => [
        file,
        {
          content: await readFile(path.join(contractsDir, file), "utf8")
        }
      ])
    )
  );

  sources["TestToken.sol"] = {
    content: `
      // SPDX-License-Identifier: MIT
      pragma solidity ^0.8.24;

      contract TestToken {
        mapping(address => uint256) public balanceOf;
        mapping(address => mapping(address => uint256)) public allowance;

        constructor(address holder, uint256 supply) {
          balanceOf[holder] = supply;
        }

        function approve(address spender, uint256 amount) external returns (bool) {
          allowance[msg.sender][spender] = amount;
          return true;
        }

        function transfer(address recipient, uint256 amount) external returns (bool) {
          require(balanceOf[msg.sender] >= amount, "balance");
          balanceOf[msg.sender] -= amount;
          balanceOf[recipient] += amount;
          return true;
        }

        function transferFrom(address sender, address recipient, uint256 amount) external returns (bool) {
          require(balanceOf[sender] >= amount, "balance");
          require(allowance[sender][msg.sender] >= amount, "allowance");
          allowance[sender][msg.sender] -= amount;
          balanceOf[sender] -= amount;
          balanceOf[recipient] += amount;
          return true;
        }
      }
    `
  };
  sources["RevertingRecipient.sol"] = {
    content: `
      // SPDX-License-Identifier: MIT
      pragma solidity ^0.8.24;

      contract RevertingRecipient {
        receive() external payable {
          revert("reject native funds");
        }
      }
    `
  };

  const output = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: "Solidity",
        sources,
        settings: {
          evmVersion: "shanghai",
          optimizer: { enabled: true, runs: 200 },
          outputSelection: {
            "*": {
              "*": ["abi", "evm.bytecode.object"]
            }
          }
        }
      })
    )
  ) as {
    contracts?: Record<string, Record<string, { abi: Abi; evm: { bytecode: { object: string } } }>>;
    errors?: Array<{ severity: "error" | "warning"; formattedMessage: string }>;
  };

  const errors = output.errors?.filter((diagnostic) => diagnostic.severity === "error") ?? [];
  if (errors.length > 0) {
    throw new Error(errors.map((diagnostic) => diagnostic.formattedMessage).join("\n"));
  }

  const contracts = new Map<string, CompiledContract>();
  for (const [sourceName, sourceContracts] of Object.entries(output.contracts ?? {})) {
    for (const [contractName, contract] of Object.entries(sourceContracts)) {
      contracts.set(`${sourceName}:${contractName}`, {
        abi: contract.abi,
        bytecode: `0x${contract.evm.bytecode.object}`
      });
    }
  }

  return new CompiledContracts(contracts);
}

function addressOf(privateKey: Uint8Array) {
  return createAddressFromPrivateKey(privateKey).toString();
}

function createAddress(address: string) {
  return new Address(hexToBytes(address as Hex));
}

function bytesToHex(bytes: Uint8Array): Hex {
  return `0x${Buffer.from(bytes).toString("hex")}`;
}

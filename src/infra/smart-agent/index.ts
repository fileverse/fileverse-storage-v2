import { Hex, hexToBigInt, http, toHex, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { generatePrivateKey } from "viem/accounts";

import { IExecuteUserOperationRequest, IAgentClient } from "../../types";
import { TSmartAccountClient } from "../../types";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { config } from "../../config";
import { entryPoint07Address } from "viem/account-abstraction";
import { toSafeSmartAccount } from "permissionless/accounts";
import { chain, publicClient } from "../../domain/contract/viemClient";
import { createSmartAccountClient } from "permissionless";

class AgentClient implements IAgentClient {
  private smartAccountAgent: TSmartAccountClient | null = null;
  private readonly MAX_CALL_GAS_LIMIT = 500000;

  pimlicoClient = createPimlicoClient({
    transport: http(config.BUNDLER_URL),
    entryPoint: {
      address: entryPoint07Address,
      version: "0.7",
    },
  });

  async initializeAgentClient() {
    if (this.smartAccountAgent) return;
    const agentAccount = privateKeyToAccount(config.AGENT_PRIVATE_KEY as Hex);
    const safeSmartAccount = await toSafeSmartAccount({
      client: publicClient,
      owners: [agentAccount],
      entryPoint: {
        address: entryPoint07Address,
        version: "0.7",
      },
      version: "1.4.1",
    });

    const smartAccountClient: TSmartAccountClient = createSmartAccountClient({
      account: safeSmartAccount,
      chain: chain,
      paymaster: this.pimlicoClient,
      bundlerTransport: http(config.BUNDLER_URL),
      userOperation: {
        estimateFeesPerGas: async () =>
          (await this.pimlicoClient.getUserOperationGasPrice()).fast,
      },
    });

    this.smartAccountAgent = smartAccountClient;
  }

  getSmartAccountAgent(): TSmartAccountClient {
    if (!this.smartAccountAgent)
      throw new Error("Agent client not initialized");

    return this.smartAccountAgent;
  }

  getAgentAddress() {
    const smartAccountAgent = this.getSmartAccountAgent();
    return smartAccountAgent.account.address;
  }

  getAgentAccount() {
    const smartAccountAgent = this.getSmartAccountAgent();
    return smartAccountAgent.account;
  }

  getNonce() {
    return hexToBigInt(
      toHex(toBytes(generatePrivateKey()).slice(0, 24), {
        size: 32,
      })
    );
  }

  async getCallData(
    request: IExecuteUserOperationRequest | IExecuteUserOperationRequest[]
  ) {
    const agentAccount = this.getAgentAccount();
    if (Array.isArray(request)) {
      if (request.length === 0 || request.length > 10)
        throw new Error("Request length must be between 1 and 10");

      const encodedCallData = [];
      for (let i = 0; i < request.length; i++) {
        encodedCallData.push({
          to: request[i].contractAddress,
          data: request[i].data,
          value: BigInt(0),
        });
      }

      return await agentAccount.encodeCalls(encodedCallData);
    }

    return await agentAccount.encodeCalls([
      {
        to: request.contractAddress,
        data: request.data,
        value: BigInt(0),
      },
    ]);
  }

  async sendUserOperation(
    request: IExecuteUserOperationRequest | IExecuteUserOperationRequest[],
    callGasLimit?: number
  ) {
    const smartAccountAgent = this.getSmartAccountAgent();

    const callData = await this.getCallData(request);

    return await smartAccountAgent.sendUserOperation({
      callData,
      callGasLimit: BigInt(callGasLimit || this.MAX_CALL_GAS_LIMIT),
      nonce: this.getNonce(),
    });
  }

  async executeUserOperationRequest(
    request: IExecuteUserOperationRequest | IExecuteUserOperationRequest[],
    timeout: number,
    callGasLimit?: number
  ) {
    const userOpHash = await this.sendUserOperation(request, callGasLimit);
    return await this.pimlicoClient.waitForUserOperationReceipt({
      hash: userOpHash,
      timeout,
    });
  }
}

export const AgentInstance = new AgentClient();

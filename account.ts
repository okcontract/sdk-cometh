import {
  type ComethSmartAccountClient,
  SmartSessionMode,
  createComethPaymasterClient,
  createSafeSmartAccount,
  createSmartAccountClient,
  erc7579Actions,
  smartSessionActions,
  toSmartSessionsSigner
} from "@cometh/connect-sdk-4337";
import type { SheetProxy } from "@okcontract/cells";
import type {
  EVMType,
  Network,
  Chain as OKChain
} from "@okcontract/multichain";
import { chainToViem } from "@okcontract/multichain";
import {
  type AppID,
  DefaultConnectorEVM,
  type DefaultConnectorOptions,
  type OKConnector,
  OKCore,
  type Transaction,
  baseOptions
} from "@okcontract/sdk";
import {
  type Account,
  type Address,
  type Hex,
  createPublicClient,
  http
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const apiKey = process.env.COMETH_API_KEY;

// @todo use cells
// @todo create an OKCore, add the Foreign
export const getSmartAccount = async (signer: Account, chain: Chain) => {
  const bundlerUrl = `https://bundler.cometh.io/${chain.id}?apikey=${apiKey}`;
  const paymasterUrl = `https://paymaster.cometh.io/${chain.id}?apikey=${apiKey}`;

  // @todo switch to multichain
  const publicClient = createPublicClient({
    chain,
    transport: http(),
    cacheTime: 60_000,
    batch: {
      multicall: { wait: 50 }
    }
  });

  // @todo switch to multichain
  const smartAccount = await createSafeSmartAccount({
    apiKey,
    publicClient,
    chain,
    signer
  });

  // Question: was await
  // @todo switch to multichain
  const paymasterClient = createComethPaymasterClient({
    transport: http(paymasterUrl),
    chain,
    publicClient
  });

  const smartAccountClient = createSmartAccountClient({
    account: smartAccount,
    chain,
    bundlerTransport: http(bundlerUrl),
    userOperation: {
      estimateFeesPerGas: async () => {
        return await paymasterClient.getUserOperationGasPrice();
      }
    }
  });

  // Verification check: The owner should be `account.publicKey`.
  const owners = await smartAccountClient.getOwners();

  console.log({
    creator: signer.publicKey,
    address: smartAccount.address,
    owners
  });

  return {
    creator: signer.publicKey,
    address: smartAccount.address,
    client: smartAccountClient
  };
};

// @todo use cells
export const getSession = async (client: ComethSmartAccountClient) => {
  const safe7559Account = client
    .extend(smartSessionActions())
    .extend(erc7579Actions());

  // Create a second temporary key for the session, which will be held inside the agent
  const sessionKey = generatePrivateKey();
  const sessionOwner = privateKeyToAccount(sessionKey);

  // @todo Check if we already have a session?

  // Question: seconds or milliseconds?
  const sessionValidUntil = Date.now() / 1000 + 24 * 3600;

  const createSessionResponse = await safe7559Account.grantPermission({
    sessionRequestedInfo: [
      {
        sessionPublicKey: sessionOwner.address,
        sessionValidUntil
        // There is no policy.
        // @todo We want instead a second signature coming from the OKcontract node
        // that would be valid for all OKcontract interactions.
        // actionPoliciesInfo: []
      }
    ]
  });

  console.log({ sessionPublic: sessionOwner.publicKey });

  // process.exit(0);

  const receipt = await safe7559Account.waitForUserOperationReceipt({
    hash: createSessionResponse.userOpHash
  });

  console.log({
    sessionPublic: sessionOwner.publicKey,
    success: receipt.success,
    userOpHash: receipt.userOpHash,
    gas: receipt.actualGasUsed,
    cost: receipt.actualGasCost
  });

  return {
    account: safe7559Account,
    session: createSessionResponse,
    signer: sessionOwner
  };
};

// @todo use cells
export const getOKCore = async (
  id: AppID,
  sess: Awaited<ReturnType<typeof getSession>>,
  chain: OKChain
) => {
  const bundlerUrl = `https://bundler.cometh.io/${chain.id}?apikey=${apiKey}`;
  const paymasterUrl = `https://paymaster.cometh.io/${chain.id}?apikey=${apiKey}`;

  // @todo switch to multichain
  const publicClient = createPublicClient({
    chain: chainToViem(chain),
    transport: http(),
    cacheTime: 60_000,
    batch: {
      multicall: { wait: 50 }
    }
  });

  const moduleData = {
    permissionIds: sess.session.permissionIds,
    action: sess.session.action,
    mode: SmartSessionMode.USE,
    sessions: sess.session.sessions
  };

  const sessionKeySigner = await toSmartSessionsSigner(sess.account, {
    moduleData,
    signer: sess.signer
  });

  // Question: was smartAccount.client?.account?.address,
  const smartAccountAddress = sess.account.account?.address;
  console.log({ smartAccountAddress });

  // Retrieves the existing smart account.
  const sessionKeyAccount = await createSafeSmartAccount({
    apiKey,
    chain,
    smartAccountAddress,
    smartSessionSigner: sessionKeySigner
  });

  console.log({ sessionKeyAccount: sessionKeyAccount.address });

  // Question: was await
  // @todo switch to multichain
  const paymasterClient = createComethPaymasterClient({
    transport: http(paymasterUrl),
    chain: chainToViem(chain),
    publicClient
  });

  const sessionKeyClient = createSmartAccountClient({
    account: sessionKeyAccount,
    chain: chainToViem(chain),
    bundlerTransport: http(bundlerUrl),
    // We need the PayMaster for gas estimation.
    userOperation: {
      estimateFeesPerGas: async () => {
        return await paymasterClient.getUserOperationGasPrice();
      }
    }
  }).extend(smartSessionActions());

  console.log({
    client: sessionKeyClient.account.address,
    chain: await sessionKeyClient.getChainId()
  });

  // Question: Not exported from cometh sdk? Differs from @rhinestone
  type Execution = {
    target: Address;
    value: bigint;
    callData: Hex;
  };

  // Note: Transaction is OKcontract/SDK here :)
  const TransactionToExecution = (tx: Transaction<EVMType>) =>
    ({ target: tx.to, callData: tx.data, value: tx.value }) as Execution;

  const okConnectorOptions = (
    proxy: SheetProxy,
    client: typeof sessionKeyClient // Question: is there a type name?
  ): DefaultConnectorOptions => {
    const account = client.account.address;
    return {
      account: proxy.new(account),
      chain: proxy.new(chain),
      signer: (message: string) => client.signMessage({ account, message }),
      // @todo bundle
      sender: (tx) =>
        client.usePermission({ actions: [TransactionToExecution(tx)] })
    };
  };

  return new OKCore({
    ...baseOptions(id),
    connector: (proxy) =>
      new DefaultConnectorEVM(
        proxy,
        okConnectorOptions(proxy, sessionKeyClient)
      ) as OKConnector<Network>
  });
};

import { privateKeyToAccount } from "viem/accounts";

import { chainToViem, optimism } from "@okcontract/multichain";
import { type AppID, buildTX } from "@okcontract/sdk";

import { getOKCore, getSession, getSmartAccount } from "./account";
import { getPrivateKey } from "./readKey";
import { REPL } from "./repl";

// ==================== STEP 1: CREATE THE ACCOUNT =====================

const id = "smartacc" as AppID;
const chain = optimism;
const interaction = "kSXS27G15xN8KPMYsRsT"; // free OK mint

// We simulate an existing EOA that is the "parent" of the smart account.
const privateKey = getPrivateKey();
const signer = privateKeyToAccount(privateKey);

const smartAccount = await getSmartAccount(signer, chainToViem(chain));
// process.exit(0);

// ==================== STEP 2: CREATE THE SESSION =====================

const session = await getSession(smartAccount.client);
// process.exit(0);

// ==================== STEP 3: USE THE SESSION =====================

const core = await getOKCore(id, session, chain);
const { tx } = await buildTX(core, interaction);
const hash = await tx.sendTX();
console.log({ hash });

REPL(core);

// const logs = await uncellify(tx.prettyLogs);
// console.log({ logs });

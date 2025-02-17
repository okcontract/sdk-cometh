import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generatePrivateKey } from "viem/accounts";

const keyFilePath = join(__dirname, "privateKey.txt");

/**
 * Load private key from file if it exists, otherwise generates and saves a new one.
 * @returns The private key.
 */
export function getPrivateKey(): `0x${string}` {
  if (existsSync(keyFilePath)) {
    const privateKey = readFileSync(keyFilePath, "utf-8").trim();
    return privateKey as `0x${string}`;
  }
  console.warn("Creating a new privateKey");
  const privateKey = generatePrivateKey();
  writeFileSync(keyFilePath, privateKey, { encoding: "utf-8" });
  console.log("Generated and saved a new private key.");
  return privateKey;
}

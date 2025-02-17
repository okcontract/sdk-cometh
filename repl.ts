import * as readline from "node:readline";
import { Debugger, simplifier } from "@okcontract/cells";
import type { OKCore } from "@okcontract/sdk";

export const REPL = (core: OKCore) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const debug = new Debugger(core.Sheet);

  rl.setPrompt("> ");
  rl.prompt();

  rl.on("line", async (input) => {
    try {
      const result = eval(input);
      console.log(simplifier(result));
    } catch (error: unknown) {
      if (error instanceof Error) console.error(error.message);
      else console.error(error);
    }
    rl.prompt();
  });

  rl.on("close", () => {
    process.exit(0);
  });
};

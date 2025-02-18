import type { Chain } from "@okcontract/multichain";

export const arbitrum = {
  currency: "tok:eth",
  explorer: ["https://arbiscan.io"],
  id: "arbitrum",
  logo: "https://altcoinsbox.com/wp-content/uploads/2023/03/arbitrum-logo.jpg",
  name: "Arbitrum",
  net: "evm",
  numid: 42161n,
  rpc: [
    "https://arb1.arbitrum.io/rpc",
    "https://1rpc.io/arb",
    "https://rpc.ankr.com/arbitrum",
    "https://arbitrum-one.publicnode.com"
  ]
} as Chain;

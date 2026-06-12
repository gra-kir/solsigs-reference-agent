# SolSigs Reference Agent

An autonomous AI agent pattern with **no API keys, no accounts, no subscriptions** — just a Solana wallet with a few USDC in it.

This repo demonstrates the full x402 loop on Solana mainnet:

```
discover → request → HTTP 402 → pay USDC on-chain → retry with receipt → data
```

The agent discovers [SolSigs](https://solsigs.com) endpoints via its machine-readable discovery document, buys fresh token-launch data, buys wallet intelligence, then buys an LLM market read — printing a research report with a real Solscan receipt for every call. Total cost of a full run: about **$0.016**.

## Quick start

```bash
git clone https://github.com/Gra-kir/solsigs-reference-agent
cd solsigs-reference-agent
npm install
cp .env.example .env   # add your wallet's base58 secret key
npm start
```

Fund the wallet with ~$1 USDC and ~0.01 SOL. That's the entire setup.

## Sample run

This isn't a mock-up. Below is an actual run on Solana mainnet — three USDC
payments, each settled on-chain. Every receipt is a live link; you can verify
the transfers without cloning or running anything.

```
▸ Discovering services via x402 discovery document…
  found 22 payable endpoints: /dex /arb /wallet /launches /summary /predict /price /nft /staking /whale /alerts /dev /social /rpc /smartmoney /trending /token-safety /alpha /trust /perps /trenches /ask

▸ Buying launch data…
  [x402] paying 0.003 USDC → HZAkkKbhN9hfJBiNxCuwap7XtPXgniy9MVjJR2MvHSJi for https://solsigs.com/launches
  [x402] settled: https://solscan.io/tx/29mXmuS4Zu4S…o3mcJ8Vv9
  newest launch: ZynCoin (rug risk: MEDIUM / 50)

▸ Buying wallet intelligence on AXcGMj9X… (this agent’s own wallet)
  [x402] paying 0.005 USDC → HZAkkKbhN9hfJBiNxCuwap7XtPXgniy9MVjJR2MvHSJi for https://solsigs.com/wallet
  [x402] settled: https://solscan.io/tx/5nMSL23P3X5m…YjWSKqkE
  label: Wallet, SOL: 0.01, tokens: 1, recent txs: 2

▸ Buying an LLM market read…
  [x402] paying 0.008 USDC → HZAkkKbhN9hfJBiNxCuwap7XtPXgniy9MVjJR2MvHSJi for https://solsigs.com/summary
  [x402] settled: https://solscan.io/tx/aN8U1sZZxdSu…ZLgYUYC

──── AGENT REPORT ────
There's a high rug risk associated with the ZynCoin token, scoring 50 out of
100 and classified as MEDIUM. This token launch has experienced a significant
24-hour price drop of -10.81%, resulting in a current market capitalization of
$414,462. The token's liquidity is extremely low, with only $21,361 USD traded
within the last 24 hours.
──────────────────────

✔ Run complete. Total spent: 0.0160 USDC.
```

### On-chain receipts

| Step | Endpoint | Paid | Settlement (Solscan) |
|------|----------|------|----------------------|
| 1 | `/launches` | 0.003 USDC | [`29mXmuS4Zu4S…o3mcJ8Vv9`](https://solscan.io/tx/29mXmuS4Zu4SSvDmVPgLZcUHZYb6ErsXqjA4Dg9oLpVhWJc1y3hdV543x5SVjbrfTPuFonqz2ATUufFo3mcJ8Vv9) |
| 2 | `/wallet` | 0.005 USDC | [`5nMSL23P3X5m…YjWSKqkE`](https://solscan.io/tx/5nMSL23P3X5mN3oibLboBJgBUb7Vfpr4ZgDB3HipRzph4SJ4MW2z2N26MaS2p1bSVuHSnMY4eRLwnpeMYjWSKqkE) |
| 3 | `/summary` | 0.008 USDC | [`aN8U1sZZxdSu…ZLgYUYC`](https://solscan.io/tx/aN8U1sZZxdSu23YYDyn6gFTWs4jbSGauHAGu5F4dZyzw2vQAX3FSJm6BBXoRryJRv2aGfb4PpRh9zEuZZLgYUYC) |

**Total: 0.016 USDC**, three transfers, all finalized on Solana mainnet. The
payee (`HZAkkKbh…HSJi`) is the SolSigs receiving wallet; the launch step scored
the agent's own wallet because launch feeds carry no deployer address.

## What it shows

- **Agent auto-discovery** — endpoints are read from `/.well-known/x402.json` at runtime, nothing hardcoded
- **Budget safety** — hard per-call spend cap and a total run budget, so a bug can't drain the wallet
- **Receipts** — every payment is a verifiable USDC transfer on Solana mainnet (~400ms finality, ~$0.00025 tx cost)

## Use the client in your own agent

`lib/x402-client.js` is a dependency-light, reusable pay-and-fetch helper:

```js
const { X402Client } = require('./lib/x402-client');
const client = new X402Client(RPC_URL, WALLET_SECRET_KEY);
const prices = await client.fetch('https://solsigs.com/dex', {
  token: 'SOL'
});
```

It handles the 402 challenge, the SPL transfer, and the retry automatically.

## Available endpoints

SolSigs runs 22 Solana data endpoints from $0.001/call — DEX prices, arbitrage scanning, wallet intelligence, launch detection with rug scoring, whale tracking, prediction markets, and more. Full list: [solsigs.com](https://solsigs.com) · Discovery doc: [solsigs.com/.well-known/x402.json](https://solsigs.com/.well-known/x402.json)

## License

MIT — fork it, build on it, ship your own agent.

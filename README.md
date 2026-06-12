# SolSigs Reference Agent

An autonomous AI agent pattern with **no API keys, no accounts, no subscriptions** — just a Solana wallet with a few USDC in it.

This repo demonstrates the full x402 loop on Solana mainnet:

```
discover → request → HTTP 402 → pay USDC on-chain → retry with receipt → data
```

The agent discovers [SolSigs](https://solsigs.com) endpoints via its machine-readable discovery document, buys fresh token-launch data, buys wallet intelligence on the deployer, then buys an LLM market read — printing a research report with a real Solscan receipt for every call. Total cost of a full run: about **$0.016**.

## Quick start

```bash
git clone https://github.com/Gra-kir/solsigs-reference-agent
cd solsigs-reference-agent
npm install
cp .env.example .env   # add your wallet's base58 secret key
npm start
```

Fund the wallet with ~$1 USDC and ~0.01 SOL. That's the entire setup.

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

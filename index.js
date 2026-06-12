/**
 * SolSigs Reference Agent
 * -----------------------
 * An autonomous agent with a $5 USDC budget that:
 *   1. Discovers SolSigs via /.well-known/x402.json (no hardcoded endpoints)
 *   2. Pulls new token launches (/launches)
 *   3. Scores a wallet (/wallet) — the launch deployer if available, else its own
 *   4. Asks the LLM summarizer for a plain-English read (/summary)
 *   5. Prints a research report with on-chain payment receipts
 *
 * No API keys. No accounts. Just a funded Solana wallet.
 *
 * Usage:  cp .env.example .env   (add your wallet key)
 *         npm install && npm start
 */
require('dotenv').config();
const { X402Client } = require('./lib/x402-client');

const BASE = process.env.SOLSIGS_BASE || 'https://solsigs.com';
const BUDGET_USDC = parseFloat(process.env.BUDGET_USDC || '0.10');

async function discover() {
  const res = await fetch(`${BASE}/.well-known/x402.json`);
  if (!res.ok) throw new Error(`Discovery failed: HTTP ${res.status}`);
  const doc = await res.json();
  // SolSigs publishes a flat top-level `endpoints` array. (Some x402 docs nest
  // endpoints under `servers[]` — support both so this stays portable.)
  const list = Array.isArray(doc.endpoints)
    ? doc.endpoints
    : (doc.servers || []).flatMap(s => s.endpoints || []);
  const endpoints = {};
  for (const ep of list) {
    endpoints[ep.path] = { url: `${BASE}${ep.path}`, ...ep };
  }
  return endpoints;
}

// A Solana address/mint is base58 and 32–44 chars. Launch feeds often carry a
// data-provider id (e.g. a CoinGecko slug) in `mint`, which is NOT a payable
// wallet address — guard against feeding it to an address-typed endpoint.
function isSolanaAddress(s) {
  return typeof s === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
}

async function main() {
  if (!process.env.WALLET_SECRET_KEY) {
    console.error('Set WALLET_SECRET_KEY in .env (base58 secret key of a wallet holding USDC + a little SOL).');
    process.exit(1);
  }

  const client = new X402Client(
    process.env.RPC_URL || 'https://api.mainnet-beta.solana.com',
    process.env.WALLET_SECRET_KEY,
    { maxSpendPerCallUsdc: 0.02, log: m => console.log(`  [x402] ${m}`) }
  );

  console.log('▸ Discovering services via x402 discovery document…');
  const eps = await discover();
  console.log(`  found ${Object.keys(eps).length} payable endpoints: ${Object.keys(eps).join(' ')}\n`);

  const need = ['/launches', '/wallet', '/summary'];
  for (const p of need) if (!eps[p]) throw new Error(`Endpoint ${p} not in discovery doc`);

  // --- Step 1: fresh launches ---
  console.log('▸ Buying launch data…');
  const launches = await client.fetch(eps['/launches'].url, { limit: 5 });
  const list = launches.newTokens || [];
  if (!list.length) { console.log('  no fresh launches right now — try again later.'); return done(client); }

  const pick = list[0];
  const rugLevel = pick.rugRiskLevel ?? 'n/a';
  const rugScore = pick.rugRiskScore ?? 'n/a';
  console.log(`  newest launch: ${pick.name || pick.symbol || pick.mint} (rug risk: ${rugLevel} / ${rugScore})\n`);

  // --- Step 2: score a wallet ---
  // Launch entries carry no deployer/creator and their `mint` is a data-provider
  // slug, not a payable address. Fall back to scoring the agent's own wallet —
  // a real, always-valid address — so the /wallet receipt is meaningful.
  const launchAddr = [pick.deployer, pick.creator, pick.mint].find(isSolanaAddress);
  const addr = launchAddr || client.address;
  if (client.spentUsdc + 0.005 <= BUDGET_USDC) {
    const which = launchAddr ? 'launch deployer' : 'this agent’s own wallet';
    console.log(`▸ Buying wallet intelligence on ${String(addr).slice(0, 8)}… (${which})`);
    const intel = await client.fetch(eps['/wallet'].url, { address: addr });
    console.log(`  label: ${intel.label ?? 'n/a'}, SOL: ${intel.solBalance ?? 'n/a'}, ` +
                `tokens: ${intel.tokenCount ?? 'n/a'}, recent txs: ${intel.recentTxCount ?? 'n/a'}\n`);
  }

  // --- Step 3: LLM read ---
  // /summary expects { data, context }; context picks the system prompt.
  // token_analysis leads with a rug-risk assessment — ideal for a fresh launch.
  if (client.spentUsdc + 0.008 <= BUDGET_USDC) {
    console.log('▸ Buying an LLM market read…');
    const summary = await client.fetch(eps['/summary'].url, {
      data: pick,
      context: 'token_analysis',
    });
    console.log('\n──── AGENT REPORT ────');
    console.log(summary.summary || summary.error || JSON.stringify(summary));
    console.log('──────────────────────\n');
  }

  done(client);
}

function done(client) {
  console.log(`✔ Run complete. Total spent: ${client.spentUsdc.toFixed(4)} USDC.`);
  console.log('  Every call above settled on Solana mainnet — receipts in the [x402] log lines.');
}

main().catch(e => { console.error('✗', e.message); process.exit(1); });

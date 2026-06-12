/**
 * Minimal x402 client for Solana (SolSigs-compatible).
 * Flow: POST → 402 → USDC SPL transfer → retry with X-PAYMENT: <tx signature>
 */
const {
  Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction
} = require('@solana/web3.js');
const {
  createTransferInstruction, getOrCreateAssociatedTokenAccount
} = require('@solana/spl-token');
const bs58 = require('bs58');

class X402Client {
  /**
   * @param {string} rpcUrl    Solana RPC URL
   * @param {string} secretKey base58-encoded secret key of the paying wallet
   * @param {object} opts      { maxSpendPerCallUsdc?: number, log?: fn }
   */
  constructor(rpcUrl, secretKey, opts = {}) {
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.payer = Keypair.fromSecretKey(bs58.decode(secretKey));
    this.maxSpend = opts.maxSpendPerCallUsdc ?? 0.02; // safety cap
    this.log = opts.log || (() => {});
    this.spentUsdc = 0;
    this.address = this.payer.publicKey.toBase58(); // paying wallet's public address
  }

  /** POST `url` with `body`, paying via x402 if challenged. Returns parsed JSON. */
  async fetch(url, body = {}) {
    const post = (headers = {}) => fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body)
    });

    let res = await post();
    if (res.status !== 402) return this._json(res);

    const challenge = await res.json();
    const accept = (challenge.accepts || [])[0];
    if (!accept) throw new Error('402 returned no accepts[] payment options');

    const { payTo, maxAmountRequired, asset } = accept;
    const microUsdc = parseInt(maxAmountRequired, 10);
    const usdc = microUsdc / 1e6;
    if (usdc > this.maxSpend) {
      throw new Error(`Refusing to pay ${usdc} USDC (cap ${this.maxSpend}) for ${url}`);
    }

    this.log(`paying ${usdc} USDC → ${payTo} for ${url}`);
    const sig = await this._payUsdc(payTo, asset, microUsdc);
    this.spentUsdc += usdc;
    this.log(`settled: https://solscan.io/tx/${sig}`);

    res = await post({ 'X-PAYMENT': sig });
    const out = await this._json(res);
    out.__receipt = { sig, usdc, payTo, url };
    return out;
  }

  async _payUsdc(payTo, mint, amount) {
    const mintPk = new PublicKey(mint);
    const sourceAta = await getOrCreateAssociatedTokenAccount(
      this.connection, this.payer, mintPk, this.payer.publicKey
    );
    const destAta = await getOrCreateAssociatedTokenAccount(
      this.connection, this.payer, mintPk, new PublicKey(payTo)
    );
    const ix = createTransferInstruction(
      sourceAta.address, destAta.address, this.payer.publicKey, amount
    );
    return sendAndConfirmTransaction(this.connection, new Transaction().add(ix), [this.payer]);
  }

  async _json(res) {
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error(`Non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`); }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    return data;
  }
}

module.exports = { X402Client };

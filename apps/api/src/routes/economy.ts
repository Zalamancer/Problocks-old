import { Hono } from 'hono';
import { getDb } from '../db/schema.js';
import { nanoid } from 'nanoid';

export const economyRouter = new Hono();

// Probux constants
const PROBUX_PER_PLAY = 1;        // creator earns 1 Probux per play
const PROBUX_PER_RATING = 5;      // creator earns 5 Probux per rating
const MIN_PAYOUT_AMOUNT = 1000;   // minimum 1000 Probux to request payout
const PROBUX_TO_USD = 0.01;       // 1 Probux = $0.01 USD

// GET /economy/wallet/:userId — get wallet balance
economyRouter.get('/wallet/:userId', (c) => {
  const db = getDb();
  const userId = c.req.param('userId');

  // Create wallet if doesn't exist
  db.prepare(`INSERT OR IGNORE INTO wallets (user_id) VALUES (?)`).run(userId);

  const wallet: any = db.prepare(`SELECT * FROM wallets WHERE user_id = ?`).get(userId);
  const recentTx = db.prepare(`
    SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
  `).all(userId);

  db.close();

  return c.json({
    balance: wallet.balance,
    totalEarned: wallet.total_earned,
    totalSpent: wallet.total_spent,
    balanceUsd: (wallet.balance * PROBUX_TO_USD).toFixed(2),
    recentTransactions: recentTx,
  });
});

// POST /economy/earn — credit Probux to a creator (called when sim is played)
economyRouter.post('/earn', async (c) => {
  const { user_id, amount, type, description, simulation_id } = await c.req.json();
  if (!user_id || !amount) return c.json({ error: 'user_id and amount required' }, 400);

  const db = getDb();

  // Create wallet if doesn't exist
  db.prepare(`INSERT OR IGNORE INTO wallets (user_id) VALUES (?)`).run(user_id);

  // Add transaction
  const txId = nanoid();
  db.prepare(`INSERT INTO transactions (id, user_id, type, amount, description, simulation_id) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(txId, user_id, type ?? 'play_earning', amount, description ?? '', simulation_id ?? null);

  // Update wallet
  db.prepare(`UPDATE wallets SET balance = balance + ?, total_earned = total_earned + ?, updated_at = datetime('now') WHERE user_id = ?`)
    .run(amount, amount, user_id);

  const wallet: any = db.prepare(`SELECT balance FROM wallets WHERE user_id = ?`).get(user_id);
  db.close();

  return c.json({ balance: wallet.balance, transaction_id: txId });
});

// POST /economy/spend — deduct Probux
economyRouter.post('/spend', async (c) => {
  const { user_id, amount, description } = await c.req.json();
  if (!user_id || !amount) return c.json({ error: 'user_id and amount required' }, 400);

  const db = getDb();
  const wallet: any = db.prepare(`SELECT balance FROM wallets WHERE user_id = ?`).get(user_id);

  if (!wallet || wallet.balance < amount) {
    db.close();
    return c.json({ error: 'Insufficient balance' }, 400);
  }

  const txId = nanoid();
  db.prepare(`INSERT INTO transactions (id, user_id, type, amount, description) VALUES (?, ?, ?, ?, ?)`)
    .run(txId, user_id, 'spend', -amount, description ?? '');

  db.prepare(`UPDATE wallets SET balance = balance - ?, total_spent = total_spent + ?, updated_at = datetime('now') WHERE user_id = ?`)
    .run(amount, amount, user_id);

  const updated: any = db.prepare(`SELECT balance FROM wallets WHERE user_id = ?`).get(user_id);
  db.close();

  return c.json({ balance: updated.balance, transaction_id: txId });
});

// POST /economy/payout — request USD payout via Stripe
economyRouter.post('/payout', async (c) => {
  const { user_id, amount } = await c.req.json();
  if (!user_id || !amount) return c.json({ error: 'user_id and amount required' }, 400);

  if (amount < MIN_PAYOUT_AMOUNT) {
    return c.json({ error: `Minimum payout is ${MIN_PAYOUT_AMOUNT} Probux ($${(MIN_PAYOUT_AMOUNT * PROBUX_TO_USD).toFixed(2)})` }, 400);
  }

  const db = getDb();
  const wallet: any = db.prepare(`SELECT balance FROM wallets WHERE user_id = ?`).get(user_id);

  if (!wallet || wallet.balance < amount) {
    db.close();
    return c.json({ error: 'Insufficient balance' }, 400);
  }

  // Create payout request
  const payoutId = nanoid();
  db.prepare(`INSERT INTO payout_requests (id, user_id, amount) VALUES (?, ?, ?)`)
    .run(payoutId, user_id, amount);

  // Deduct from wallet
  const txId = nanoid();
  db.prepare(`INSERT INTO transactions (id, user_id, type, amount, description) VALUES (?, ?, ?, ?, ?)`)
    .run(txId, user_id, 'payout', -amount, `Payout request #${payoutId}`);

  db.prepare(`UPDATE wallets SET balance = balance - ?, updated_at = datetime('now') WHERE user_id = ?`)
    .run(amount, user_id);

  db.close();

  const usdAmount = (amount * PROBUX_TO_USD).toFixed(2);

  return c.json({
    payout_id: payoutId,
    amount_probux: amount,
    amount_usd: usdAmount,
    status: 'pending',
    message: `Payout of $${usdAmount} requested. Will be processed via Stripe.`,
  });
});

// GET /economy/leaderboard — top earners
economyRouter.get('/leaderboard', (c) => {
  const db = getDb();
  const leaders = db.prepare(`
    SELECT w.user_id, w.total_earned, w.balance, u.username, u.display_name
    FROM wallets w JOIN users u ON w.user_id = u.id
    ORDER BY w.total_earned DESC
    LIMIT 20
  `).all();
  db.close();

  return c.json({ leaderboard: leaders });
});

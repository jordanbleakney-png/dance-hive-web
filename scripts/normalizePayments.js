// Normalize payments: convert amounts in pence to pounds and remove obvious duplicates
// Usage:
//   node scripts/normalizePayments.js           # convert amounts >= 100 to amount/100
//   node scripts/normalizePayments.js --dedupe  # also remove duplicates within 2 minutes (keep smaller amount)

const path = require('path');
const fs = require('fs');
const { MongoClient } = require('mongodb');

// Load .env.local
(() => {
  const dotenvPath = path.resolve(__dirname, '..', '.env.local');
  try {
    if (fs.existsSync(dotenvPath)) {
      try { require('dotenv').config({ path: dotenvPath }); } catch {}
      const raw = fs.readFileSync(dotenvPath, 'utf8');
      for (const line of raw.split(/\r?\n/)) {
        const t = line.trim(); if (!t || t.startsWith('#')) continue;
        const i = t.indexOf('='); if (i === -1) continue;
        const k = t.slice(0, i).trim(); const v = t.slice(i+1).trim();
        if (k && !(k in process.env)) process.env[k] = v;
      }
    }
  } catch {}
})();

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'danceHive';
if (!uri) { console.error('MONGODB_URI missing'); process.exit(1); }

const args = process.argv.slice(2);
const doDedupe = args.includes('--dedupe');

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const col = db.collection('payments');

  const toFix = await col.find({ amount: { $gte: 100 } }).toArray();
  let fixed = 0;
  for (const p of toFix) {
    const newAmt = Math.round(Number(p.amount) / 100);
    await col.updateOne({ _id: p._id }, { $set: { amount: newAmt } });
    fixed++;
  }

  let removed = 0;
  if (doDedupe) {
    // naive dedupe: for each email, sort by createdAt desc, if two records within 2 minutes keep the smaller amount
    const all = await col.find({}).sort({ email: 1, createdAt: -1 }).toArray();
    const byEmail = new Map();
    for (const p of all) {
      const k = String(p.email).toLowerCase();
      if (!byEmail.has(k)) byEmail.set(k, []);
      byEmail.get(k).push(p);
    }
    const toDeleteIds = [];
    for (const list of byEmail.values()) {
      for (let i = 0; i < list.length - 1; i++) {
        const a = list[i];
        for (let j = i + 1; j < list.length; j++) {
          const b = list[j];
          const dt = Math.abs(new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          if (dt <= 2 * 60 * 1000) {
            const keep = a.amount <= b.amount ? a : b;
            const remove = a.amount <= b.amount ? b : a;
            toDeleteIds.push(remove._id);
          } else {
            break; // list is sorted desc by createdAt
          }
        }
      }
    }
    if (toDeleteIds.length) {
      await col.deleteMany({ _id: { $in: toDeleteIds } });
      removed = toDeleteIds.length;
    }
  }

  console.log(`Payments normalized. Amounts fixed: ${fixed}. Duplicates removed: ${removed}.`);
  await client.close();
}

main().catch((e) => { console.error('normalizePayments failed', e); process.exit(1); });


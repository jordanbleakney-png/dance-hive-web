// Backfill user names, child details, and optional classId/enrollments from trialBookings
// Usage: node scripts/backfillUsers.js

const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');

// Load .env.local (without requiring dotenv)
(() => {
  const dotenvPath = path.resolve(__dirname, '..', '.env.local');
  try {
    if (fs.existsSync(dotenvPath)) {
      try {
        // Prefer dotenv if installed
        // eslint-disable-next-line global-require
        require('dotenv').config({ path: dotenvPath });
      } catch (e) {
        // Manual parse fallback
        const raw = fs.readFileSync(dotenvPath, 'utf8');
        for (const line of raw.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eq = trimmed.indexOf('=');
          if (eq === -1) continue;
          const key = trimmed.slice(0, eq).trim();
          const val = trimmed.slice(eq + 1).trim();
          if (key && !(key in process.env)) process.env[key] = val;
        }
      }
    }
  } catch {}
})();

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'danceHive';

if (!uri) {
  console.error('MONGODB_URI is not defined in environment variables.');
  process.exit(1);
}

function normalizeEmail(v) {
  return typeof v === 'string' ? v.toLowerCase().trim() : v;
}

function computeParentName(trial) {
  if (trial?.parent && (trial.parent.firstName || trial.parent.lastName)) {
    return [trial.parent.firstName || '', trial.parent.lastName || ''].join(' ').trim();
  }
  return trial?.parentName || '';
}

function computeChild(trial) {
  if (trial?.child && (trial.child.firstName || trial.child.lastName)) {
    const full = [trial.child.firstName || '', trial.child.lastName || ''].join(' ').trim();
    return { name: full, age: Number(trial.child.age) || null };
  }
  return { name: trial?.childName || trial?.studentName || '', age: Number(trial?.childAge) || Number(trial?.age) || null };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { purge: false, purgePattern: null, purgeBefore: null, dryRun: false };
  for (const a of args) {
    if (a === '--purge') opts.purge = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a.startsWith('--purgePattern=')) {
      const pat = a.split('=')[1];
      try { opts.purgePattern = new RegExp(pat, 'i'); } catch {}
    } else if (a.startsWith('--purgeBefore=')) {
      const val = a.split('=')[1];
      const d = new Date(val);
      if (!isNaN(d.getTime())) opts.purgeBefore = d;
    }
  }
  // Env fallbacks
  if (!opts.purgePattern && process.env.BACKFILL_PURGE_PATTERN) {
    try { opts.purgePattern = new RegExp(process.env.BACKFILL_PURGE_PATTERN, 'i'); } catch {}
  }
  if (!opts.purgeBefore && process.env.BACKFILL_PURGE_BEFORE) {
    const d = new Date(process.env.BACKFILL_PURGE_BEFORE);
    if (!isNaN(d.getTime())) opts.purgeBefore = d;
  }
  if (!opts.purge && process.env.BACKFILL_PURGE === '1') opts.purge = true;
  if (!opts.dryRun && process.env.DRY_RUN === '1') opts.dryRun = true;
  return opts;
}

async function main() {
  const opts = parseArgs();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  const usersCol = db.collection('users');
  const trialsCol = db.collection('trialBookings');
  const enrollCol = db.collection('enrollments');

  const users = await usersCol.find({}, { projection: { _id: 1, email: 1, name: 1, parentName: 1, childName: 1, studentName: 1, age: 1, membership: 1, createdAt: 1 } }).toArray();

  let updated = 0;
  let enrollmentsCreated = 0;

  for (const u of users) {
    const email = normalizeEmail(u.email);
    if (!email) continue;

    // Find most recent trial for this email
    const trial = await trialsCol
      .find({ email: { $regex: new RegExp(`^${email}$`, 'i') } })
      .sort({ createdAt: -1 })
      .limit(1)
      .next();

    const set = {};

    if (!u.name && (u.parentName || trial)) {
      const parentName = u.parentName || computeParentName(trial);
      if (parentName) set.name = parentName;
    }

    if ((!u.childName && !u.studentName) || u.age == null) {
      const child = computeChild(trial || {});
      if (child.name && !u.childName && !u.studentName) set.childName = child.name;
      if (child.age != null && (u.age == null || Number.isNaN(Number(u.age)))) set.age = child.age;
    }

    // Backfill membership.classId if missing and trial has classId
    if (trial?.classId) {
      const currentClassId = u?.membership?.classId;
      if (!currentClassId) {
        set['membership.classId'] = String(trial.classId);
      }
    }

    if (Object.keys(set).length) {
      await usersCol.updateOne({ _id: u._id }, { $set: set });
      updated++;
    }

    // Ensure enrollment exists if we have membership.classId
    const classId = (set['membership.classId'] || u?.membership?.classId) && String(set['membership.classId'] || u.membership.classId);
    if (classId) {
      let classObjId = null;
      try { classObjId = new ObjectId(classId); } catch {}
      const enrollFilter = classObjId ? { userId: u._id, classId: classObjId } : { userId: u._id, classId: classId };
      const exists = await enrollCol.findOne(enrollFilter);
      if (!exists) {
        await enrollCol.insertOne({ ...enrollFilter, status: 'active', attendedDates: [], createdAt: new Date() });
        enrollmentsCreated++;
      }
    }
  }

  console.log(`Updated users: ${updated}, enrollments created: ${enrollmentsCreated}`);

  // Optional purge of test users
  if (opts.purge) {
    const purgeFilter = {};
    if (opts.purgePattern) purgeFilter.email = { $regex: opts.purgePattern };
    if (opts.purgeBefore) purgeFilter.createdAt = { $lt: opts.purgeBefore };
    if (Object.keys(purgeFilter).length === 0) {
      console.log('Purge requested but no filter provided. Skipping.');
    } else {
      const toDelete = await usersCol.find(purgeFilter).project({ _id: 1, email: 1 }).toArray();
      console.log(`Matched ${toDelete.length} user(s) for purge.`);
      if (!opts.dryRun && toDelete.length) {
        const ids = toDelete.map(u => u._id);
        await usersCol.deleteMany({ _id: { $in: ids } });
        console.log(`Deleted ${ids.length} user(s).`);
        // Best-effort clean up related enrollments
        await db.collection('enrollments').deleteMany({ userId: { $in: ids } });
      } else if (opts.dryRun) {
        console.log('Dry run enabled. No deletions performed.');
      }
    }
  }
  await client.close();
}

main().catch((e) => {
  console.error('Backfill failed', e);
  process.exit(1);
});

'use strict';

/**
 * Create or update the single admin account's password.
 *
 * Usage:
 *   node scripts/set-admin-password.js <password>
 *   node scripts/set-admin-password.js            (prompts securely)
 *
 * The admin email comes from ADMIN_EMAIL in your .env file.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const db = require('../db');

const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
if (!email) {
  console.error('ERROR: ADMIN_EMAIL is not set in .env');
  process.exit(1);
}

function save(password) {
  if (!password || password.length < 8) {
    console.error('ERROR: password must be at least 8 characters.');
    process.exit(1);
  }
  const hash = bcrypt.hashSync(password, 12);
  const existing = db.prepare('SELECT id FROM admins WHERE email = ?').get(email);
  if (existing) {
    db.prepare('UPDATE admins SET password_hash = ? WHERE email = ?').run(hash, email);
    console.log(`Updated password for admin: ${email}`);
  } else {
    db.prepare('INSERT INTO admins (email, password_hash) VALUES (?, ?)').run(email, hash);
    console.log(`Created admin account: ${email}`);
  }
  process.exit(0);
}

const argPwd = process.argv[2];
if (argPwd) {
  save(argPwd);
} else {
  // Hidden prompt
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  process.stdout.write('New admin password (min 8 chars): ');
  const stdin = process.openStdin();
  process.stdin.on('data', (char) => {
    char = char + '';
    if (char === '\n' || char === '\r' || char === '\u0004') {
      process.stdin.pause();
    } else {
      process.stdout.write('\x1B[2K\x1B[200D New admin password (min 8 chars): ');
    }
  });
  rl.question('', (pwd) => {
    rl.close();
    console.log('');
    save(pwd.trim());
  });
}

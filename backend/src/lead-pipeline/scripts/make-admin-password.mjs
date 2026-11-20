// Usage (from backend/):  node src/lead-pipeline/scripts/make-admin-password.mjs
// Asks for a password (hidden) and prints the two lines to add to backend/.env.
import readline from 'node:readline';
import crypto from 'node:crypto';
import { hashPassword } from '../admin/auth.mjs';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
let muted = false;
const write = rl._writeToOutput;
rl._writeToOutput = function (s) { if (muted && !s.includes('\n')) rl.output.write('*'); else write.call(rl, s); };

rl.question('Choose an admin password (at least 10 characters): ', (password) => {
  muted = false;
  console.log('');
  if (password.length < 10) {
    console.error('Too short. Use at least 10 characters.');
    rl.close();
    process.exit(1);
  }
  console.log('\nAdd these two lines to backend/.env (then restart the server):\n');
  console.log(`ADMIN_PASSWORD_HASH=${hashPassword(password)}`);
  console.log(`ADMIN_TOKEN_SECRET=${crypto.randomBytes(32).toString('hex')}\n`);
  rl.close();
});
muted = true;

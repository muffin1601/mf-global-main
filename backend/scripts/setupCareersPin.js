const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcrypt');

const envPath = path.resolve(__dirname, '..', '.env');

function readHiddenPin(prompt) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || !process.stdin.setRawMode) {
      reject(new Error('Run this script in an interactive terminal.'));
      return;
    }
    let pin = '';
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const finish = (error) => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(pin);
    };
    const onData = (buffer) => {
      for (const char of buffer.toString()) {
        if (char === '\u0003') return finish(new Error('Cancelled.'));
        if (char === '\r' || char === '\n') return finish();
        if (char === '\u007f' || char === '\b') {
          if (pin) { pin = pin.slice(0, -1); process.stdout.write('\b \b'); }
        } else if (/^[0-9]$/.test(char) && pin.length < 6) {
          pin += char;
          process.stdout.write('*');
        }
      }
    };
    process.stdin.on('data', onData);
  });
}

async function main() {
  const pin = await readHiddenPin('Choose a 6-digit Careers admin PIN: ');
  if (!/^\d{6}$/.test(pin)) throw new Error('PIN must contain exactly 6 digits.');
  const confirmation = await readHiddenPin('Confirm the PIN: ');
  if (pin !== confirmation) throw new Error('PINs did not match. No changes made.');
  const hash = await bcrypt.hash(pin, 12);
  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const withoutOld = existing.split(/\r?\n/).filter(line => !/^\s*CAREERS_ADMIN_PIN_HASH\s*=/.test(line)).join('\n').replace(/\n*$/, '');
  fs.writeFileSync(envPath, `${withoutOld}${withoutOld ? '\n' : ''}CAREERS_ADMIN_PIN_HASH=${hash}\n`, { mode: 0o600 });
  console.log('PIN hash saved to backend/.env. Restart the backend, then enter your chosen PIN at /careers/admin.');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });

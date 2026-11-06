const bcrypt = require('bcrypt');
const pin = process.argv[2];
if (!/^\d{6}$/.test(pin || '')) {
  console.error('Usage: node scripts/hashCareersPin.js <six-digit PIN>');
  process.exit(1);
}
bcrypt.hash(pin, 12).then(value => console.log(`CAREERS_ADMIN_PIN_HASH=${value}`));

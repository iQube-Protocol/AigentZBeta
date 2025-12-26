/**
 * Safe diagnostic script for .env.production
 * Shows which keys are SET or EMPTY without leaking values
 */

const fs = require('fs');

try {
  const content = fs.readFileSync('.env.production', 'utf8').trim();
  const lines = content.split('\n').filter(Boolean);
  
  for (const line of lines) {
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;
    
    const key = line.substring(0, eqIndex);
    const value = line.substring(eqIndex + 1);
    
    console.log(key + '=' + (value ? '[SET]' : '[EMPTY]'));
  }
} catch (err) {
  console.error('Error reading .env.production:', err.message);
  process.exit(1);
}

// Quick env verification
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');

console.log('========== ENV VARIABLES ==========');
envContent.split('\n').forEach(line => {
  if (line.trim() && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').trim();
    if (key.includes('API_KEY')) {
      console.log(`${key.trim()}:`, value ? `${value.substring(0, 20)}... (${value.length} chars)` : 'EMPTY');
    }
  }
});
console.log('===================================');

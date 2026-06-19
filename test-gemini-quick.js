// Quick Gemini API Test
const https = require('https');

const API_KEY = 'AQ.Ab8RN6K7I5eyRkP2UM9pNFOXO7drnP_Lo6GyzviMm6EpdRnPeQA';

const data = JSON.stringify({
  contents: [{
    parts: [{
      text: 'Say hello in one sentence.'
    }]
  }]
});

const options = {
  hostname: 'generativelanguage.googleapis.com',
  path: `/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${API_KEY}`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('Testing Gemini API...');

const req = https.request(options, (res) => {
  let response = '';
  
  console.log('Status:', res.statusCode);
  
  res.on('data', (chunk) => {
    response += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      const parsed = JSON.parse(response);
      console.log('✅ Success!');
      console.log('Response:', parsed.candidates[0].content.parts[0].text);
    } else {
      console.log('❌ Failed');
      console.log('Error:', response);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request failed:', e.message);
});

req.write(data);
req.end();

// Test @google/genai SDK
import { GoogleGenAI } from '@google/genai';

const API_KEY = 'AQ.Ab8RN6K7I5eyRkP2UM9pNFOXO7drnP_Lo6GyzviMm6EpdRnPeQA';

console.log('Testing @google/genai SDK...');
console.log('API Key:', API_KEY.substring(0, 20) + '...');

try {
  const genAI = new GoogleGenAI({ apiKey: API_KEY });
  
  console.log('SDK initialized');
  
  const result = await genAI.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: 'Say hello in one sentence.'
  });
  
  console.log('✅ Success!');
  console.log('Response:', result.text);
} catch (error) {
  console.log('❌ Failed');
  console.log('Error:', error.message);
  console.log('Status:', error.status || error.statusCode || error.code);
  console.log('Full error:', JSON.stringify(error, null, 2));
}

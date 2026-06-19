// Debug script to test Gemini API authentication
// Using REST API directly (supports AQ. authorization keys)

const API_KEY = process.env.GEMINI_API_KEY

console.log('========== GEMINI AUTH DEBUG ==========')
console.log('Node.js version:', process.version)
console.log('API Key exists:', !!API_KEY)
console.log('API Key prefix:', API_KEY?.substring(0, 5) || 'N/A')
console.log('API Key length:', API_KEY?.length || 0)

if (!API_KEY) {
  console.error('❌ GEMINI_API_KEY not found in environment')
  process.exit(1)
}

// Check API key format
if (API_KEY.startsWith('AIza')) {
  console.log('✅ API Key format: Standard Gemini API key (AIza prefix)')
} else if (API_KEY.startsWith('AQ.')) {
  console.log('✅ API Key format: Authorization key (AQ. prefix) - SUPPORTED by REST API')
} else {
  console.log('⚠️ API Key format: Unknown prefix')
}

console.log('=====================================\n')

// Test REST API directly
console.log('Testing Gemini REST API (direct fetch)...\n')

async function testGemini() {
  try {
    console.log('1. Calling Gemini REST API...')
    console.log('   Model: gemini-2.5-flash')
    console.log('   Auth method: x-goog-api-key header (supports AQ. keys)')
    console.log('   Prompt: "Say hello in 3 words"\n')

    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': API_KEY,
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: 'Say hello in 3 words'
          }]
        }]
      }),
    })

    console.log('   Response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('   ❌ Error response:', errorText)
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text

    console.log('   ✅ Response received:', text)
    console.log('\n✅ SUCCESS - Gemini REST API is working correctly with AQ. key')
  } catch (error: any) {
    console.error('\n❌ FAILED - Error occurred:')
    console.error('Error message:', error.message)
    
    if (error.message.includes('401')) {
      console.error('\n🔍 DIAGNOSIS: 401 Unauthorized')
      console.error('Possible causes:')
      console.error('1. The API key might be invalid or expired')
      console.error('2. The Generative Language API might not be enabled in Cloud Console')
      console.error('3. The API key might not have permission for this project')
    }
    
    process.exit(1)
  }
}

testGemini()

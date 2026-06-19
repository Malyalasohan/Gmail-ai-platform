// Runtime Test Script - Identify Root Cause Issues
import * as fs from 'fs'
import * as path from 'path'

// Load env manually
const envPath = path.join(__dirname, '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=')
    if (key && valueParts.length) {
      process.env[key.trim()] = valueParts.join('=').trim()
    }
  })
}

console.log('========== ENVIRONMENT CHECK ==========')
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? `${process.env.GEMINI_API_KEY.substring(0, 20)}...` : 'NOT SET')
console.log('NVIDIA_NIM_API_KEY:', process.env.NVIDIA_NIM_API_KEY ? `${process.env.NVIDIA_NIM_API_KEY.substring(0, 20)}...` : 'NOT SET')
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET')
console.log('======================================\n')

async function testAIProvider() {
  console.log('========== AI PROVIDER TEST ==========')
  
  try {
    const { safeGenerateContent } = await import('./lib/ai-provider')
    
    console.log('Testing AI provider with simple prompt...')
    const result = await safeGenerateContent('Say "Hello, world!" in one sentence.')
    
    console.log('Success:', result.success)
    console.log('Text:', result.text?.substring(0, 100))
    console.log('Error:', result.error)
    
    if (!result.success) {
      console.error('❌ AI Provider Failed')
      if (result.error) {
        console.error('Error details:', JSON.stringify(result.error, null, 2))
      }
    } else {
      console.log('✅ AI Provider Working')
    }
  } catch (error: any) {
    console.error('❌ Exception in AI provider:', error.message)
    console.error('Stack:', error.stack)
  }
  
  console.log('=====================================\n')
}

async function testGeminiDirectly() {
  console.log('========== GEMINI DIRECT TEST ==========')
  
  try {
    const { GoogleGenAI } = await import('@google/genai')
    const apiKey = process.env.GEMINI_API_KEY
    
    if (!apiKey) {
      console.error('❌ GEMINI_API_KEY not set')
      return
    }
    
    console.log('Creating GenAI client...')
    const genAI = new GoogleGenAI({ apiKey })
    
    console.log('Calling Gemini API...')
    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Say hello in one sentence.',
    })
    
    console.log('Result:', result.text)
    console.log('✅ Gemini API Working')
  } catch (error: any) {
    console.error('❌ Gemini API Failed')
    console.error('Error:', error.message)
    console.error('Status:', error.status || error.statusCode || error.code)
    console.error('Full error:', JSON.stringify(error, null, 2))
  }
  
  console.log('======================================\n')
}

async function testNVIDIA() {
  console.log('========== NVIDIA NIM TEST ==========')
  
  try {
    const apiKey = process.env.NVIDIA_NIM_API_KEY
    
    if (!apiKey) {
      console.error('❌ NVIDIA_NIM_API_KEY not set')
      return
    }
    
    console.log('Calling NVIDIA NIM API...')
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-405b-instruct',
        messages: [
          {
            role: 'user',
            content: 'Say hello in one sentence.',
          },
        ],
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 100,
      }),
    })
    
    console.log('Status:', response.status)
    console.log('Status Text:', response.statusText)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ NVIDIA API Error:', errorText)
    } else {
      const data = await response.json()
      console.log('Response:', data.choices[0]?.message?.content)
      console.log('✅ NVIDIA API Working')
    }
  } catch (error: any) {
    console.error('❌ NVIDIA API Failed')
    console.error('Error:', error.message)
  }
  
  console.log('====================================\n')
}

async function main() {
  console.log('Starting Runtime Tests...\n')
  
  await testAIProvider()
  await testGeminiDirectly()
  await testNVIDIA()
  
  console.log('All tests completed.')
}

main().catch(console.error)

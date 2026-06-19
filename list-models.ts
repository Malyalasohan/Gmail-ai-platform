// List available Gemini models
const API_KEY = process.env.GEMINI_API_KEY

if (!API_KEY) {
  console.error('❌ GEMINI_API_KEY not found')
  process.exit(1)
}

async function listModels() {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Error:', response.status, errorText)
      return
    }
    
    const data = await response.json()
    
    console.log('Available models:')
    console.log('================')
    
    if (data.models) {
      data.models.forEach((model: any) => {
        console.log(`\n  Name: ${model.name}`)
        console.log(`  Display: ${model.displayName}`)
        console.log(`  Methods: ${model.supportedGenerationMethods?.join(', ')}`)
      })
    } else {
      console.log('No models found')
    }
  } catch (error: any) {
    console.error('Failed:', error.message)
  }
}

listModels()

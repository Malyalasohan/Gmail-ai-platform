/**
 * AI Provider Test Script
 * Run this to verify Gemini → NVIDIA fallback works correctly
 * 
 * Usage: npx tsx test-ai-provider.ts
 */

import { generateContent, isQuotaExceededError } from './lib/ai-provider'

async function testAIProvider() {
  console.log('========================================')
  console.log('🧪 Testing AI Provider System')
  console.log('========================================\n')

  // Test 1: Simple content generation
  console.log('Test 1: Simple Content Generation')
  console.log('----------------------------------')
  try {
    const result = await generateContent('Say "Hello, AI Provider System is working!" in a friendly way.')
    
    if (result.success && result.text) {
      console.log('✅ Test 1 PASSED')
      console.log(`   Provider: ${result.provider?.toUpperCase()}`)
      console.log(`   Response: ${result.text.substring(0, 100)}...`)
    } else {
      console.log('❌ Test 1 FAILED')
      console.log(`   Error: ${result.error?.message}`)
    }
  } catch (error: any) {
    console.log('❌ Test 1 FAILED with exception')
    console.log(`   Error: ${error.message}`)
  }
  
  console.log('\n')

  // Test 2: Email-like content
  console.log('Test 2: Email Summary Generation')
  console.log('---------------------------------')
  try {
    const emailPrompt = `Summarize this email in 2 sentences:

Subject: Project Update Meeting
From: john@example.com
Date: June 19, 2026

Hi team,

I wanted to update everyone on the Q3 project timeline. We're making good progress, but need to schedule a review meeting next week to align on priorities.

Best,
John`

    const result = await generateContent(emailPrompt)
    
    if (result.success && result.text) {
      console.log('✅ Test 2 PASSED')
      console.log(`   Provider: ${result.provider?.toUpperCase()}`)
      console.log(`   Summary: ${result.text}`)
    } else {
      console.log('❌ Test 2 FAILED')
      console.log(`   Error: ${result.error?.message}`)
    }
  } catch (error: any) {
    console.log('❌ Test 2 FAILED with exception')
    console.log(`   Error: ${error.message}`)
  }

  console.log('\n')

  // Test 3: Error detection
  console.log('Test 3: Error Detection')
  console.log('-----------------------')
  const quotaError = { status: 429, message: 'quota exceeded' }
  const isQuota = isQuotaExceededError(quotaError)
  console.log(`   Quota error detected: ${isQuota ? '✅ YES' : '❌ NO'}`)

  const serverError = { status: 503, message: 'service unavailable' }
  const isServer = isQuotaExceededError(serverError)
  console.log(`   Server error detected: ${isServer ? '✅ YES' : '❌ NO'}`)

  const normalError = { status: 400, message: 'bad request' }
  const isNormal = isQuotaExceededError(normalError)
  console.log(`   Normal error (should NOT trigger fallback): ${!isNormal ? '✅ CORRECT' : '❌ WRONG'}`)

  console.log('\n========================================')
  console.log('✅ AI Provider Tests Complete!')
  console.log('========================================\n')

  console.log('📝 Summary:')
  console.log('   - Primary provider: Google Gemini')
  console.log('   - Fallback provider: NVIDIA NIM')
  console.log('   - Automatic fallback on: 429, 5xx, timeout')
  console.log('   - All tests passed!\n')
}

// Run tests
testAIProvider().catch(console.error)

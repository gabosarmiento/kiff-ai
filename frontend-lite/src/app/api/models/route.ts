import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL } from '@/lib/constants'
import { withTenantHeaders } from '@/lib/tenant'

// Fallback models - Qwen, DeepSeek, Kimi K2, and Llama models only
const FALLBACK_MODELS = [
  {
    id: "moonshotai/kimi-k2-instruct",
    name: "moonshotai/kimi-k2-instruct",
    provider: "groq",
    family: "Kimi K2", 
    modality: "text",
    status: "active",
    active: true,
    context_window: 131072
  },
  {
    id: "qwen/qwen3-32b",
    name: "qwen/qwen3-32b",
    provider: "groq",
    family: "Qwen3",
    modality: "text",
    status: "active",
    active: true,
    context_window: 32768
  },
  {
    id: "deepseek-r1-distill-llama-70b",
    name: "deepseek-r1-distill-llama-70b",
    provider: "groq",
    family: "DeepSeek R1",
    modality: "text",
    status: "active",
    active: true,
    context_window: 131072
  },
  {
    id: "llama-3.3-70b-versatile",
    name: "llama-3.3-70b-versatile", 
    provider: "groq",
    family: "Llama 3.3",
    modality: "text",
    status: "active",
    active: true,
    context_window: 131072
  },
  {
    id: "llama-3.1-8b-instant",
    name: "llama-3.1-8b-instant",
    provider: "groq",
    family: "Llama 3.1",
    modality: "text",
    status: "active", 
    active: true,
    context_window: 131072
  },
  {
    id: "llama3-70b-8192",
    name: "llama3-70b-8192",
    provider: "groq",
    family: "Llama 3",
    modality: "text",
    status: "active",
    active: true,
    context_window: 8192
  }
]

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/models/`, {
      method: 'GET',
      headers: withTenantHeaders(),
      cache: 'no-store'
    })

    if (!response.ok) {
      console.warn('Backend models API unavailable, using fallback models')
      return NextResponse.json(FALLBACK_MODELS)
    }

    const data = await response.json()
    
    // If backend returns empty array or no data, use fallbacks
    if (!data || (Array.isArray(data) && data.length === 0)) {
      console.warn('Backend returned empty models, using fallback models')
      return NextResponse.json(FALLBACK_MODELS)
    }
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Models API error, using fallback:', error)
    return NextResponse.json(FALLBACK_MODELS)
  }
}
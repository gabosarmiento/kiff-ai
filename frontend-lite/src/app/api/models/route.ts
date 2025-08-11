import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL } from '@/lib/constants'
import { withTenantHeaders } from '@/lib/tenant'

// Fallback models if backend is unavailable
const FALLBACK_MODELS = [
  {
    id: "kimi-k2",
    name: "Kimi K2 (default)",
    provider: "groq",
    family: "Kimi K2",
    modality: "text",
    status: "active",
    active: true,
    context_window: 131072
  },
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
  }
]

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/models`, {
      method: 'GET',
      headers: withTenantHeaders(),
      cache: 'no-store'
    })

    if (!response.ok) {
      console.warn('Backend models API unavailable, using fallback models')
      return NextResponse.json(FALLBACK_MODELS)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Models API error, using fallback:', error)
    return NextResponse.json(FALLBACK_MODELS)
  }
}
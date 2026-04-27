export const API_BASE = 'http://127.0.0.1:8000'

export async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`
  console.log(`[API] ${options.method || 'GET'} ${endpoint}`)
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    if (!response.ok) {
      console.error(`[API] Error: ${response.status} ${response.statusText}`)
      throw new Error(`API Error: ${response.statusText}`)
    }
    const data = await response.json()
    console.log(`[API] Success:`, data)
    return data
  } catch (error) {
    console.error(`[API] Exception:`, error)
    throw error
  }
}

export async function uploadCSV(file) {
  const url = `${API_BASE}/upload`
  const formData = new FormData()
  formData.append('file', file)
  console.log('[API] POST /upload')
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    })
    if (!response.ok) {
      console.error(`[API] Upload error: ${response.status} ${response.statusText}`)
      throw new Error(`Upload failed: ${response.statusText}`)
    }
    const data = await response.json()
    console.log('[API] Upload success:', data)
    return data
  } catch (error) {
    console.error('[API] Upload exception:', error)
    throw error
  }
}

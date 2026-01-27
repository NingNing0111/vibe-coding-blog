const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface ApiResponse<T> {
  data?: T
  error?: string
}

// 请求去重缓存：存储正在进行的请求
const pendingRequests = new Map<string, Promise<any>>()

// 请求去重工具：防止短时间内重复请求
export function getDeduplicatedRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const requestKey = `${options.method || 'GET'}:${endpoint}:${JSON.stringify(options.body || '')}`

  // 如果已有相同的请求正在进行，直接返回该 Promise
  if (pendingRequests.has(requestKey)) {
    return pendingRequests.get(requestKey)!
  }

  // 创建新请求
  const requestPromise = apiRequest<T>(endpoint, options)
    .finally(() => {
      // 请求完成后清除缓存（延迟清除，避免立即重复请求）
      setTimeout(() => {
        pendingRequests.delete(requestKey)
      }, 100)
    })

  pendingRequests.set(requestKey, requestPromise)
  return requestPromise
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: '请求失败' }))
    throw new Error(error.detail || '请求失败')
  }

  return response.json()
}

export async function apiPost<T>(endpoint: string, data: any): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function apiGet<T>(endpoint: string, useDeduplication = false): Promise<T> {
  if (useDeduplication) {
    return getDeduplicatedRequest<T>(endpoint, {
      method: 'GET',
    })
  }
  return apiRequest<T>(endpoint, {
    method: 'GET',
  })
}

export async function apiPut<T>(endpoint: string, data: any): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function apiDelete<T>(endpoint: string): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: 'DELETE',
  })
}

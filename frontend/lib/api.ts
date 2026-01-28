const CONFIGURED_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/** 获取实际请求用的 API 根地址，避免 HTTPS 页面请求 HTTP 导致混合内容被拦截（供同模块及直接 fetch 的组件使用） */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return CONFIGURED_API_URL
  try {
    const url = new URL(CONFIGURED_API_URL)
    // 同域时直接使用当前页面的 origin，保证协议一致（解决 Mixed Content：HTTPS 页请求 HTTP 被拦截）
    if (window.location.host === url.host) {
      return window.location.origin
    }
    // 跨域但当前页是 HTTPS 且配置为 HTTP 时，升级为 HTTPS
    if (window.location.protocol === 'https:' && url.protocol === 'http:') {
      return `https://${url.host}`
    }
  } catch (_) {}
  return CONFIGURED_API_URL
}

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

  const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
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

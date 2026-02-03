/**
 * EPUB 分块加载：通过 HTTP Range 请求分段下载大文件，避免一次性加载过久。
 * 与 epubjs 的 requestMethod 兼容：(url, type, withCredentials?, headers?) => Promise<ArrayBuffer | ...>
 */

const CHUNK_SIZE = 1024 * 1024 // 1MB 每块，平衡请求次数与首包速度
const PROGRESS_EVENT = 'epub-load-progress'

export interface EpubLoadProgress {
  loaded: number
  total: number
  percent: number
}

/** 派发加载进度，供阅读页订阅并显示进度条 */
export function dispatchEpubProgress(progress: EpubLoadProgress) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(PROGRESS_EVENT, { detail: progress })
  )
}

/** 订阅 EPUB 加载进度 */
export function onEpubProgress(cb: (p: EpubLoadProgress) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<EpubLoadProgress>).detail)
  window.addEventListener(PROGRESS_EVENT, handler)
  return () => window.removeEventListener(PROGRESS_EVENT, handler)
}

/** 非 binary 时使用的简单 request，与 epubjs 内部请求行为兼容 */
async function defaultRequest(
  url: string,
  type: string,
  withCredentials?: boolean,
  headers?: Record<string, string>
): Promise<unknown> {
  const res = await fetch(url, {
    method: 'GET',
    credentials: withCredentials ? 'include' : 'same-origin',
    headers: { ...headers },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  if (type === 'json') return res.json()
  if (type === 'blob') return res.blob()
  const buf = await res.arrayBuffer()
  if (type === 'binary' || type === 'arraybuffer') return buf
  const text = new TextDecoder().decode(buf)
  if (type === 'xml' || type?.toLowerCase?.() === 'xml') {
    return new DOMParser().parseFromString(text, 'text/xml')
  }
  if (type === 'xhtml') return new DOMParser().parseFromString(text, 'application/xhtml+xml')
  if (type === 'html' || type === 'htm') return new DOMParser().parseFromString(text, 'text/html')
  return buf
}

/**
 * 使用 Range 分块请求 URL，仅在 type === 'binary' 时使用；其他类型走默认 request。
 * 若服务端不支持 Range（无 Accept-Ranges 或返回 200），则退化为单次 GET。
 */
export function createChunkedRequest(): (
  url: string,
  type: string,
  withCredentials?: boolean,
  headers?: Record<string, string>
) => Promise<unknown> {
  return async function chunkedRequest(
    url: string,
    type: string,
    withCredentials?: boolean,
    headers?: Record<string, string>
  ): Promise<unknown> {
    if (type !== 'binary') {
      return defaultRequest(url, type, withCredentials, headers)
    }

    try {
      const total = await getContentLength(url, withCredentials, headers)
      if (total == null || total <= 0) {
        return fallbackSingleFetch(url, withCredentials, headers)
      }

      // 小文件直接一次拉取，避免多轮 Range 无意义
      if (total <= CHUNK_SIZE) {
        return fallbackSingleFetch(url, withCredentials, headers)
      }

      const chunks: ArrayBuffer[] = []
      let loaded = 0

      for (let start = 0; start < total; start += CHUNK_SIZE) {
        const end = Math.min(start + CHUNK_SIZE, total) - 1
        const res = await fetch(url, {
          method: 'GET',
          credentials: withCredentials ? 'include' : 'same-origin',
          headers: {
            ...headers,
            Range: `bytes=${start}-${end}`,
          },
        })

        if (!res.ok) {
          if (res.status === 416 || res.status === 200) {
            return fallbackSingleFetch(url, withCredentials, headers)
          }
          throw new Error(`HTTP ${res.status}`)
        }

        const isRangeSupported = res.status === 206
        if (!isRangeSupported) {
          const ab = await res.arrayBuffer()
          dispatchEpubProgress({ loaded: ab.byteLength, total: ab.byteLength, percent: 100 })
          return ab
        }

        const chunk = await res.arrayBuffer()
        chunks.push(chunk)
        loaded += chunk.byteLength
        const percent = total ? Math.min(99, Math.round((loaded / total) * 100)) : 0
        dispatchEpubProgress({ loaded, total, percent })
      }

      dispatchEpubProgress({ loaded: total, total, percent: 100 })
      return mergeArrayBuffers(chunks)
    } catch (_) {
      return fallbackSingleFetch(url, withCredentials, headers)
    }
  }
}

/** 供 epubjs epubInitOptions.requestMethod 使用：分块加载 binary，其余走默认 fetch */
export const chunkedRequestMethod = createChunkedRequest()

async function getContentLength(
  url: string,
  withCredentials?: boolean,
  headers?: Record<string, string>
): Promise<number | null> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      credentials: withCredentials ? 'include' : 'same-origin',
      headers: { ...headers },
    })
    if (!res.ok) return null
    const acceptRanges = res.headers.get('Accept-Ranges')
    if (acceptRanges !== 'bytes') return null
    const len = res.headers.get('Content-Length')
    if (len == null) return null
    const n = parseInt(len, 10)
    return Number.isNaN(n) ? null : n
  } catch {
    return null
  }
}

async function fallbackSingleFetch(
  url: string,
  withCredentials?: boolean,
  headers?: Record<string, string>
): Promise<ArrayBuffer> {
  const res = await fetch(url, {
    method: 'GET',
    credentials: withCredentials ? 'include' : 'same-origin',
    headers: { ...headers },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const ab = await res.arrayBuffer()
  dispatchEpubProgress({ loaded: ab.byteLength, total: ab.byteLength, percent: 100 })
  return ab
}

function mergeArrayBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  const total = buffers.reduce((sum, b) => sum + b.byteLength, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const b of buffers) {
    out.set(new Uint8Array(b), offset)
    offset += b.byteLength
  }
  return out.buffer
}

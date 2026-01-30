'use client'

import { useEffect } from 'react'
import { useConfig } from '@/contexts/ConfigContext'

const HEAD_MARKER = 'data-site-injected-head'
const FOOTER_MARKER = 'data-site-injected-footer'

/**
 * 将 HTML 字符串中的 script/link 等节点注入到 target 中并执行。
 * 会先移除 target 上已有带 marker 的容器，再注入新内容。
 */
function injectHtml(html: string, target: HTMLElement, marker: string) {
  if (!html?.trim()) return

  // 移除之前注入的容器
  const existing = target.querySelector(`[${marker}]`)
  if (existing) existing.remove()

  const container = document.createElement('div')
  container.setAttribute(marker, 'true')
  container.style.display = 'none'

  const temp = document.createElement('div')
  temp.innerHTML = html.trim()

  Array.from(temp.childNodes).forEach((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as HTMLElement
    if (el.tagName === 'SCRIPT') {
      const sourceScript = el as HTMLScriptElement
      const script = document.createElement('script')
      if (sourceScript.src) script.src = sourceScript.src
      else if (sourceScript.textContent) script.textContent = sourceScript.textContent
      Array.from(sourceScript.attributes).forEach((attr) => {
        if (attr.name !== 'src') script.setAttribute(attr.name, attr.value)
      })
      container.appendChild(script)
    } else {
      container.appendChild(el.cloneNode(true))
    }
  })

  target.appendChild(container)
}

export default function InjectScripts() {
  const { config } = useConfig()

  useEffect(() => {
    if (typeof document === 'undefined' || !config?.site_basic) return

    const headScript = config.site_basic.site_head_script ?? ''
    const footerScript = config.site_basic.site_footer_script ?? ''

    if (headScript.trim()) {
      injectHtml(headScript, document.head, HEAD_MARKER)
    } else {
      const existing = document.head.querySelector(`[${HEAD_MARKER}]`)
      if (existing) existing.remove()
    }

    if (footerScript.trim()) {
      injectHtml(footerScript, document.body, FOOTER_MARKER)
    } else {
      const existing = document.body.querySelector(`[${FOOTER_MARKER}]`)
      if (existing) existing.remove()
    }

    return () => {
      document.head.querySelector(`[${HEAD_MARKER}]`)?.remove()
      document.body.querySelector(`[${FOOTER_MARKER}]`)?.remove()
    }
  }, [config?.site_basic])

  return null
}

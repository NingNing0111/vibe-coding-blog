'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { apiGet } from '@/lib/api'

export interface SiteBasicConfig {
  site_title: string
  site_subtitle: string
  site_description: string
  site_keywords: string
  site_logo: string
  site_copyright: string
}

export interface BloggerSocial {
  type: string
  value: string
}

export interface BloggerConfig {
  blogger_avatar: string
  blogger_signature: string
  blogger_socials: BloggerSocial[]
}

export interface FriendlyLink {
  name: string
  url: string
  description?: string
}

export interface FriendlyLinksConfig {
  links: FriendlyLink[]
}

export interface PublicConfigs {
  site_basic: SiteBasicConfig
  blogger: BloggerConfig
  friendly_links: FriendlyLinksConfig
}

interface ConfigContextType {
  config: PublicConfigs | null
  loading: boolean
  refreshConfig: () => Promise<void>
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined)

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<PublicConfigs | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const data = await apiGet<PublicConfigs>('/api/v1/config/structured/all')
      setConfig(data)
    } catch (error) {
      console.error('Failed to fetch public configs:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [])

  useEffect(() => {
    const title = config?.site_basic?.site_title || process.env.NEXT_PUBLIC_SITE_TITLE
    if (title) {
      document.title = title
    }
  }, [config])

  return (
    <ConfigContext.Provider value={{ config, loading, refreshConfig: fetchConfig }}>
      {children}
    </ConfigContext.Provider>
  )
}

export function useConfig() {
  const context = useContext(ConfigContext)
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider')
  }
  return context
}

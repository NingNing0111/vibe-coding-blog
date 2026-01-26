import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import Cookies from "js-cookie"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Cookie工具函数
export function setTokenCookie(token: string) {
  // 设置cookie，7天过期
  Cookies.set('access_token', token, { expires: 7, sameSite: 'lax' })
}

export function getTokenCookie(): string | undefined {
  return Cookies.get('access_token')
}

export function removeTokenCookie() {
  Cookies.remove('access_token')
}

export function setRefreshTokenCookie(token: string) {
  Cookies.set('refresh_token', token, { expires: 30, sameSite: 'lax' })
}

export function removeRefreshTokenCookie() {
  Cookies.remove('refresh_token')
}

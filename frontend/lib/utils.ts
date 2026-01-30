import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import Cookies from "js-cookie"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Cookie工具函数（path: '/' 确保所有子路径如 /admin/config 都会带上 cookie，供 middleware 鉴权）
export function setTokenCookie(token: string) {
  Cookies.set('access_token', token, { expires: 7, sameSite: 'lax', path: '/' })
}

export function getTokenCookie(): string | undefined {
  return Cookies.get('access_token')
}

export function removeTokenCookie() {
  Cookies.remove('access_token')
}

export function setRefreshTokenCookie(token: string) {
  Cookies.set('refresh_token', token, { expires: 30, sameSite: 'lax', path: '/' })
}

export function removeRefreshTokenCookie() {
  Cookies.remove('refresh_token')
}

// 用户角色 Cookie（用于前端路由/权限展示，仅管理员可进后台）
export function setUserRoleCookie(role: string) {
  Cookies.set('user_role', role, { expires: 7, sameSite: 'lax', path: '/' })
}

export function getUserRoleCookie(): string | undefined {
  return Cookies.get('user_role')
}

export function removeUserRoleCookie() {
  Cookies.remove('user_role')
}

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // 预取请求（Link 预加载）可能不携带 cookie，不在此做鉴权重定向，交给客户端 layout 校验
  // 避免点击「配置中心」等链接时因预取被重定向到登录页
  const isPrefetch =
    request.headers.get('Next-Router-Prefetch') === '1' ||
    request.headers.get('Purpose') === 'prefetch'
  if (isPrefetch && request.nextUrl.pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  const token = request.cookies.get('access_token')?.value
  const userRole = request.cookies.get('user_role')?.value

  // 保护管理员路由：必须有 token 且角色为 ADMIN
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    if (userRole !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  // 书库/书架：仅登录用户可访问，未登录跳转登录页
  if (request.nextUrl.pathname.startsWith('/books')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/books', '/books/:path*']
}

import { NextRequest, NextResponse } from 'next/server'

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('airtrainr_token')?.value
  const { pathname } = req.nextUrl

  // Check maintenance mode (skip for admin paths so admins can still access)
  if (!pathname.startsWith('/admin')) {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (supabaseUrl && supabaseKey) {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/platform_settings?select=maintenance_mode&limit=1`,
          { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }, cache: 'no-store' }
        )
        if (res.ok) {
          const rows = await res.json()
          if (rows?.[0]?.maintenance_mode === true) {
            return NextResponse.redirect(new URL('/maintenance', req.url))
          }
        }
      }
    } catch {
      // If settings fetch fails, allow through — don't block the app
    }
  }

  // Skip auth check for maintenance page itself
  if (pathname === '/maintenance') {
    return NextResponse.next()
  }

  if (!token) {
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('returnTo', pathname)
    return NextResponse.redirect(loginUrl)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/maintenance'],
}

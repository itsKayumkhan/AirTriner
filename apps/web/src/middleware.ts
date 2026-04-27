import { NextRequest, NextResponse } from 'next/server'

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('airtrainr_token')?.value
  const { pathname } = req.nextUrl

  // Check maintenance mode (skip for admin paths so admins can still access).
  // Cache for 60s — settings rarely change and per-request lookup is wasteful.
  if (!pathname.startsWith('/admin')) {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (supabaseUrl && supabaseKey) {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/platform_settings?select=maintenance_mode&limit=1`,
          {
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
            next: { revalidate: 60 },
          }
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

  // Admin role gate (server-verified)
  if (pathname.startsWith('/admin')) {
    const uid = req.cookies.get('airtrainr_uid')?.value
    if (!uid) {
      return NextResponse.redirect(new URL('/auth/login', req.url))
    }
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (supabaseUrl && serviceKey) {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/users?select=role,is_suspended,deleted_at&id=eq.${encodeURIComponent(uid)}&limit=1`,
          { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, cache: 'no-store' }
        )
        if (!res.ok) {
          return NextResponse.redirect(new URL('/dashboard', req.url))
        }
        const rows = await res.json()
        const row = rows?.[0]
        if (!row || row.role !== 'admin' || row.is_suspended || row.deleted_at) {
          return NextResponse.redirect(new URL('/dashboard', req.url))
        }
      }
    } catch {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/maintenance'],
}

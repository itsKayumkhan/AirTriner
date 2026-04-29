// Mobile API client — mirrors apps/web/src/lib/api-fetch.ts.
// Sends the authenticated user id via x-airtrainr-uid header so the
// hardened server routes can identify the caller without trusting body fields.
//
// Important: server routes live under apps/web (Next.js). The mobile app must
// hit those same routes via Config.appUrl (the web origin), NOT Config.apiUrl
// which points at a separate v1 service.

import { Config } from './config';
import { supabase } from './supabase';

const TRAILING_SLASH = /\/+$/;

function resolveBase(): string {
    const base = Config.appUrl || 'https://airtrainr.com';
    return base.replace(TRAILING_SLASH, '');
}

async function getActiveUserId(): Promise<string | null> {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.user?.id ?? null;
    } catch {
        return null;
    }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const uid = await getActiveUserId();
    const headers = new Headers(init.headers as HeadersInit | undefined);
    if (uid) headers.set('x-airtrainr-uid', uid);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const url = path.startsWith('http') ? path : `${resolveBase()}${path.startsWith('/') ? '' : '/'}${path}`;
    return fetch(url, { ...init, headers });
}

export async function apiFetchJson<T = any>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await apiFetch(path, init);
    let parsed: any = null;
    try {
        parsed = await res.json();
    } catch {
        // non-json response
    }
    if (!res.ok) {
        const msg = parsed?.error || parsed?.message || `Request failed (${res.status})`;
        throw new Error(msg);
    }
    return parsed as T;
}

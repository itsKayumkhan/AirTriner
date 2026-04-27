"use client";

import { getSession } from "./auth";

export async function adminFetch(input: string, init: RequestInit = {}): Promise<Response> {
    const session = getSession();
    const headers = new Headers(init.headers || {});
    if (session?.id) headers.set("x-admin-user-id", session.id);
    return fetch(input, { ...init, headers });
}

"use client";

import { getSession } from "./auth";

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
    const session = getSession();
    const headers = new Headers(init.headers || {});
    if (session?.id) headers.set("x-airtrainr-uid", session.id);
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    return fetch(input, { ...init, headers });
}

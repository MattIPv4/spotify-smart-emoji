import config from './config.js';

const alphaNum = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const redirectUri = () => window.location.origin + window.location.pathname.replace(/\/$/, '');

const randomString = (length: number) => crypto.getRandomValues(new Uint8Array(length)).reduce((acc, x) => acc + alphaNum[x % alphaNum.length], "");

const sha256 = (plain: string) => window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain));

const base64 = (buffer: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

export const initializeAuth = async () => {
    const verifier = randomString(64);
    localStorage.setItem('pkce_verifier', verifier);
    const challenge = await sha256(verifier).then(base64);

    const query = new URL('https://accounts.spotify.com/authorize');
    query.searchParams.set('client_id', config.clientId);
    query.searchParams.set('response_type', 'code');
    query.searchParams.set('code_challenge_method', 'S256');
    query.searchParams.set('code_challenge', challenge);
    query.searchParams.set('redirect_uri', redirectUri());
    query.searchParams.set('scope', config.scopes.join(' '));

    window.location.href = query.toString();
};

export const completeAuth = async () => {
    const code = new URLSearchParams(window.location.search).get('code');
    const verifier = localStorage.getItem('pkce_verifier');
    if (!code || !verifier) {
        return null;
    }

    const resp = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: config.clientId,
            grant_type: 'authorization_code',
            code,
            code_verifier: verifier,
            redirect_uri: redirectUri(),
        }),
    });
    
    if (!resp.ok) {
        console.error('Invalid auth response:', { status: resp.status, statusText: resp.statusText, body: await resp.text().catch(() => '<unreadable>') });
        return null;
    }

    const data = await resp.json();
    if (!data || typeof data !== 'object' || !('access_token' in data) || typeof data.access_token !== 'string') {
        console.error('Invalid auth response:', data);
        return null;
    }

    return data.access_token as string;
};

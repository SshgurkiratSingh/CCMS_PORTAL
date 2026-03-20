export type CognitoTokens = {
  idToken: string;
  accessToken: string;
  refreshToken: string | null;
};

type RuntimeCognitoConfig = {
  region: string;
  clientId: string;
  clientSecret: string | null;
  domain: string;
  redirectUri: string;
  logoutUri: string;
  scopes: string;
};

type TokenEndpointResponse = {
  id_token?: string;
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
};

type StoredPkceState = {
  state: string;
  codeVerifier: string;
};

const PKCE_STORAGE_KEY = "ccms_cognito_pkce";

function getCognitoConfig(): RuntimeCognitoConfig {
  const region = process.env.NEXT_PUBLIC_COGNITO_REGION;
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  const clientSecret = process.env.NEXT_PUBLIC_COGNITO_CLIENT_SECRET ?? null;
  const domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
  const redirectUri = process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI;
  const logoutUri = process.env.NEXT_PUBLIC_COGNITO_LOGOUT_URI ?? redirectUri;
  const scopes = process.env.NEXT_PUBLIC_COGNITO_OAUTH_SCOPES ?? "openid email profile";

  if (!region || !clientId || !domain || !redirectUri || !logoutUri) {
    throw new Error(
      "Missing Cognito config. Set NEXT_PUBLIC_COGNITO_REGION, NEXT_PUBLIC_COGNITO_CLIENT_ID, NEXT_PUBLIC_COGNITO_DOMAIN, and NEXT_PUBLIC_COGNITO_REDIRECT_URI."
    );
  }

  return {
    region,
    clientId,
    clientSecret,
    domain: normalizeDomain(domain),
    redirectUri,
    logoutUri,
    scopes: scopes.trim(),
  };
}

function normalizeDomain(domain: string): string {
  const trimmed = domain.trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw new Error("NEXT_PUBLIC_COGNITO_DOMAIN cannot be empty.");
  }

  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function getAuthorizeUrl(input: {
  clientId: string;
  domain: string;
  redirectUri: string;
  scopes: string;
  codeChallenge: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    scope: input.scopes,
    code_challenge_method: "S256",
    code_challenge: input.codeChallenge,
    state: input.state,
  });

  return `${input.domain}/oauth2/authorize?${params.toString()}`;
}

function getTokenUrl(domain: string): string {
  return `${domain}/oauth2/token`;
}

function getLogoutUrl(input: {
  clientId: string;
  domain: string;
  logoutUri: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    logout_uri: input.logoutUri,
  });

  return `${input.domain}/logout?${params.toString()}`;
}

function getRandomString(size: number): string {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);

  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function toCodeChallenge(codeVerifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return base64UrlEncode(new Uint8Array(digest));
}

function savePkceState(value: StoredPkceState): void {
  window.sessionStorage.setItem(PKCE_STORAGE_KEY, JSON.stringify(value));
}

function consumePkceState(): StoredPkceState {
  const raw = window.sessionStorage.getItem(PKCE_STORAGE_KEY);
  window.sessionStorage.removeItem(PKCE_STORAGE_KEY);

  if (!raw) {
    throw new Error("Missing PKCE verifier in session storage. Restart login.");
  }

  const parsed = JSON.parse(raw) as StoredPkceState;
  if (!parsed?.state || !parsed?.codeVerifier) {
    throw new Error("Invalid PKCE session state. Restart login.");
  }

  return parsed;
}

function ensureBrowser(): void {
  if (typeof window === "undefined") {
    throw new Error("Cognito hosted login can only run in a browser context.");
  }
}

function parseTokenResponseBody(raw: string): TokenEndpointResponse {
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as TokenEndpointResponse;
  } catch {
    return {};
  }
}

function getTokenExchangeError(
  responseStatus: number,
  body: TokenEndpointResponse
): string {
  return (
    body.error_description ??
    body.error ??
    `Cognito token exchange failed (${responseStatus}).`
  );
}

function isInvalidClientError(body: TokenEndpointResponse): boolean {
  return body.error === "invalid_client" || body.error === "invalid_client_secret";
}

async function exchangeAuthorizationCode(input: {
  domain: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string | null;
  code: string;
  codeVerifier: string;
}): Promise<{ response: Response; parsed: TokenEndpointResponse }> {
  const baseParams = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    code_verifier: input.codeVerifier,
    client_id: input.clientId,
  });

  const basicHeaders: HeadersInit = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (input.clientSecret) {
    basicHeaders.Authorization = `Basic ${btoa(`${input.clientId}:${input.clientSecret}`)}`;
  }

  const firstResponse = await fetch(getTokenUrl(input.domain), {
    method: "POST",
    headers: basicHeaders,
    body: baseParams.toString(),
  });
  const firstParsed = parseTokenResponseBody(await firstResponse.text());

  if (
    firstResponse.ok ||
    !input.clientSecret ||
    !isInvalidClientError(firstParsed)
  ) {
    return { response: firstResponse, parsed: firstParsed };
  }

  const postParams = new URLSearchParams(baseParams);
  postParams.set("client_secret", input.clientSecret);

  const secondResponse = await fetch(getTokenUrl(input.domain), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: postParams.toString(),
  });
  const secondParsed = parseTokenResponseBody(await secondResponse.text());
  return { response: secondResponse, parsed: secondParsed };
}

export async function startHostedLogin(): Promise<void> {
  ensureBrowser();
  const { clientId, domain, redirectUri, scopes } = getCognitoConfig();
  const state = getRandomString(32);
  const codeVerifier = getRandomString(64);
  const codeChallenge = await toCodeChallenge(codeVerifier);

  savePkceState({ state, codeVerifier });

  const authorizeUrl = getAuthorizeUrl({
    clientId,
    domain,
    redirectUri,
    scopes,
    codeChallenge,
    state,
  });

  window.location.assign(authorizeUrl);
}

export async function completeHostedLogin(
  code: string,
  returnedState: string
): Promise<CognitoTokens> {
  ensureBrowser();
  if (!code || !returnedState) {
    throw new Error("Missing authorization code or state.");
  }

  const { clientId, clientSecret, domain, redirectUri } = getCognitoConfig();
  const stored = consumePkceState();

  if (stored.state !== returnedState) {
    throw new Error("Invalid OAuth state received from Cognito.");
  }

  const { response, parsed } = await exchangeAuthorizationCode({
    domain,
    redirectUri,
    clientId,
    clientSecret,
    code,
    codeVerifier: stored.codeVerifier,
  });

  if (!response.ok) {
    throw new Error(getTokenExchangeError(response.status, parsed));
  }

  if (!parsed.id_token || !parsed.access_token) {
    throw new Error("Cognito did not return a complete token set.");
  }

  return {
    idToken: parsed.id_token,
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token ?? null,
  };
}

export function getHostedLogoutRedirectUrl(): string {
  const { clientId, domain, logoutUri } = getCognitoConfig();
  return getLogoutUrl({ clientId, domain, logoutUri });
}

export function clearPendingLogin(): void {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(PKCE_STORAGE_KEY);
  }
}

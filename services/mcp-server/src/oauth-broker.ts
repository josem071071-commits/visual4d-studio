import { createHash, randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

interface OAuthBrokerOptions {
  issuer: string;
  publicOrigin: string;
  scopes: string[];
  transactionTtlMs?: number;
}

interface PendingAuthorization {
  clientId: string;
  downstreamRedirectUri: string;
  downstreamState: string;
  downstreamCodeChallenge: string;
  upstreamCodeVerifier: string;
  createdAt: number;
}

interface PendingTokenExchange extends PendingAuthorization {
  upstreamCode: string;
}

type JsonObject = Record<string, unknown>;

function base64url(value: Buffer): string {
  return value.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomUrlSafe(bytes = 32): string {
  return base64url(randomBytes(bytes));
}

function pkceChallenge(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}

function cors(res: ServerResponse): void {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "Authorization, Content-Type");
  res.setHeader("vary", "Origin");
}

function json(res: ServerResponse, status: number, body: unknown): void {
  cors(res);
  const data = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.setHeader("pragma", "no-cache");
  res.setHeader("content-length", Buffer.byteLength(data));
  res.end(data);
}

function redirect(res: ServerResponse, location: string): void {
  res.statusCode = 302;
  res.setHeader("location", location);
  res.setHeader("cache-control", "no-store");
  res.end();
}

async function readBody(req: IncomingMessage, maxBytes = 1024 * 1024): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += value.length;
    if (total > maxBytes) throw new Error("REQUEST_BODY_TOO_LARGE");
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function requiredParam(params: URLSearchParams, name: string): string {
  const value = params.get(name);
  if (!value) throw new Error(`MISSING_${name.toUpperCase()}`);
  return value;
}

export class OAuthBroker {
  private readonly issuer: string;
  private readonly publicOrigin: string;
  private readonly callbackUrl: string;
  private readonly scopes: string[];
  private readonly ttlMs: number;
  private readonly pendingAuthorizations = new Map<string, PendingAuthorization>();
  private readonly pendingTokens = new Map<string, PendingTokenExchange>();

  constructor(options: OAuthBrokerOptions) {
    this.issuer = options.issuer.replace(/\/$/, "");
    this.publicOrigin = options.publicOrigin.replace(/\/$/, "");
    this.callbackUrl = `${this.publicOrigin}/oauth/callback`;
    this.scopes = [...new Set(["openid", "profile", "email", "offline_access", ...options.scopes])];
    this.ttlMs = options.transactionTtlMs ?? 10 * 60 * 1000;
  }

  authorizationServerMetadata(): JsonObject {
    return {
      issuer: this.publicOrigin,
      authorization_endpoint: `${this.publicOrigin}/oauth/authorize`,
      token_endpoint: `${this.publicOrigin}/oauth/token`,
      registration_endpoint: `${this.publicOrigin}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: this.scopes,
    };
  }

  async handle(req: IncomingMessage, res: ServerResponse, requestUrl: URL): Promise<boolean> {
    this.cleanup();
    const path = requestUrl.pathname;
    if (!["/oauth/register", "/oauth/authorize", "/oauth/callback", "/oauth/token"].includes(path)) return false;

    if (req.method === "OPTIONS") {
      cors(res);
      res.statusCode = 204;
      res.setHeader("access-control-max-age", "86400");
      res.end();
      return true;
    }

    try {
      if (path === "/oauth/register") await this.register(req, res);
      else if (path === "/oauth/authorize") this.authorize(req, res, requestUrl);
      else if (path === "/oauth/callback") this.callback(req, res, requestUrl);
      else await this.token(req, res);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      json(res, 400, { error: "invalid_request", error_description: message });
    }
    return true;
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.ttlMs;
    for (const [key, value] of this.pendingAuthorizations) if (value.createdAt < cutoff) this.pendingAuthorizations.delete(key);
    for (const [key, value] of this.pendingTokens) if (value.createdAt < cutoff) this.pendingTokens.delete(key);
  }

  private async register(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });
    const body = JSON.parse(await readBody(req)) as JsonObject;
    const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((value): value is string => typeof value === "string") : [];
    if (redirectUris.length === 0) throw new Error("redirect_uris is required");
    const upstreamPayload: JsonObject = {
      ...body,
      redirect_uris: [...new Set([...redirectUris, this.callbackUrl])],
      token_endpoint_auth_method: "none",
    };
    const response = await fetch(`${this.issuer}/oauth/register`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(upstreamPayload),
    });
    const text = await response.text();
    cors(res);
    res.statusCode = response.status;
    res.setHeader("content-type", response.headers.get("content-type") ?? "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.end(text);
  }

  private authorize(req: IncomingMessage, res: ServerResponse, requestUrl: URL): void {
    if (req.method !== "GET") return json(res, 405, { error: "method_not_allowed" });
    const params = requestUrl.searchParams;
    const responseType = requiredParam(params, "response_type");
    const clientId = requiredParam(params, "client_id");
    const downstreamRedirectUri = requiredParam(params, "redirect_uri");
    const downstreamState = requiredParam(params, "state");
    const downstreamCodeChallenge = requiredParam(params, "code_challenge");
    const method = requiredParam(params, "code_challenge_method");
    if (responseType !== "code") throw new Error("ONLY_AUTHORIZATION_CODE_SUPPORTED");
    if (method !== "S256") throw new Error("PKCE_S256_REQUIRED");

    const upstreamState = randomUrlSafe(32);
    const upstreamCodeVerifier = randomUrlSafe(64);
    const upstreamChallenge = pkceChallenge(upstreamCodeVerifier);
    this.pendingAuthorizations.set(upstreamState, {
      clientId,
      downstreamRedirectUri,
      downstreamState,
      downstreamCodeChallenge,
      upstreamCodeVerifier,
      createdAt: Date.now(),
    });

    const upstream = new URL(`${this.issuer}/oauth/authorize`);
    for (const [key, value] of params) upstream.searchParams.append(key, value);
    upstream.searchParams.set("redirect_uri", this.callbackUrl);
    upstream.searchParams.set("state", upstreamState);
    upstream.searchParams.set("code_challenge", upstreamChallenge);
    upstream.searchParams.set("code_challenge_method", "S256");
    redirect(res, upstream.toString());
  }

  private callback(req: IncomingMessage, res: ServerResponse, requestUrl: URL): void {
    if (req.method !== "GET") return json(res, 405, { error: "method_not_allowed" });
    const upstreamState = requiredParam(requestUrl.searchParams, "state");
    const transaction = this.pendingAuthorizations.get(upstreamState);
    if (!transaction) throw new Error("OAUTH_TRANSACTION_NOT_FOUND_OR_EXPIRED");
    this.pendingAuthorizations.delete(upstreamState);

    const downstream = new URL(transaction.downstreamRedirectUri);
    const upstreamError = requestUrl.searchParams.get("error");
    if (upstreamError) {
      downstream.searchParams.set("error", upstreamError);
      const description = requestUrl.searchParams.get("error_description");
      if (description) downstream.searchParams.set("error_description", description);
      downstream.searchParams.set("state", transaction.downstreamState);
      return redirect(res, downstream.toString());
    }

    const upstreamCode = requiredParam(requestUrl.searchParams, "code");
    const downstreamCode = randomUrlSafe(32);
    this.pendingTokens.set(downstreamCode, { ...transaction, upstreamCode });
    downstream.searchParams.set("code", downstreamCode);
    downstream.searchParams.set("state", transaction.downstreamState);
    redirect(res, downstream.toString());
  }

  private async token(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });
    const params = new URLSearchParams(await readBody(req));
    const grantType = requiredParam(params, "grant_type");

    if (grantType === "authorization_code") {
      const downstreamCode = requiredParam(params, "code");
      const transaction = this.pendingTokens.get(downstreamCode);
      if (!transaction) throw new Error("AUTHORIZATION_CODE_NOT_FOUND_OR_EXPIRED");
      const clientId = requiredParam(params, "client_id");
      const redirectUri = requiredParam(params, "redirect_uri");
      const verifier = requiredParam(params, "code_verifier");
      if (clientId !== transaction.clientId) throw new Error("CLIENT_ID_MISMATCH");
      if (redirectUri !== transaction.downstreamRedirectUri) throw new Error("REDIRECT_URI_MISMATCH");
      if (pkceChallenge(verifier) !== transaction.downstreamCodeChallenge) throw new Error("PKCE_VERIFIER_MISMATCH");
      this.pendingTokens.delete(downstreamCode);

      const upstream = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: transaction.clientId,
        code: transaction.upstreamCode,
        redirect_uri: this.callbackUrl,
        code_verifier: transaction.upstreamCodeVerifier,
      });
      return this.forwardTokenRequest(res, upstream);
    }

    if (grantType === "refresh_token") {
      const upstream = new URLSearchParams(params);
      return this.forwardTokenRequest(res, upstream);
    }

    json(res, 400, { error: "unsupported_grant_type" });
  }

  private async forwardTokenRequest(res: ServerResponse, params: URLSearchParams): Promise<void> {
    const response = await fetch(`${this.issuer}/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: params,
    });
    const text = await response.text();
    cors(res);
    res.statusCode = response.status;
    res.setHeader("content-type", response.headers.get("content-type") ?? "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.setHeader("pragma", "no-cache");
    res.end(text);
  }
}

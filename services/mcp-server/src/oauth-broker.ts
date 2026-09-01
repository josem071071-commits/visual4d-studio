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
  downstreamScopes: string;
  resource: string;
  upstreamCodeVerifier: string;
  createdAt: number;
}

interface PendingTokenExchange extends PendingAuthorization {
  upstreamCode: string;
}

type JsonObject = Record<string, unknown>;

function base64url(value: Buffer) {
  return value
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function randomUrlSafe(bytes = 32) {
  return base64url(randomBytes(bytes));
}

function pkceChallenge(verifier: string) {
  return base64url(createHash("sha256").update(verifier).digest());
}

function cors(res: ServerResponse) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "Authorization, Content-Type");
  res.setHeader("vary", "Origin");
}

function json(res: ServerResponse, status: number, body: unknown) {
  cors(res);
  const data = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.setHeader("pragma", "no-cache");
  res.setHeader("content-length", Buffer.byteLength(data));
  res.end(data);
}

function redirect(res: ServerResponse, location: string) {
  res.statusCode = 302;
  res.setHeader("location", location);
  res.setHeader("cache-control", "no-store");
  res.end();
}

async function readBody(req: IncomingMessage, maxBytes = 1024 * 1024) {
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

function requiredParam(params: URLSearchParams, name: string) {
  const value = params.get(name);
  if (!value) throw new Error(`MISSING_${name.toUpperCase()}`);
  return value;
}

function safeUrl(value: string) {
  try {
    const url = new URL(value);
    return { origin: url.origin, pathname: url.pathname, hasQuery: url.search.length > 0 };
  } catch {
    return { origin: "invalid", pathname: "invalid", hasQuery: false };
  }
}

function trace(event: string, data: Record<string, unknown>) {
  console.error(`[oauth-broker] ${JSON.stringify({ event, ...data })}`);
}

function getScopeString(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export class OAuthBroker {
  private readonly issuer: string;
  private readonly publicOrigin: string;
  private readonly callbackUrl: string;
  private readonly resourceUri: string;
  private readonly scopes: string[];
  private readonly visualScopes: Set<string>;
  private readonly ttlMs: number;
  private readonly pendingAuthorizations = new Map<string, PendingAuthorization>();
  private readonly pendingTokens = new Map<string, PendingTokenExchange>();

  constructor(options: OAuthBrokerOptions) {
    this.issuer = options.issuer.replace(/\/$/, "");
    this.publicOrigin = options.publicOrigin.replace(/\/$/, "");
    this.callbackUrl = `${this.publicOrigin}/oauth/callback`;
    this.resourceUri = `${this.publicOrigin}/mcp`;
    this.visualScopes = new Set(options.scopes);
    this.scopes = [...new Set(options.scopes)];
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
      authorization_response_iss_parameter_supported: true,
    };
  }

  async handle(req: IncomingMessage, res: ServerResponse, requestUrl: URL) {
    this.cleanup();
    const path = requestUrl.pathname;
    if (!["/oauth/register", "/oauth/authorize", "/oauth/callback", "/oauth/token"].includes(path)) {
      return false;
    }

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
      trace("request_error", { path, method: req.method, error: message });
      json(res, 400, { error: "invalid_request", error_description: message });
    }
    return true;
  }

  private cleanup() {
    const cutoff = Date.now() - this.ttlMs;
    for (const [key, value] of this.pendingAuthorizations) {
      if (value.createdAt < cutoff) this.pendingAuthorizations.delete(key);
    }
    for (const [key, value] of this.pendingTokens) {
      if (value.createdAt < cutoff) this.pendingTokens.delete(key);
    }
  }

  private async register(req: IncomingMessage, res: ServerResponse) {
    if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });

    const body = JSON.parse(await readBody(req)) as JsonObject;
    const redirectUris = Array.isArray(body.redirect_uris)
      ? body.redirect_uris.filter((value): value is string => typeof value === "string")
      : [];
    if (redirectUris.length === 0) throw new Error("redirect_uris is required");

    const downstreamScope = getScopeString(body.scope);
    const upstreamPayload: JsonObject = {
      ...body,
      redirect_uris: [...new Set([...redirectUris, this.callbackUrl])],
      token_endpoint_auth_method: "none",
    };
    delete upstreamPayload.resource;
    delete upstreamPayload.scope;

    trace("register_request", {
      redirectUriCount: redirectUris.length,
      redirectUris: redirectUris.map(safeUrl),
      callback: safeUrl(this.callbackUrl),
      tokenEndpointAuthMethod: "none",
      downstreamScopePresent: Boolean(downstreamScope),
      upstreamScope: null,
      upstreamResourceForwarded: false,
    });

    const response = await fetch(`${this.issuer}/oauth/register`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(upstreamPayload),
    });
    const text = await response.text();

    trace("register_response", {
      status: response.status,
      contentType: response.headers.get("content-type") ?? null,
    });

    let downstreamText = text;
    if (response.ok) {
      try {
        const registered = JSON.parse(text) as JsonObject;
        if (downstreamScope) registered.scope = downstreamScope;
        else delete registered.scope;
        downstreamText = JSON.stringify(registered);
      } catch {
        trace("register_response_rewrite_skipped", { reason: "NON_JSON_RESPONSE" });
      }
    }

    cors(res);
    res.statusCode = response.status;
    res.setHeader("content-type", response.headers.get("content-type") ?? "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.end(downstreamText);
  }

  private authorize(req: IncomingMessage, res: ServerResponse, requestUrl: URL) {
    if (req.method !== "GET") return json(res, 405, { error: "method_not_allowed" });

    const params = requestUrl.searchParams;
    const responseType = requiredParam(params, "response_type");
    const clientId = requiredParam(params, "client_id");
    const downstreamRedirectUri = requiredParam(params, "redirect_uri");
    const downstreamState = requiredParam(params, "state");
    const downstreamCodeChallenge = requiredParam(params, "code_challenge");
    const method = requiredParam(params, "code_challenge_method");
    const resource = requiredParam(params, "resource");

    if (responseType !== "code") throw new Error("ONLY_AUTHORIZATION_CODE_SUPPORTED");
    if (method !== "S256") throw new Error("PKCE_S256_REQUIRED");
    if (resource !== this.resourceUri) throw new Error("RESOURCE_MISMATCH");

    const requestedScopes = (params.get("scope") ?? "").split(/\s+/).filter(Boolean);
    const unknownScopes = requestedScopes.filter((scope) => !this.scopes.includes(scope));
    if (unknownScopes.length) throw new Error("UNSUPPORTED_SCOPE");
    const downstreamScopes = requestedScopes.filter((scope) => this.visualScopes.has(scope)).join(" ");

    const upstreamState = randomUrlSafe(32);
    const upstreamCodeVerifier = randomUrlSafe(64);
    const upstreamChallenge = pkceChallenge(upstreamCodeVerifier);

    this.pendingAuthorizations.set(upstreamState, {
      clientId,
      downstreamRedirectUri,
      downstreamState,
      downstreamCodeChallenge,
      downstreamScopes,
      resource,
      upstreamCodeVerifier,
      createdAt: Date.now(),
    });

    trace("authorize_request", {
      redirectUri: safeUrl(downstreamRedirectUri),
      statePresent: Boolean(downstreamState),
      codeChallengePresent: Boolean(downstreamCodeChallenge),
      codeChallengeMethod: method,
      resourceMatches: resource === this.resourceUri,
      scope: params.get("scope") ?? null,
    });

    const upstream = new URL(`${this.issuer}/oauth/authorize`);
    for (const [key, value] of params) {
      if (key !== "scope" && key !== "resource") upstream.searchParams.append(key, value);
    }
    upstream.searchParams.delete("scope");
    upstream.searchParams.set("redirect_uri", this.callbackUrl);
    upstream.searchParams.set("state", upstreamState);
    upstream.searchParams.set("code_challenge", upstreamChallenge);
    upstream.searchParams.set("code_challenge_method", "S256");

    trace("authorize_redirect_upstream", {
      destination: safeUrl(upstream.toString()),
      callback: safeUrl(this.callbackUrl),
      downstreamScopesPreserved: Boolean(downstreamScopes),
      upstreamScope: null,
      upstreamResourceForwarded: false,
    });

    redirect(res, upstream.toString());
  }

  private callback(req: IncomingMessage, res: ServerResponse, requestUrl: URL) {
    if (req.method !== "GET") return json(res, 405, { error: "method_not_allowed" });

    const upstreamState = requiredParam(requestUrl.searchParams, "state");
    const transaction = this.pendingAuthorizations.get(upstreamState);
    trace("callback_received", {
      transactionFound: Boolean(transaction),
      codePresent: Boolean(requestUrl.searchParams.get("code")),
      error: requestUrl.searchParams.get("error"),
      iss: requestUrl.searchParams.get("iss") ?? null,
    });

    if (!transaction) throw new Error("OAUTH_TRANSACTION_NOT_FOUND_OR_EXPIRED");
    this.pendingAuthorizations.delete(upstreamState);

    const downstream = new URL(transaction.downstreamRedirectUri);
    const upstreamError = requestUrl.searchParams.get("error");
    if (upstreamError) {
      downstream.searchParams.set("error", upstreamError);
      const description = requestUrl.searchParams.get("error_description");
      if (description) downstream.searchParams.set("error_description", description);
      downstream.searchParams.set("state", transaction.downstreamState);
      downstream.searchParams.set("iss", this.publicOrigin);
      trace("callback_redirect_downstream_error", {
        destination: safeUrl(downstream.toString()),
        statePreserved: Boolean(transaction.downstreamState),
        error: upstreamError,
        iss: this.publicOrigin,
      });
      return redirect(res, downstream.toString());
    }

    const upstreamCode = requiredParam(requestUrl.searchParams, "code");
    const downstreamCode = randomUrlSafe(32);
    this.pendingTokens.set(downstreamCode, { ...transaction, upstreamCode });
    downstream.searchParams.set("code", downstreamCode);
    downstream.searchParams.set("state", transaction.downstreamState);
    downstream.searchParams.set("iss", this.publicOrigin);

    trace("callback_redirect_downstream_success", {
      destination: safeUrl(downstream.toString()),
      statePreserved: Boolean(transaction.downstreamState),
      downstreamCodeIssued: true,
      iss: this.publicOrigin,
      pendingTokenCount: this.pendingTokens.size,
    });

    redirect(res, downstream.toString());
  }

  private async token(req: IncomingMessage, res: ServerResponse) {
    if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });

    const params = new URLSearchParams(await readBody(req));
    const grantType = requiredParam(params, "grant_type");
    trace("token_request", {
      grantType,
      clientIdPresent: Boolean(params.get("client_id")),
      redirectUri: params.get("redirect_uri") ? safeUrl(params.get("redirect_uri")!) : null,
      codePresent: Boolean(params.get("code")),
      codeVerifierPresent: Boolean(params.get("code_verifier")),
      resource: params.get("resource") ?? null,
    });

    if (grantType === "authorization_code") {
      const downstreamCode = requiredParam(params, "code");
      const transaction = this.pendingTokens.get(downstreamCode);
      if (!transaction) throw new Error("AUTHORIZATION_CODE_NOT_FOUND_OR_EXPIRED");

      const clientId = requiredParam(params, "client_id");
      const redirectUri = requiredParam(params, "redirect_uri");
      const verifier = requiredParam(params, "code_verifier");
      const resource = requiredParam(params, "resource");

      if (clientId !== transaction.clientId) throw new Error("CLIENT_ID_MISMATCH");
      if (redirectUri !== transaction.downstreamRedirectUri) throw new Error("REDIRECT_URI_MISMATCH");
      if (resource !== transaction.resource || resource !== this.resourceUri) throw new Error("RESOURCE_MISMATCH");
      if (pkceChallenge(verifier) !== transaction.downstreamCodeChallenge) {
        throw new Error("PKCE_VERIFIER_MISMATCH");
      }

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
      upstream.delete("resource");
      return this.forwardTokenRequest(res, upstream);
    }

    json(res, 400, { error: "unsupported_grant_type" });
  }

  private async forwardTokenRequest(res: ServerResponse, params: URLSearchParams) {
    const response = await fetch(`${this.issuer}/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: params,
    });
    const text = await response.text();
    trace("token_upstream_response", {
      status: response.status,
      contentType: response.headers.get("content-type") ?? null,
    });

    cors(res);
    res.statusCode = response.status;
    res.setHeader("content-type", response.headers.get("content-type") ?? "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.setHeader("pragma", "no-cache");
    res.end(text);
  }
}

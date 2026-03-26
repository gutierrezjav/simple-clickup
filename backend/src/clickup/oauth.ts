import { ClickUpServiceError } from "./errors.js";
import { resolveClickUpAuthorizationHeader } from "./token.js";

export interface ClickUpOAuthConfig {
  apiBaseUrl: string;
  authorizeUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  timeoutMs: number;
}

interface ClickUpOAuthTokenResponse {
  access_token?: string;
}

interface ClickUpOAuthTeamsResponse {
  teams?: Array<{
    id?: string | number | null;
    name?: string | null;
  }>;
}

export interface ClickUpAuthorizedTeam {
  id: string;
  name: string;
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export class ClickUpOAuthClient {
  readonly #apiBaseUrl: string;
  readonly #authorizeUrl: string;
  readonly #clientId: string;
  readonly #clientSecret: string;
  readonly #redirectUri: string;
  readonly #timeoutMs: number;

  constructor(config: ClickUpOAuthConfig) {
    this.#apiBaseUrl = config.apiBaseUrl.replace(/\/+$/, "");
    this.#authorizeUrl = config.authorizeUrl.replace(/\/+$/, "");
    this.#clientId = config.clientId;
    this.#clientSecret = config.clientSecret;
    this.#redirectUri = config.redirectUri;
    this.#timeoutMs = config.timeoutMs;
  }

  getAuthorizationUrl(state: string): string {
    const url = new URL(this.#authorizeUrl);
    url.searchParams.set("client_id", this.#clientId);
    url.searchParams.set("redirect_uri", this.#redirectUri);
    url.searchParams.set("state", state);
    return url.toString();
  }

  async exchangeCodeForAccessToken(code: string): Promise<string> {
    const payload = (await this.#requestJson("/oauth/token", {
      body: JSON.stringify({
        client_id: this.#clientId,
        client_secret: this.#clientSecret,
        code,
        redirect_uri: this.#redirectUri
      }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    })) as ClickUpOAuthTokenResponse;

    if (typeof payload.access_token !== "string" || payload.access_token.length === 0) {
      throw new ClickUpServiceError(
        "ClickUp OAuth token exchange returned no access token.",
        502
      );
    }

    return payload.access_token;
  }

  async getAuthorizedTeams(accessToken: string): Promise<ClickUpAuthorizedTeam[]> {
    const payload = (await this.#requestJson("/team", {
      headers: {
        Authorization: resolveClickUpAuthorizationHeader(accessToken)
      }
    })) as ClickUpOAuthTeamsResponse;

    return (payload.teams ?? [])
      .map((team) => ({
        id:
          typeof team.id === "string"
            ? team.id
            : typeof team.id === "number"
              ? String(team.id)
              : "",
        name: typeof team.name === "string" ? team.name : ""
      }))
      .filter((team) => team.id.length > 0);
  }

  async #requestJson(pathname: string, init?: RequestInit): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);

    try {
      const response = await fetch(`${this.#apiBaseUrl}${pathname}`, {
        ...init,
        signal: controller.signal
      });

      if (!response.ok) {
        const errorPayload = await parseJson(response);
        const message =
          errorPayload &&
          typeof errorPayload === "object" &&
          "err" in errorPayload &&
          typeof errorPayload.err === "string"
            ? errorPayload.err
            : `ClickUp OAuth request failed with status ${response.status}.`;

        throw new ClickUpServiceError(message, response.status === 401 ? 401 : 502);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ClickUpServiceError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new ClickUpServiceError("ClickUp OAuth request timed out.", 504);
      }

      throw new ClickUpServiceError("Failed to reach ClickUp OAuth endpoints.", 502);
    } finally {
      clearTimeout(timeout);
    }
  }
}

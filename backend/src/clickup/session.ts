import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";

export const sessionCookieName = "custom-clickup-session";

const sessionVersion = "v1";

export interface ClickUpSessionUser {
  email: string | undefined;
  id: number;
  username: string;
}

export interface ClickUpSessionState {
  accessToken: string | undefined;
  authorizedTeamIds: string[] | undefined;
  oauthState: string | undefined;
  returnTo: string | undefined;
  user: ClickUpSessionUser | undefined;
}

export interface SessionCookieOptions {
  secret: string;
  secure: boolean;
}

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

function encrypt(payload: ClickUpSessionState, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret), iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    sessionVersion,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url")
  ].join(".");
}

function decrypt(serialized: string, secret: string): ClickUpSessionState | null {
  const [version, ivPart, authTagPart, payloadPart] = serialized.split(".");

  if (version !== sessionVersion || !ivPart || !authTagPart || !payloadPart) {
    return null;
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      deriveKey(secret),
      Buffer.from(ivPart, "base64url")
    );
    decipher.setAuthTag(Buffer.from(authTagPart, "base64url"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payloadPart, "base64url")),
      decipher.final()
    ]);

    const payload = JSON.parse(decrypted.toString("utf8")) as Partial<ClickUpSessionState>;

    return {
      accessToken:
        typeof payload.accessToken === "string" ? payload.accessToken : undefined,
      authorizedTeamIds: Array.isArray(payload.authorizedTeamIds)
        ? payload.authorizedTeamIds.filter(
            (teamId): teamId is string =>
              typeof teamId === "string" && teamId.length > 0
          )
        : undefined,
      oauthState:
        typeof payload.oauthState === "string" ? payload.oauthState : undefined,
      returnTo: typeof payload.returnTo === "string" ? payload.returnTo : undefined,
      user:
        payload.user &&
        typeof payload.user === "object" &&
        typeof payload.user.id === "number" &&
        typeof payload.user.username === "string"
          ? {
              id: payload.user.id,
              username: payload.user.username,
              email:
                typeof payload.user.email === "string"
                  ? payload.user.email
                  : undefined
            }
          : undefined
    };
  } catch {
    return null;
  }
}

function hasSessionData(session: ClickUpSessionState): boolean {
  return Boolean(
    session.accessToken ||
      session.oauthState ||
      session.returnTo ||
      session.user ||
      session.authorizedTeamIds?.length
  );
}

export function createEmptySessionState(): ClickUpSessionState {
  return {
    accessToken: undefined,
    authorizedTeamIds: undefined,
    oauthState: undefined,
    returnTo: undefined,
    user: undefined
  };
}

export function createOAuthState(): string {
  return randomBytes(18).toString("base64url");
}

export function sanitizeReturnTo(returnTo: string | undefined): string {
  if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return "/planning";
  }

  return returnTo;
}

export function readSession(
  req: Request,
  options: SessionCookieOptions
): ClickUpSessionState | null {
  const rawCookie = req.cookies?.[sessionCookieName];
  if (typeof rawCookie !== "string" || rawCookie.length === 0) {
    return null;
  }

  return decrypt(rawCookie, options.secret);
}

export function writeSession(
  res: Response,
  session: ClickUpSessionState,
  options: SessionCookieOptions
): void {
  if (!hasSessionData(session)) {
    clearSession(res, options.secure);
    return;
  }

  res.cookie(sessionCookieName, encrypt(session, options.secret), {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: options.secure
  });
}

export function clearSession(res: Response, secure = false): void {
  res.clearCookie(sessionCookieName, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure
  });
}

import { Router, type Response } from "express";
import { config } from "../config.js";
import { ClickUpServiceError } from "../clickup/errors.js";
import { ClickUpOAuthClient } from "../clickup/oauth.js";
import {
  clearSession,
  createEmptySessionState,
  createOAuthState,
  readSession,
  sanitizeReturnTo,
  writeSession,
  type SessionCookieOptions
} from "../clickup/session.js";
import { logger } from "../logging.js";

export const authRouter = Router();

function getSessionOptions(): SessionCookieOptions {
  if (!config.SESSION_SECRET) {
    throw new ClickUpServiceError(
      "SESSION_SECRET must be configured to use ClickUp OAuth.",
      500
    );
  }

  return {
    secret: config.SESSION_SECRET,
    secure: config.SESSION_COOKIE_SECURE
  };
}

function createOAuthClient(): ClickUpOAuthClient {
  if (
    !config.CLICKUP_CLIENT_ID ||
    !config.CLICKUP_CLIENT_SECRET ||
    !config.CLICKUP_REDIRECT_URI
  ) {
    throw new ClickUpServiceError(
      "ClickUp OAuth environment variables are incomplete.",
      500
    );
  }

  return new ClickUpOAuthClient({
    apiBaseUrl: config.CLICKUP_API_BASE_URL,
    authorizeUrl: config.CLICKUP_OAUTH_AUTHORIZE_URL,
    clientId: config.CLICKUP_CLIENT_ID,
    clientSecret: config.CLICKUP_CLIENT_SECRET,
    redirectUri: config.CLICKUP_REDIRECT_URI,
    timeoutMs: config.CLICKUP_HTTP_TIMEOUT_MS
  });
}

function handleAuthError(error: unknown, res: Response) {
  if (error instanceof ClickUpServiceError) {
    res.status(error.statusCode).json({
      message: error.message
    });
    return;
  }

  logger.error(
    {
      err: error,
      route: "auth"
    },
    "Unexpected auth route error."
  );
  res.status(500).json({
    message: "Unexpected auth error."
  });
}

authRouter.get("/clickup/start", (req, res) => {
  try {
    const sessionOptions = getSessionOptions();
    const oauthClient = createOAuthClient();
    const state = createOAuthState();
    const returnTo = sanitizeReturnTo(
      typeof req.query.returnTo === "string" ? req.query.returnTo : undefined
    );
    const session =
      readSession(req, sessionOptions) ?? createEmptySessionState();

    writeSession(
      res,
      {
        ...session,
        oauthState: state,
        returnTo
      },
      sessionOptions
    );

    res.redirect(oauthClient.getAuthorizationUrl(state));
  } catch (error) {
    handleAuthError(error, res);
  }
});

authRouter.get("/clickup/callback", async (req, res) => {
  try {
    const sessionOptions = getSessionOptions();
    const oauthClient = createOAuthClient();
    const session = readSession(req, sessionOptions);
    const returnTo = sanitizeReturnTo(session?.returnTo);
    const state = typeof req.query.state === "string" ? req.query.state : undefined;
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    const authError =
      typeof req.query.error === "string" ? req.query.error : undefined;

    if (!session?.oauthState || !state || session.oauthState !== state) {
      clearSession(res, sessionOptions.secure);
      res.status(400).json({
        message: "ClickUp OAuth state validation failed."
      });
      return;
    }

    if (authError) {
      clearSession(res, sessionOptions.secure);
      res.status(400).json({
        message: `ClickUp OAuth was not completed: ${authError}.`
      });
      return;
    }

    if (!code) {
      clearSession(res, sessionOptions.secure);
      res.status(400).json({
        message: "ClickUp OAuth callback did not include an authorization code."
      });
      return;
    }

    const accessToken = await oauthClient.exchangeCodeForAccessToken(code);
    const authorizedTeams = await oauthClient.getAuthorizedTeams(accessToken);
    const authorizedTeamIds = authorizedTeams.map((team) => team.id);

    if (!authorizedTeamIds.includes(config.CLICKUP_TARGET_TEAM_ID)) {
      clearSession(res, sessionOptions.secure);
      res.status(403).json({
        message: `The authenticated ClickUp account is not authorized for workspace ${config.CLICKUP_TARGET_TEAM_ID}.`
      });
      return;
    }

    writeSession(
      res,
      {
        accessToken,
        oauthState: undefined,
        returnTo: undefined
      },
      sessionOptions
    );

    res.redirect(returnTo);
  } catch (error) {
    clearSession(res, config.SESSION_COOKIE_SECURE);
    handleAuthError(error, res);
  }
});

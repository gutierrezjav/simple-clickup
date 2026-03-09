import { Router } from "express";

export const authRouter = Router();

authRouter.get("/clickup/start", (_req, res) => {
  res.status(501).json({
    message: "ClickUp OAuth start flow is planned but not implemented yet."
  });
});

authRouter.get("/clickup/callback", (_req, res) => {
  res.status(501).json({
    message: "ClickUp OAuth callback flow is planned but not implemented yet."
  });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("custom-clickup-session");
  res.status(204).send();
});

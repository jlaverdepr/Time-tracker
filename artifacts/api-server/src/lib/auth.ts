import type { Request, Response, NextFunction } from "express";

// Opt-in: only enforced when API_AUTH_TOKEN is set (e.g. by the desktop app
// once it's bound to the LAN, not just 127.0.0.1). Local `pnpm run dev:api`
// without the env var stays open, matching prior behavior.
export function requireAuthToken(req: Request, res: Response, next: NextFunction): void {
  const token = process.env.API_AUTH_TOKEN;
  if (!token) { next(); return; }

  const header = req.header("authorization");
  const provided = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (provided !== token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}

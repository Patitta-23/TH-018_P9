import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Extend Express Request to carry decoded user info
export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: "CUSTOMER" | "OPERATOR";
  };
}

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";

// ─────────────────────────────────────────────────────
// requireAuth
// Verifies the JWT cookie. Returns 401 if missing or invalid.
// Attaches decoded user to req.user for downstream handlers.
// ─────────────────────────────────────────────────────
export function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const token = req.cookies?.token as string | undefined;

  if (!token) {
    res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthRequest["user"];
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
  }
}

// ─────────────────────────────────────────────────────
// requireRole
// Returns 403 if the authenticated user's role does not match.
// Must be used after requireAuth.
// ─────────────────────────────────────────────────────
export function requireRole(role: "CUSTOMER" | "OPERATOR") {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (req.user?.role !== role) {
      res.status(403).json({ error: "Forbidden", code: "FORBIDDEN" });
      return;
    }
    next();
  };
}


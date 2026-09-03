import type { NextFunction, Request, Response } from "express";
import { getFirebaseAuth } from "../lib/firebase";

declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email?: string;
        name?: string;
      };
    }
  }
}

export async function requireFirebaseUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "A Firebase ID token is required." });
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    res.status(401).json({ error: "A Firebase ID token is required." });
    return;
  }

  try {
    const decoded = await getFirebaseAuth().verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
    };
    next();
  } catch (error) {
    req.log.warn({ err: error }, "Firebase token verification failed");
    res.status(401).json({ error: "The Firebase ID token is invalid or expired." });
  }
}

export function userId(req: Request): string {
  if (!req.user?.uid) {
    throw new Error("Authenticated user missing from request");
  }
  return req.user.uid;
}
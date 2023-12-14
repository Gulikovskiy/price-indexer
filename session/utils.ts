import "server-only";
import { cookies } from "next/headers";
import { kv } from "@vercel/kv";

type SessionId = string;

export async function getSessionId() {
  const cookieStore = cookies();
  return await cookieStore.get("session-id")?.value;
}

async function setSessionId(sessionId: SessionId) {
  const cookieStore = cookies();
  // @ts-ignore
  cookieStore.set("session-id", sessionId);
}

export async function getSessionIdAndCreateIfMissing() {
  const sessionId = getSessionId();
  if (!sessionId) {
    const newSessionId = crypto.randomUUID();
    setSessionId(newSessionId);

    return newSessionId;
  }

  return sessionId;
}

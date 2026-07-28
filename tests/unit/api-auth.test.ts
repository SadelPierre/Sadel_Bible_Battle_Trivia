import { describe, expect, it } from "vitest";
import { credentialsFromRequest } from "@/features/online/http";
import { clientKey } from "@/lib/rateLimit";

const request = (headers: Record<string, string>) =>
  new Request("https://example.test/api/rooms/ABCDE/state", { headers });

describe("room credentials", () => {
  it("reads a bearer credential pair", () => {
    const creds = credentialsFromRequest(
      request({ authorization: "Bearer 11111111-1111-1111-1111-111111111111.token-value" }),
    );
    expect(creds).toEqual({
      playerId: "11111111-1111-1111-1111-111111111111",
      token: "token-value",
    });
  });

  it("ignores credentials passed in the query string", () => {
    const req = new Request("https://example.test/api/rooms/ABCDE/state?playerId=p&token=t");
    expect(credentialsFromRequest(req)).toEqual({ playerId: null, token: null });
  });

  it("rejects a malformed or partial header", () => {
    for (const authorization of ["", "Bearer ", "Bearer justoneid", "Basic a.b"]) {
      expect(credentialsFromRequest(request({ authorization }))).toEqual({
        playerId: null,
        token: null,
      });
    }
  });
});

describe("rate limit identity", () => {
  it("prefers the platform-set header over the forwarded chain", () => {
    const key = clientKey(
      request({ "x-vercel-forwarded-for": "203.0.113.7", "x-forwarded-for": "1.2.3.4" }),
      "create-room",
    );
    expect(key).toBe("create-room:203.0.113.7");
  });

  it("takes the last forwarded entry so a client cannot choose its own bucket", () => {
    // A caller can prepend anything it likes to x-forwarded-for; only the entry
    // added by the closest proxy is trustworthy.
    const key = clientKey(request({ "x-forwarded-for": "9.9.9.9, 203.0.113.7" }), "create-room");
    expect(key).toBe("create-room:203.0.113.7");
  });

  it("falls back to a fixed bucket when no identity is available", () => {
    expect(clientKey(request({}), "state")).toBe("state:unknown");
  });
});

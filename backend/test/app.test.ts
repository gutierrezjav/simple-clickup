import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

describe("createApp", () => {
  let baseUrl = "";
  let cleanupPath = "";
  let closeServer: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    cleanupPath = mkdtempSync(join(tmpdir(), "custom-clickup-frontend-"));

    const frontendDistPath = join(cleanupPath, "frontend-dist");
    mkdirSync(join(frontendDistPath, "assets"), { recursive: true });
    writeFileSync(
      join(frontendDistPath, "index.html"),
      "<!doctype html><html><body><div id=\"root\">frontend shell</div></body></html>"
    );
    writeFileSync(
      join(frontendDistPath, "assets", "app.js"),
      "console.log('frontend asset');"
    );

    const server = createApp({ frontendDistPath }).listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.once("listening", () => resolve());
    });

    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
    closeServer = () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
  });

  afterAll(async () => {
    if (closeServer) {
      await closeServer();
    }

    if (cleanupPath) {
      rmSync(cleanupPath, { force: true, recursive: true });
    }
  });

  it("serves built frontend routes for SPA navigation", async () => {
    const response = await fetch(`${baseUrl}/planning`, {
      headers: {
        Accept: "text/html"
      }
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("frontend shell");
  });

  it("serves built frontend asset files", async () => {
    const response = await fetch(`${baseUrl}/assets/app.js`);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("frontend asset");
  });

  it("keeps API routes on the backend handler path", async () => {
    const response = await fetch(`${baseUrl}/api/clickup/planning`, {
      headers: {
        Accept: "application/json"
      }
    });

    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(500);

    const payload = (await response.json()) as {
      items?: unknown[];
      message?: string;
    };
    expect("items" in payload || "message" in payload).toBe(true);
  });
});

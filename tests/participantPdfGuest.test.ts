import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

test("a signed-out visitor can request a PDF link and see both attachment actions", async () => {
  const server = await createServer({
    cacheDir: ".impeccable/review/vite-unit-cache",
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true, entries: [] },
    appType: "custom",
  });
  const originalFetch = globalThis.fetch;
  try {
    let signedRequests = 0;
    globalThis.fetch = async (input, init) => {
      assert.match(
        String(input),
        /\/storage\/v1\/object\/sign\/meeting-participants\/staff\/list.pdf$/,
      );
      assert.equal(
        new Headers(init?.headers).get("authorization"),
        "Bearer anonymous-fixture-key",
      );
      assert.equal(JSON.parse(String(init?.body)).expiresIn, 600);
      signedRequests++;
      return new Response(
        JSON.stringify({
          signedURL:
            "/object/sign/meeting-participants/staff/list.pdf?token=fixture",
        }),
        { headers: { "content-type": "application/json" } },
      );
    };
    const { getParticipantPdfUrl } = await server.ssrLoadModule(
      "/src/utils/participantPdf.ts",
    );
    const url = await getParticipantPdfUrl("staff/list.pdf", {
      url: "https://pdf-guest-fixture.supabase.co",
      anonKey: "anonymous-fixture-key",
      tableName: "events",
    });
    assert.match(url, /\/storage\/v1\/object\/sign\/.+token=fixture/);
    assert.equal(signedRequests, 1);

    const { default: Actions } = await server.ssrLoadModule(
      "/src/components/ParticipantPdfActions.tsx",
    );
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const html = renderToStaticMarkup(
      createElement(Actions, {
        path: "staff/list.pdf",
        onOpen: async () => {},
      }),
    );
    assert.match(html, /ดูรายชื่อผู้เข้าร่วม \(PDF\)/);
    assert.match(html, /ดาวน์โหลด/);
    assert.doesNotMatch(html, /เข้าสู่ระบบ/);
  } finally {
    globalThis.fetch = originalFetch;
    await server.close();
  }
});

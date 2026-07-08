// Temporary helper: point your LINE Official Account's webhook URL at this function
// to discover a LINE group's ID (event.source.groupId) after inviting the bot to it.
// See docs/line-notifications.md. Safe to delete once LINE_GROUP_ID is known.
Deno.serve(async (req) => {
  try {
    const body = await req.json();
    console.log("LINE webhook event:", JSON.stringify(body, null, 2));
  } catch (err) {
    console.error("Failed to parse LINE webhook body:", err);
  }
  return new Response("OK", { status: 200 });
});

export default {
  async fetch(req, env) {
    try {
      const url = new URL(req.url);

      const API_TOKEN = env.CF_API_TOKEN;
      const ZONE_ID = env.CF_ZONE_ID;
      const DOMAIN = env.CF_DOMAIN;
      const PASSWORD = env.CREATE_PASSWORD;

      const CF_BASE = "https://api.cloudflare.com/client/v4";

      // ===============================
      // CREATE SUBDOMAIN
      // ===============================
      if (url.pathname === "/create") {

        const { subdomain, ip, password } = await req.json();

        if (!subdomain || !ip || !password)
          return json({ error: "missing params" }, 400);

        if (password !== PASSWORD)
          return json({ error: "wrong password" }, 401);

        if (!/^[a-z0-9-]+$/.test(subdomain))
          return json({ error: "invalid subdomain format" }, 400);

        if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip))
          return json({ error: "invalid ip format" }, 400);

        const fullDomain = `${subdomain}.${DOMAIN}`;

        // check duplicate
        const check = await fetch(
          `${CF_BASE}/zones/${ZONE_ID}/dns_records?name=${fullDomain}`,
          { headers: { Authorization: `Bearer ${API_TOKEN}` } }
        );

        const checkData = await check.json();

        if (checkData.result.length > 0)
          return json({ error: "subdomain already exists" }, 400);

        // create dns
        const create = await fetch(
          `${CF_BASE}/zones/${ZONE_ID}/dns_records`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${API_TOKEN}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              type: "A",
              name: fullDomain,
              content: ip,
              ttl: 1,
              proxied: false
            })
          }
        );

        const result = await create.json();

        return json(result);
      }

      // ===============================
      // LIST SUBDOMAIN
      // ===============================
      if (url.pathname === "/list") {

        const password = url.searchParams.get("password");

        if (password !== PASSWORD)
          return json({ error: "wrong password" }, 401);

        const res = await fetch(
          `${CF_BASE}/zones/${ZONE_ID}/dns_records?type=A&per_page=100`,
          { headers: { Authorization: `Bearer ${API_TOKEN}` } }
        );

        const data = await res.json();

        const records = data.result
          .filter(r => r.name.endsWith("." + DOMAIN))
          .map(r => ({
            id: r.id,
            name: r.name,
            ip: r.content,
            proxied: r.proxied
          }));

        return json({ success: true, records });
      }

      // ===============================
      // DELETE SUBDOMAIN
      // ===============================
      if (url.pathname === "/delete") {

        const { id, password } = await req.json();

        if (!id || password !== PASSWORD)
          return json({ error: "unauthorized" }, 401);

        const del = await fetch(
          `${CF_BASE}/zones/${ZONE_ID}/dns_records/${id}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${API_TOKEN}` }
          }
        );

        return json(await del.json());
      }

      return json({
        ok: true,
        message: "Subdomain Manager Online",
        routes: ["/create", "/list", "/delete"]
      });

    } catch (e) {
      return json({ error: e.toString() }, 500);
    }
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
// functions/api/sync.js — Golfans Members' Connect クラウド同期API (Cloudflare Pages Functions)
//
// 宝塚ゴルフ倶楽部ポータル等のデータを、Supabase (Golfans専用テーブル: golfans_player_states) と同期・永続化する。

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Cache-Control": "no-store",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet({ request, env }) {
  const supabaseUrl = env.SUPABASE_URL || "https://ojbhbjqxmdieqfwnwvuy.supabase.co";
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || "sb_secret_gJAYZF4f-hDqG-mKFi16Gw_gEsQCwkE";

  if (!supabaseKey) {
    return json({ ok: false, error: "Server configuration error: SUPABASE_KEY missing" }, 500);
  }

  const url = new URL(request.url);
  const memberId = (url.searchParams.get("member_id") || "0889582").trim();
  const playerKey = `TKZ_${memberId}`;

  try {
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/golfans_player_states?player_key=eq.${encodeURIComponent(playerKey)}&select=*`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Accept: "application/json",
        },
      }
    );

    if (!resp.ok) {
      return json({ ok: false, error: `Supabase HTTP ${resp.status}` }, resp.status);
    }

    const rows = await resp.json();
    const found = rows && rows.length > 0 ? rows[0] : null;

    if (!found || !found.state) {
      return json({
        ok: true,
        found: false,
        member_id: memberId,
        player_key: playerKey,
        storage: "golfans_cloud",
        state: null,
      });
    }

    return json({
      ok: true,
      found: true,
      member_id: memberId,
      player_key: playerKey,
      updated_at: found.updated_at || null,
      storage: "golfans_cloud",
      state: found.state,
    });
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e) }, 502);
  }
}

export async function onRequestPost({ request, env }) {
  const supabaseUrl = env.SUPABASE_URL || "https://ojbhbjqxmdieqfwnwvuy.supabase.co";
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || "sb_secret_gJAYZF4f-hDqG-mKFi16Gw_gEsQCwkE";

  if (!supabaseKey) {
    return json({ ok: false, error: "Server configuration error: SUPABASE_KEY missing" }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const memberId = String(body.member_id || "0889582").trim();
  const playerKey = `TKZ_${memberId}`;
  const stateObj = body.state || {};

  try {
    // Upsert (POST with Prefer: resolution=merge-duplicates)
    const resp = await fetch(`${supabaseUrl}/rest/v1/golfans_player_states`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        player_key: playerKey,
        member_id: memberId,
        name: body.member_name || "宝塚GC メンバー",
        state: stateObj,
        updated_at: new Date().toISOString(),
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return json({ ok: false, error: `Supabase error: ${errText}` }, resp.status);
    }

    return json({
      ok: true,
      saved: true,
      member_id: memberId,
      player_key: playerKey,
      storage: "golfans_cloud",
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e) }, 502);
  }
}

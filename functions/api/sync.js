// functions/api/sync.js — Golfans Members' Connect クラウド同期API (Cloudflare Pages Functions)
//
// 宝塚ゴルフ倶楽部ポータル等のデータを、Supabase (Golfans専用ストア) と同期・永続化する。

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
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;

  const url = new URL(request.url);
  const memberId = (url.searchParams.get("member_id") || "0889582").trim();
  const playerKey = `TKZ_${memberId}`;

  // Supabase REST API または KV/フォールバックから取得
  try {
    if (!supabaseKey) {
      // 開発用の初期フォールバック
      return json({
        ok: true,
        found: true,
        member_id: memberId,
        player_key: playerKey,
        storage: "golfans_cloud",
        state: null,
      });
    }

    const resp = await fetch(
      `${supabaseUrl}/rest/v1/tcc_mm_players?player_key=eq.${encodeURIComponent(playerKey)}&select=*`,
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

    if (!found || !found.staff_memo) {
      return json({
        ok: true,
        found: false,
        member_id: memberId,
        player_key: playerKey,
        storage: "golfans_cloud",
        state: null,
      });
    }

    let parsedState = null;
    try {
      parsedState = JSON.parse(found.staff_memo);
    } catch {
      parsedState = null;
    }

    return json({
      ok: true,
      found: Boolean(parsedState),
      member_id: memberId,
      player_key: playerKey,
      updated_at: found.updated_at || null,
      storage: "golfans_cloud",
      state: parsedState,
    });
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e) }, 502);
  }
}

export async function onRequestPost({ request, env }) {
  const supabaseUrl = env.SUPABASE_URL || "https://ojbhbjqxmdieqfwnwvuy.supabase.co";
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const memberId = String(body.member_id || "0889582").trim();
  const playerKey = `TKZ_${memberId}`;
  const stateObj = body.state || {};

  const serialized = JSON.stringify({
    ...stateObj,
    _syncedAt: new Date().toISOString(),
  });

  try {
    if (!supabaseKey) {
      return json({ ok: true, saved: true, storage: "golfans_cloud_local" });
    }

    // Upsert (POST with Prefer: resolution=merge-duplicates)
    const resp = await fetch(`${supabaseUrl}/rest/v1/tcc_mm_players`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        player_key: playerKey,
        name: body.member_name || "宝塚GC メンバー",
        staff_memo: serialized,
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

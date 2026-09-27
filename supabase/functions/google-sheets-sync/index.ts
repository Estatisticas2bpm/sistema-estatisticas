import { createClient } from "npm:@supabase/supabase-js@2";

const EXPECTED_SECRET_HASH = "ee196d6eef7f9318c9350566b108e37ecff0d471f95766bb4192344c5244bc85";
const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, x-sync-secret",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json; charset=utf-8" },
  });
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ error: "Metodo nao permitido" }, 405);

  const suppliedSecret = request.headers.get("x-sync-secret") ?? "";
  if (!suppliedSecret || await sha256(suppliedSecret) !== EXPECTED_SECRET_HASH) {
    return response({ error: "Nao autorizado" }, 401);
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  try {
    const body = await request.json();

    if (body.action === "pull") {
      const { data: integrations, error: integrationsError } = await db
        .from("unidades_integracoes")
        .select("unidade_id,google_sheet_id,aba_principal")
        .eq("tipo", "GOOGLE_SHEETS_OCORRENCIAS")
        .eq("ativo", true);
      if (integrationsError) throw integrationsError;

      const activeIntegrations = integrations ?? [];
      const routingMode = String(body.routing_mode ?? "").trim().toLowerCase();
      const suppliedSheetId = String(body.google_sheet_id ?? "").trim();
      let targetSheetId: string | null = null;

      if (routingMode === "multi") {
        targetSheetId = null;
      } else if (suppliedSheetId) {
        const integration = activeIntegrations.find((item) => item.google_sheet_id === suppliedSheetId);
        if (!integration) {
          return response({ error: "Planilha nao autorizada ou integracao inativa" }, 403);
        }
        targetSheetId = suppliedSheetId;
      } else if (activeIntegrations.length === 1) {
        targetSheetId = activeIntegrations[0].google_sheet_id;
      } else if (activeIntegrations.length === 0) {
        return response({ error: "Nenhuma integracao Google Sheets ativa" }, 409);
      } else {
        return response({
          error: "Roteamento obrigatorio: informe google_sheet_id ou routing_mode=multi",
        }, 409);
      }

      const { data, error } = await db.rpc("claim_google_sheets_sync_batch_v2", {
        batch_size: Math.min(Number(body.limit) || 50, 200),
        p_google_sheet_id: targetSheetId,
      });
      if (error) throw error;
      return response({ events: data ?? [] });
    }

    if (body.action === "ack") {
      const ids = (body.event_ids ?? []).map(Number).filter(Number.isFinite);
      const { error } = await db.rpc("ack_google_sheets_sync", { event_ids: ids });
      if (error) throw error;
      return response({ ok: true });
    }

    if (body.action === "fail") {
      const ids = (body.event_ids ?? []).map(Number).filter(Number.isFinite);
      const { error } = await db.rpc("fail_google_sheets_sync", {
        event_ids: ids,
        error_message: String(body.error ?? "Erro informado pelo Google Sheets"),
      });
      if (error) throw error;
      return response({ ok: true });
    }

    return response({ error: "Acao desconhecida" }, 400);
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
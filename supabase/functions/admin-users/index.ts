import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

function resposta(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

const url = Deno.env.get("SUPABASE_URL") || "";
const secretKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY") || "";
const admin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const perfisValidos = new Set(["ADMIN", "ESTATISTICA", "OPERADOR", "GESTOR", "CONSULTA"]);
const limpar = (v: unknown) => String(v ?? "").trim();
const upper = (v: unknown) => limpar(v).toUpperCase();

async function usuarioDaRequisicao(req: Request) {
  const h = req.headers.get("Authorization") || "";
  const token = h.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

async function unidadePorId(unidadeId?: string | null) {
  if (!unidadeId) return null;
  const { data, error } = await admin.from("unidades")
    .select("id,sigla,nome")
    .eq("id", unidadeId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function perfilDoUsuario(userId: string) {
  const { data, error } = await admin.from("perfis_usuarios")
    .select("user_id,nome,nome_guerra,matricula,email,perfil,ativo,senha_temporaria,unidade_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, unidades: await unidadePorId(data.unidade_id) };
}

async function perfisComUnidades() {
  const [{ data: users, error: usersError }, { data: units, error: unitsError }] = await Promise.all([
    admin.from("perfis_usuarios")
      .select("user_id,nome,nome_guerra,matricula,email,perfil,unidade_id,ativo,senha_temporaria,criado_em")
      .order("nome"),
    admin.from("unidades").select("id,sigla,nome,ativo").eq("ativo", true).order("sigla"),
  ]);
  if (usersError) throw usersError;
  if (unitsError) throw unitsError;
  const mapa = new Map((units || []).map((u: any) => [u.id, u]));
  return {
    users: (users || []).map((u: any) => ({ ...u, unidades: u.unidade_id ? mapa.get(u.unidade_id) || null : null })),
    units: units || [],
  };
}

async function log(usuarioId: string | null, acao: string, entidade?: string, entidadeId?: string, detalhes: Record<string, unknown> = {}) {
  const { error } = await admin.from("logs_sistema").insert({
    usuario_id: usuarioId,
    acao,
    entidade: entidade || null,
    entidade_id: entidadeId || null,
    detalhes,
  });
  if (error) console.error("Falha ao registrar log:", error.message);
}

async function garantirUltimoAdmin(targetId: string, novoPerfil?: string, desativando = false) {
  const alvo = await perfilDoUsuario(targetId);
  if (!alvo || alvo.perfil !== "ADMIN" || alvo.ativo !== true) return;
  if (!desativando && novoPerfil === "ADMIN") return;
  const { count, error } = await admin.from("perfis_usuarios")
    .select("user_id", { count: "exact", head: true })
    .eq("perfil", "ADMIN")
    .eq("ativo", true);
  if (error) throw error;
  if ((count || 0) <= 1) throw new Error("O sistema precisa manter pelo menos um administrador ativo.");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta({ error: "Método não permitido." }, 405);
  if (!url || !secretKey) return resposta({ error: "Configuração administrativa do Supabase indisponível." }, 500);

  try {
    const caller = await usuarioDaRequisicao(req);
    if (!caller) return resposta({ error: "Sessão inválida ou expirada." }, 401);

    const body = await req.json().catch(() => ({}));
    const action = limpar(body.action);

    if (action === "me") {
      const perfil = await perfilDoUsuario(caller.id);
      return resposta({ profile: perfil || null });
    }

    if (action === "bootstrap") {
      const { count, error: countError } = await admin.from("perfis_usuarios")
        .select("user_id", { count: "exact", head: true });
      if (countError) throw countError;

      const existente = await perfilDoUsuario(caller.id);
      if (existente) return resposta({ profile: existente, bootstrap: false });
      if ((count || 0) > 0) return resposta({ error: "Usuário sem perfil autorizado." }, 403);

      const { data: unidade, error: unidadeError } = await admin.from("unidades")
        .select("id")
        .eq("sigla", "2BPM")
        .eq("ativo", true)
        .maybeSingle();
      if (unidadeError) throw unidadeError;

      const nome = limpar(caller.user_metadata?.nome || caller.user_metadata?.full_name || caller.email || "ADMINISTRADOR");
      const { error: inserirError } = await admin.from("perfis_usuarios").insert({
        user_id: caller.id,
        nome,
        nome_guerra: limpar(caller.user_metadata?.nome_guerra || "ADMIN"),
        email: caller.email || "",
        perfil: "ADMIN",
        unidade_id: unidade?.id || null,
        ativo: true,
        senha_temporaria: false,
        criado_por: caller.id,
      });
      if (inserirError) throw inserirError;
      await log(caller.id, "BOOTSTRAP_ADMIN", "usuario", caller.id, { email: caller.email });
      return resposta({ profile: await perfilDoUsuario(caller.id), bootstrap: true });
    }

    if (action === "password_changed") {
      const perfil = await perfilDoUsuario(caller.id);
      if (!perfil || perfil.ativo !== true) return resposta({ error: "Usuário não autorizado." }, 403);
      const { error } = await admin.from("perfis_usuarios")
        .update({ senha_temporaria: false, atualizado_em: new Date().toISOString() })
        .eq("user_id", caller.id);
      if (error) throw error;
      await log(caller.id, "ALTEROU_SENHA", "usuario", caller.id);
      return resposta({ ok: true });
    }

    const perfilCaller = await perfilDoUsuario(caller.id);
    if (!perfilCaller || perfilCaller.ativo !== true || perfilCaller.perfil !== "ADMIN") {
      return resposta({ error: "Somente administradores podem gerenciar usuários." }, 403);
    }

    if (action === "list") {
      return resposta(await perfisComUnidades());
    }

    if (action === "create") {
      const email = limpar(body.email).toLowerCase();
      const password = limpar(body.password);
      const nome = limpar(body.nome);
      const nomeGuerra = upper(body.nome_guerra);
      const matricula = limpar(body.matricula) || null;
      const perfil = upper(body.perfil);
      const unidadeId = limpar(body.unidade_id);

      if (!email || !email.includes("@")) throw new Error("Informe um e-mail válido.");
      if (password.length < 8) throw new Error("A senha temporária deve ter pelo menos 8 caracteres.");
      if (!nome || !nomeGuerra) throw new Error("Nome completo e nome de guerra são obrigatórios.");
      if (!perfisValidos.has(perfil)) throw new Error("Perfil de acesso inválido.");
      if (!unidadeId) throw new Error("Informe a unidade do usuário.");

      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nome, nome_guerra: nomeGuerra },
      });
      if (authError || !authData.user) throw authError || new Error("Não foi possível criar o usuário de autenticação.");

      const userId = authData.user.id;
      const { error: perfilError } = await admin.from("perfis_usuarios").insert({
        user_id: userId,
        nome,
        nome_guerra: nomeGuerra,
        matricula,
        email,
        perfil,
        unidade_id: unidadeId,
        ativo: true,
        senha_temporaria: true,
        criado_por: caller.id,
      });
      if (perfilError) {
        await admin.auth.admin.deleteUser(userId).catch(() => {});
        throw perfilError;
      }
      await log(caller.id, "CRIOU_USUARIO", "usuario", userId, { nome, nome_guerra: nomeGuerra, email, perfil, unidade_id: unidadeId });
      return resposta({ ok: true, user_id: userId });
    }

    const targetId = limpar(body.user_id);
    if (!targetId) throw new Error("Usuário alvo não informado.");

    if (action === "update") {
      const nome = limpar(body.nome);
      const nomeGuerra = upper(body.nome_guerra);
      const perfil = upper(body.perfil);
      const unidadeId = limpar(body.unidade_id);
      const matricula = limpar(body.matricula) || null;
      const email = limpar(body.email).toLowerCase();
      if (!nome || !nomeGuerra || !unidadeId || !perfisValidos.has(perfil)) throw new Error("Dados do usuário inválidos.");
      if (targetId === caller.id && perfil !== "ADMIN") throw new Error("Você não pode remover seu próprio perfil de administrador.");
      await garantirUltimoAdmin(targetId, perfil, false);

      const atual = await perfilDoUsuario(targetId);
      if (!atual) throw new Error("Usuário não encontrado.");
      if (email && email !== atual.email) {
        const { error } = await admin.auth.admin.updateUserById(targetId, { email, email_confirm: true });
        if (error) throw error;
      }
      const { error } = await admin.from("perfis_usuarios").update({
        nome, nome_guerra: nomeGuerra, matricula, email: email || atual.email,
        perfil, unidade_id: unidadeId, atualizado_em: new Date().toISOString(),
      }).eq("user_id", targetId);
      if (error) throw error;
      await log(caller.id, "EDITOU_USUARIO", "usuario", targetId, { nome, nome_guerra: nomeGuerra, perfil, unidade_id: unidadeId });
      return resposta({ ok: true });
    }

    if (action === "reset_password") {
      const password = limpar(body.password);
      if (password.length < 8) throw new Error("A nova senha temporária deve ter pelo menos 8 caracteres.");
      const { error: authError } = await admin.auth.admin.updateUserById(targetId, { password });
      if (authError) throw authError;
      const { error } = await admin.from("perfis_usuarios").update({ senha_temporaria: true, atualizado_em: new Date().toISOString() }).eq("user_id", targetId);
      if (error) throw error;
      await log(caller.id, "REDEFINIU_SENHA", "usuario", targetId);
      return resposta({ ok: true });
    }

    if (action === "deactivate") {
      if (targetId === caller.id) throw new Error("Você não pode bloquear seu próprio usuário.");
      await garantirUltimoAdmin(targetId, undefined, true);
      const { error } = await admin.from("perfis_usuarios").update({ ativo: false, atualizado_em: new Date().toISOString() }).eq("user_id", targetId);
      if (error) throw error;
      const { error: banError } = await admin.auth.admin.updateUserById(targetId, { ban_duration: "876000h" });
      if (banError) console.error("Perfil bloqueado, mas houve falha ao aplicar ban no Auth:", banError.message);
      await log(caller.id, "BLOQUEOU_USUARIO", "usuario", targetId);
      return resposta({ ok: true });
    }

    if (action === "reactivate") {
      const { error } = await admin.from("perfis_usuarios").update({ ativo: true, atualizado_em: new Date().toISOString() }).eq("user_id", targetId);
      if (error) throw error;
      const { error: unbanError } = await admin.auth.admin.updateUserById(targetId, { ban_duration: "0s" });
      if (unbanError) console.error("Perfil reativado, mas houve falha ao remover ban no Auth:", unbanError.message);
      await log(caller.id, "REATIVOU_USUARIO", "usuario", targetId);
      return resposta({ ok: true });
    }

    return resposta({ error: "Ação administrativa inválida." }, 400);
  } catch (e: any) {
    console.error("admin-users:", e?.message || e, e?.code || "", e?.details || "");
    return resposta({ error: e?.message || "Erro interno.", code: e?.code || null }, 500);
  }
});

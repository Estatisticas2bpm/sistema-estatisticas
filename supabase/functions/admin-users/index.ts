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
const postosGraduacoesValidos = new Set([
  "CEL PM", "TEN CEL PM", "MAJ PM", "CAP PM", "1º TEN PM", "2º TEN PM",
  "ASP OF PM", "AL OF PM", "SUB TEN PM", "1º SGT PM", "2º SGT PM",
  "3º SGT PM", "CB PM", "SD PM",
]);
const GIRO_ABORDAGENS_EMAIL = "giro.abordagens@siecpc.local";
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

const uuidValido = (v: unknown) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(limpar(v));

async function unidadePorId(unidadeId?: string | null) {
  if (!unidadeId) return null;
  const { data, error } = await admin.from("unidades")
    .select("id,sigla,nome,ativo")
    .eq("id", unidadeId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function validarUnidadeAtiva(unidadeId: unknown) {
  const id = limpar(unidadeId);
  if (!uuidValido(id)) throw new Error("Unidade inválida.");
  const unidade = await unidadePorId(id);
  if (!unidade) throw new Error("A unidade selecionada não existe.");
  if (unidade.ativo !== true) throw new Error("A unidade selecionada não está ativa.");
  return unidade;
}

async function unidadeGiro() {
  const { data, error } = await admin.from("unidades")
    .select("id,sigla,nome,ativo")
    .eq("sigla", "GIRO")
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

function podeGerenciarAcessoGiro(perfil: any) {
  if (!perfil || perfil.ativo !== true || perfil.unidades?.ativo !== true) return false;
  const sigla = upper(perfil.unidades?.sigla);
  return perfil.perfil === "ADMIN" || (sigla === "GIRO" && perfil.perfil === "ESTATISTICA");
}

async function acessoGiroAbordagens() {
  const { data, error } = await admin.from("giro_acessos_abordagem")
    .select("user_id,unidade_id,ativo,criado_em,atualizado_em")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const unidade = data ? await unidadePorId(data.unidade_id) : await unidadeGiro();
  return data ? { ...data, email: GIRO_ABORDAGENS_EMAIL, unidade } : { email: GIRO_ABORDAGENS_EMAIL, ativo: false, user_id: null, unidade };
}

async function perfilDoUsuario(userId: string) {
  const { data, error } = await admin.from("perfis_usuarios")
    .select("user_id,nome,nome_guerra,posto_graduacao,matricula,email,perfil,ativo,senha_temporaria,unidade_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, unidades: await unidadePorId(data.unidade_id) };
}

async function perfisComUnidades() {
  const [{ data: users, error: usersError }, { data: todasUnidades, error: unitsError }] = await Promise.all([
    admin.from("perfis_usuarios")
      .select("user_id,nome,nome_guerra,posto_graduacao,matricula,email,perfil,unidade_id,ativo,senha_temporaria,criado_em")
      .order("nome"),
    admin.from("unidades").select("id,sigla,nome,ativo").order("sigla"),
  ]);
  if (usersError) throw usersError;
  if (unitsError) throw unitsError;
  const mapa = new Map((todasUnidades || []).map((u: any) => [u.id, u]));
  return {
    users: (users || []).map((u: any) => ({ ...u, unidades: u.unidade_id ? mapa.get(u.unidade_id) || null : null })),
    units: (todasUnidades || []).filter((u: any) => u.ativo === true),
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
      if (!unidade?.id) throw new Error("O 2º BPM precisa estar ativo para concluir a configuração inicial.");

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
      if (!perfil || perfil.ativo !== true || perfil.unidades?.ativo !== true) {
        return resposta({ error: "Usuário ou unidade principal não autorizado." }, 403);
      }
      const { error } = await admin.from("perfis_usuarios")
        .update({ senha_temporaria: false, atualizado_em: new Date().toISOString() })
        .eq("user_id", caller.id);
      if (error) throw error;
      await log(caller.id, "ALTEROU_SENHA", "usuario", caller.id);
      return resposta({ ok: true });
    }

    if (action === "self_update") {
      const atual = await perfilDoUsuario(caller.id);
      if (!atual || atual.ativo !== true || atual.unidades?.ativo !== true) {
        return resposta({ error: "Usuário ou unidade principal não autorizado." }, 403);
      }

      const nome = limpar(body.nome);
      const nomeGuerra = upper(body.nome_guerra);
      const postoGraduacao = upper(body.posto_graduacao);
      const matricula = limpar(body.matricula) || null;

      if (!nome || !nomeGuerra) throw new Error("Nome completo e nome de guerra são obrigatórios.");
      if (!postosGraduacoesValidos.has(postoGraduacao)) throw new Error("Informe um posto ou graduação válido.");

      const { error } = await admin.from("perfis_usuarios").update({
        nome,
        nome_guerra: nomeGuerra,
        posto_graduacao: postoGraduacao,
        matricula,
        atualizado_em: new Date().toISOString(),
      }).eq("user_id", caller.id);
      if (error) throw error;

      await log(caller.id, "EDITOU_PROPRIO_PERFIL", "usuario", caller.id, {
        nome,
        nome_guerra: nomeGuerra,
        posto_graduacao: postoGraduacao,
        matricula,
      });
      return resposta({ ok: true, profile: await perfilDoUsuario(caller.id) });
    }

    const perfilCaller = await perfilDoUsuario(caller.id);
    const acoesAcessoGiro = new Set([
      "giro_access_status",
      "giro_access_create",
      "giro_access_reset_password",
      "giro_access_deactivate",
      "giro_access_reactivate",
    ]);

    if (acoesAcessoGiro.has(action)) {
      if (!podeGerenciarAcessoGiro(perfilCaller)) {
        return resposta({ error: "Somente ADMIN ou ESTATÍSTICA do GIRO podem gerenciar o acesso compartilhado de abordagens." }, 403);
      }

      if (action === "giro_access_status") {
        return resposta({ access: await acessoGiroAbordagens() });
      }

      if (action === "giro_access_create") {
        const password = limpar(body.password);
        if (password.length < 8) throw new Error("A senha compartilhada deve ter pelo menos 8 caracteres.");
        const unidade = await unidadeGiro();
        if (!unidade) throw new Error("A unidade GIRO não está cadastrada.");
        if (unidade.ativo !== true) throw new Error("Ative o GIRO antes de liberar o acesso compartilhado de abordagens.");
        const atual = await acessoGiroAbordagens();
        if (atual?.user_id) throw new Error("O acesso compartilhado do GIRO já existe.");

        const { data: authData, error: authError } = await admin.auth.admin.createUser({
          email: GIRO_ABORDAGENS_EMAIL,
          password,
          email_confirm: true,
          user_metadata: { nome: "GIRO ABORDAGENS" },
        });
        if (authError || !authData.user) throw authError || new Error("Não foi possível criar o acesso compartilhado.");

        const userId = authData.user.id;
        const { error: acessoError } = await admin.from("giro_acessos_abordagem").insert({
          user_id: userId,
          unidade_id: unidade.id,
          ativo: true,
        });
        if (acessoError) {
          await admin.auth.admin.deleteUser(userId).catch(() => {});
          throw acessoError;
        }
        await log(caller.id, "CRIOU_ACESSO_GIRO_ABORDAGENS", "giro_acesso_abordagem", userId, { unidade_id: unidade.id });
        return resposta({ ok: true, access: await acessoGiroAbordagens() });
      }

      if (action === "giro_access_reset_password") {
        const password = limpar(body.password);
        if (password.length < 8) throw new Error("A senha compartilhada deve ter pelo menos 8 caracteres.");
        const atual = await acessoGiroAbordagens();
        if (!atual?.user_id) throw new Error("O acesso compartilhado do GIRO ainda não foi criado.");
        const { error } = await admin.auth.admin.updateUserById(atual.user_id, { password });
        if (error) throw error;
        await log(caller.id, "REDEFINIU_SENHA_GIRO_ABORDAGENS", "giro_acesso_abordagem", atual.user_id);
        return resposta({ ok: true, access: await acessoGiroAbordagens() });
      }

      if (action === "giro_access_deactivate") {
        const atual = await acessoGiroAbordagens();
        if (!atual?.user_id) throw new Error("O acesso compartilhado do GIRO ainda não foi criado.");
        const { error } = await admin.from("giro_acessos_abordagem")
          .update({ ativo: false, atualizado_em: new Date().toISOString() })
          .eq("user_id", atual.user_id);
        if (error) throw error;
        const { error: banError } = await admin.auth.admin.updateUserById(atual.user_id, { ban_duration: "876000h" });
        if (banError) console.error("Acesso GIRO bloqueado no banco, mas houve falha no ban do Auth:", banError.message);
        await log(caller.id, "BLOQUEOU_ACESSO_GIRO_ABORDAGENS", "giro_acesso_abordagem", atual.user_id);
        return resposta({ ok: true, access: await acessoGiroAbordagens() });
      }

      if (action === "giro_access_reactivate") {
        const atual = await acessoGiroAbordagens();
        if (!atual?.user_id) throw new Error("O acesso compartilhado do GIRO ainda não foi criado.");
        const unidade = await unidadeGiro();
        if (!unidade || unidade.ativo !== true) throw new Error("O GIRO precisa estar ativo para reativar o acesso de abordagens.");
        const { error } = await admin.from("giro_acessos_abordagem")
          .update({ ativo: true, atualizado_em: new Date().toISOString() })
          .eq("user_id", atual.user_id);
        if (error) throw error;
        const { error: unbanError } = await admin.auth.admin.updateUserById(atual.user_id, { ban_duration: "0s" });
        if (unbanError) throw unbanError;
        await log(caller.id, "REATIVOU_ACESSO_GIRO_ABORDAGENS", "giro_acesso_abordagem", atual.user_id);
        return resposta({ ok: true, access: await acessoGiroAbordagens() });
      }
    }

    if (!perfilCaller || perfilCaller.ativo !== true || perfilCaller.perfil !== "ADMIN" || perfilCaller.unidades?.ativo !== true) {
      return resposta({ error: "Somente administradores ativos de uma unidade ativa podem gerenciar usuários." }, 403);
    }

    if (action === "list") {
      return resposta(await perfisComUnidades());
    }

    if (action === "create") {
      const email = limpar(body.email).toLowerCase();
      const password = limpar(body.password);
      const nome = limpar(body.nome);
      const nomeGuerra = upper(body.nome_guerra);
      const postoGraduacao = upper(body.posto_graduacao);
      const matricula = limpar(body.matricula) || null;
      const perfil = upper(body.perfil);
      const unidadeId = limpar(body.unidade_id);

      if (!email || !email.includes("@")) throw new Error("Informe um e-mail válido.");
      if (password.length < 8) throw new Error("A senha temporária deve ter pelo menos 8 caracteres.");
      if (!nome || !nomeGuerra) throw new Error("Nome completo e nome de guerra são obrigatórios.");
      if (!postosGraduacoesValidos.has(postoGraduacao)) throw new Error("Informe um posto ou graduação válido.");
      if (!perfisValidos.has(perfil)) throw new Error("Perfil de acesso inválido.");
      if (!unidadeId) throw new Error("Informe a unidade do usuário.");
      await validarUnidadeAtiva(unidadeId);

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
        posto_graduacao: postoGraduacao,
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
      await log(caller.id, "CRIOU_USUARIO", "usuario", userId, { nome, nome_guerra: nomeGuerra, posto_graduacao: postoGraduacao, email, perfil, unidade_id: unidadeId });
      return resposta({ ok: true, user_id: userId });
    }

    const targetId = limpar(body.user_id);
    if (!targetId) throw new Error("Usuário alvo não informado.");

    if (action === "update") {
      const nome = limpar(body.nome);
      const nomeGuerra = upper(body.nome_guerra);
      const postoGraduacao = upper(body.posto_graduacao);
      const perfil = upper(body.perfil);
      const unidadeId = limpar(body.unidade_id);
      const matricula = limpar(body.matricula) || null;
      const email = limpar(body.email).toLowerCase();
      if (!nome || !nomeGuerra || !unidadeId || !postosGraduacoesValidos.has(postoGraduacao) || !perfisValidos.has(perfil)) throw new Error("Dados do usuário inválidos.");
      if (targetId === caller.id && perfil !== "ADMIN") throw new Error("Você não pode remover seu próprio perfil de administrador.");
      await garantirUltimoAdmin(targetId, perfil, false);

      const atual = await perfilDoUsuario(targetId);
      if (!atual) throw new Error("Usuário não encontrado.");
      if (atual.ativo === true || unidadeId !== atual.unidade_id) {
        await validarUnidadeAtiva(unidadeId);
      }
      if (email && email !== atual.email) {
        const { error } = await admin.auth.admin.updateUserById(targetId, { email, email_confirm: true });
        if (error) throw error;
      }
      const { error } = await admin.from("perfis_usuarios").update({
        nome, nome_guerra: nomeGuerra, posto_graduacao: postoGraduacao, matricula, email: email || atual.email,
        perfil, unidade_id: unidadeId, atualizado_em: new Date().toISOString(),
      }).eq("user_id", targetId);
      if (error) throw error;
      await log(caller.id, "EDITOU_USUARIO", "usuario", targetId, { nome, nome_guerra: nomeGuerra, posto_graduacao: postoGraduacao, perfil, unidade_id: unidadeId });
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
      const alvo = await perfilDoUsuario(targetId);
      if (!alvo) throw new Error("Usuário não encontrado.");
      await validarUnidadeAtiva(alvo.unidade_id);
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

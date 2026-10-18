-- Auditoria corretiva rastreável dos 17 BOs históricos do 1º BPM.
-- Autorizada pelo responsável do sistema em 18/10/2026.
-- Problema: modelos de veículos (100,125,150,160,250,1000) e calibres (.38,9MM)
-- foram usados como QUANTIDADE por uma importação histórica da planilha anual.
-- Critérios: UUID/BO exatos, unidade 1BPM, origem GOOGLE_SHEETS, valor antigo,
-- um item estruturado e descrição/categoria de cada material, sem inferências gerais.
-- Segurança: tudo no mesmo DO transacional; se um registro divergir, nenhuma mudança
-- é persistida. A cópia original fica em private e é reversível.
DO $correcao_17_1bpm$
DECLARE
  r record;
  o public.ocorrencias%ROWTYPE;
  itens_antes jsonb;
  itens_depois jsonb;
  qtd_atual integer;
  qtd_itens integer;
  alterados integer := 0;
  linhas_afetadas integer;
BEGIN
  PERFORM pg_advisory_xact_lock(20261018, 1017);
  CREATE TABLE IF NOT EXISTS private.auditoria_correcao_quantidades_1bpm_20261018 (
    ocorrencia_id uuid NOT NULL,
    numero_bo text NOT NULL,
    unidade_id uuid NOT NULL,
    indicador text NOT NULL CHECK (indicador IN ('VEICULO','ARMA')),
    quantidade_antes integer NOT NULL,
    quantidade_depois integer NOT NULL,
    itens_antes jsonb NOT NULL,
    itens_depois jsonb NOT NULL,
    descricao_conferencia text NOT NULL,
    categoria_item text,
    sync_origin_anterior text,
    sync_version_anterior bigint,
    atualizado_em_anterior timestamptz,
    justificativa text NOT NULL,
    criado_em timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (ocorrencia_id,indicador)
  );
  -- Backups são internos: sem leitura pública/roles da API.
  REVOKE ALL ON private.auditoria_correcao_quantidades_1bpm_20261018
    FROM PUBLIC, anon, authenticated, service_role;
  ALTER TABLE private.auditoria_correcao_quantidades_1bpm_20261018 ENABLE ROW LEVEL SECURITY;

  FOR r IN
    SELECT x.id,x.bo,x.tipo,x.qtd,x.descricao,x.categoria
    FROM (VALUES
        ('0babb25c-0c4b-4996-bb45-60c8f5eb82ba'::uuid,'00099/2026','VEICULO',100,'HONDA/BIZ 100 ES',null),
        ('13c917e4-18da-4bc8-be78-b6b1b0858737'::uuid,'03823/2026','VEICULO',1000,'VW/GOL 1000L',null),
        ('1850a78e-c242-4555-a02e-8b8e9e94ffb4'::uuid,'07843/2026','VEICULO',125,'HONDA/CG 125 FAN KS',null),
        ('f9864bd9-bd1d-4185-90e4-93ac683074fb'::uuid,'09709/2026','VEICULO',150,'HONDA/CG 150 TITAN',null),
        ('d71f3bd3-ef9e-46c1-879e-452bf68e9d4e'::uuid,'11365/2026','VEICULO',160,'HONDA/CG 160 TITAN',null),
        ('05025afc-4a9f-483d-969e-17ffa95bbacb'::uuid,'12702/2026','VEICULO',160,'HONDA/CG 160 START',null),
        ('8989e4b6-746d-4c02-a6df-3afb124ce7df'::uuid,'17363/2026','VEICULO',125,'HONDA/CG 125 FAN KS',null),
        ('65a4c2b7-2d50-4b5e-af27-0063852cb50d'::uuid,'25741/2026','VEICULO',125,'HONDA/CG TITAN 125',null),
        ('01f675cf-51ad-4b46-bb08-b803945b0c92'::uuid,'27852/2026','VEICULO',160,'HONDA/CG TITAN 160',null),
        ('61fd4ff2-c346-4c4d-93af-dd253ae2eaf4'::uuid,'29408/2026','VEICULO',160,'HONDA/CG 160 FAN',null),
        ('6b00fb49-daea-480a-a7eb-14d80d2835bb'::uuid,'42239/2026','VEICULO',250,'YAMAHA/LANDER XTZ 250',null),
        ('e5744203-a937-4285-b879-195874eb2a1d'::uuid,'08598/2026','ARMA',38,'REVOLVER TAURUS CALIBRE .38','ARMA DE FOGO'),
        ('8873769e-f501-4140-af2e-d0d32892fe27'::uuid,'11258/2026','ARMA',9,'UMA ARMA DE FOGO: PISTOLA 9MM','ARMA DE FOGO'),
        ('b43e4c71-8df2-484c-b81f-1225fe817c2f'::uuid,'16821/2026','ARMA',38,'PISTOLA TAURUS G2C .38TPC','ARMA DE FOGO'),
        ('6d83b14e-c75e-4777-a4e5-6a41fd093d43'::uuid,'30870/2026','ARMA',9,'PISTOLA/TAURUS- PT92-9MM','ARMA DE FOGO'),
        ('22d8ce5f-d003-4018-ac6a-14b223d63bde'::uuid,'31287/2026','ARMA',9,'PISTOLA TAURUS 9MM','ARMA DE FOGO'),
        ('4247a611-9b5e-41c6-bb15-e54feae27a6b'::uuid,'49742/2026','ARMA',38,'UM SIMULACRO DE CAL.38','SIMULACRO')
    ) AS x(id,bo,tipo,qtd,descricao,categoria)
    ORDER BY x.bo
  LOOP
    SELECT * INTO STRICT o
    FROM public.ocorrencias
    WHERE id=r.id AND numero_bo=r.bo
      AND unidade_id='fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid
    FOR UPDATE;

    IF o.sync_origin IS DISTINCT FROM 'GOOGLE_SHEETS' THEN
      RAISE EXCEPTION 'BO %: origem inesperada',r.bo;
    END IF;

    IF r.tipo='VEICULO' THEN
      qtd_atual:=o.veiculos_recuperados;
      itens_antes:=o.itens_recuperados;
    ELSE
      qtd_atual:=o.quantidade_armas;
      itens_antes:=o.armas_itens;
    END IF;

    IF qtd_atual IS DISTINCT FROM r.qtd
      OR jsonb_typeof(itens_antes) IS DISTINCT FROM 'array'
      OR jsonb_array_length(itens_antes) IS DISTINCT FROM 1 THEN
      RAISE EXCEPTION 'BO %: campos de quantidade divergiram; correção cancelada',r.bo;
    END IF;
    qtd_itens:=(itens_antes->0->>'quantidade')::integer;
    IF qtd_itens IS DISTINCT FROM r.qtd
      OR strpos(coalesce(itens_antes->0->>'detalhes',''),r.descricao)=0
      OR (r.tipo='ARMA' AND (itens_antes->0->>'categoria') IS DISTINCT FROM r.categoria) THEN
      RAISE EXCEPTION 'BO %: item/descrição/categoria divergiram; correção cancelada',r.bo;
    END IF;

    IF EXISTS (SELECT 1 FROM private.auditoria_correcao_quantidades_1bpm_20261018
               WHERE ocorrencia_id=o.id AND indicador=r.tipo) THEN
      RAISE EXCEPTION 'BO %: correção já auditada, não repetir',r.bo;
    END IF;

    itens_depois:=jsonb_set(itens_antes,'{0,quantidade}','1'::jsonb,false);
    INSERT INTO private.auditoria_correcao_quantidades_1bpm_20261018
    (ocorrencia_id,numero_bo,unidade_id,indicador,quantidade_antes,quantidade_depois,
     itens_antes,itens_depois,descricao_conferencia,categoria_item,
     sync_origin_anterior,sync_version_anterior,atualizado_em_anterior,justificativa)
    VALUES (o.id,r.bo,o.unidade_id,r.tipo,qtd_atual,1,itens_antes,itens_depois,
            r.descricao,r.categoria,o.sync_origin,o.sync_version,o.atualizado_em,
            'Correção autorizada: número de modelo ou calibre confundido com quantidade na importação histórica 1BPM de 2026.');

    IF r.tipo='VEICULO' THEN
      UPDATE public.ocorrencias SET
        veiculos_recuperados=1,itens_recuperados=itens_depois
      WHERE id=o.id;
    ELSE
      UPDATE public.ocorrencias SET
        quantidade_armas=1,armas_itens=itens_depois
      WHERE id=o.id;
    END IF;

    GET DIAGNOSTICS linhas_afetadas=ROW_COUNT;
    IF linhas_afetadas<>1 THEN
      RAISE EXCEPTION 'BO %: não foi possível aplicar atualização de forma exata',r.bo;
    END IF;
    alterados:=alterados+1;
  END LOOP;

  IF alterados<>17 OR (SELECT COUNT(*) FROM private.auditoria_correcao_quantidades_1bpm_20261018)<>17 THEN
    RAISE EXCEPTION 'Contagem de segurança: esperado 17 registros; obtidos %',alterados;
  END IF;
END
$correcao_17_1bpm$;

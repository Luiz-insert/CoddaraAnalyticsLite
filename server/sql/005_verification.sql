-- Verificação de posse do domínio.
--
-- Não protege os dados: o isolamento já vem do token, e um token só recebe
-- evento se estiver no HTML daquele site. Protege a BASE LEGAL — se alguém
-- instalar o script num site que não controla, quem processa dado pessoal sem
-- amparo é a Coddara, não ele.

ALTER TABLE sites ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- Como foi verificado:
--   'snippet' — chegou um evento válido daquele domínio. Só acontece se alguém
--               com acesso de escrita ao site colocou a tag lá. Automático, sem
--               fricção, e no momento em que o usuário já está olhando a tela
--               de instalação esperando exatamente isso.
--   'dns'     — registro TXT no domínio. Prova mais forte, porque DNS costuma
--               estar com o dono de verdade, não com quem mexe no CMS.
ALTER TABLE sites ADD COLUMN IF NOT EXISTS verified_by text
    CHECK (verified_by IS NULL OR verified_by IN ('snippet', 'dns'));

-- O valor a publicar no TXT. Código próprio em vez de reaproveitar o token:
-- o token é público e já tem uma função. Segredo com dois papéis é o tipo de
-- economia que cobra caro depois.
ALTER TABLE sites ADD COLUMN IF NOT EXISTS dns_code text;

-- Site não verificado continua recebendo evento normalmente — bloquear aqui
-- quebraria o onboarding no exato momento em que ele precisa funcionar.
-- A verificação é pré-requisito do que AGE sobre o domínio: modo proxy,
-- convidar outras contas, e qualquer coisa que fale em nome do site.

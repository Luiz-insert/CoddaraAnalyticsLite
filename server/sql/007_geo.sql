-- Localização derivada do IP.
--
-- O IP é dado pessoal: guardá-lo exigiria base legal, política de retenção e
-- viraria passivo num vazamento. Derivamos a localização na entrada e o
-- descartamos — ele nunca chega a ter coluna nesta tabela.
--
-- Ele continua entrando no visitor_hash, que é de mão única: de lá não se
-- recupera o IP, só se compara se dois eventos vieram do mesmo lugar no
-- mesmo dia.

ALTER TABLE events ADD COLUMN IF NOT EXISTS country text;  -- ISO: BR, US, PT
ALTER TABLE events ADD COLUMN IF NOT EXISTS region  text;  -- sigla do estado: SP, MG
ALTER TABLE events ADD COLUMN IF NOT EXISTS city    text;  -- nome: 'São Paulo'

-- Nulas quando não dá para determinar: IP local, faixa não mapeada, ou o
-- servidor atrás de proxy sem trust proxy configurado. Linha com localização
-- desconhecida é melhor que evento descartado.
--
-- Sem índice: estas colunas sempre aparecem junto de um filtro de site e
-- período, que o events_site_time_idx já cobre.

-- Dispositivo, navegador e sistema operacional.
--
-- Os três saem do mesmo lugar — o header User-Agent — e por isso vêm juntos.
-- Nada disso viaja no payload: o beacon não muda para esta fatia.
--
-- Todas nulas de propósito: user agent pode faltar, vir vazio ou ser
-- irreconhecível. Preferimos linha com dado parcial a descartar a visita.

ALTER TABLE events ADD COLUMN IF NOT EXISTS device_type text;  -- desktop | mobile | tablet
ALTER TABLE events ADD COLUMN IF NOT EXISTS browser     text;  -- Chrome, Firefox, Safari...
ALTER TABLE events ADD COLUMN IF NOT EXISTS os          text;  -- Windows, Android, macOS...

-- Sem índice. Estas colunas sempre aparecem junto com um filtro de site e
-- período, que o events_site_time_idx já cobre. Índice próprio aqui só
-- encareceria a escrita.
--
-- Fora daqui de propósito: versão do navegador. É útil para depurar, mas não
-- responde nenhuma das métricas listadas — e a regra do projeto é que
-- facilidade de coleta não justifica coluna.

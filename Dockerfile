# Imagem do Coddara Analytics Lite: API, ingest e painel no mesmo processo.
#
# Multi-estágio porque as ferramentas de build não podem ir junto. O esbuild e o
# Vite existem para gerar dois arquivos; carregá-los para a máquina que atende
# visitante é 260MB de node_modules parados, e o esbuild ainda seria um caminho
# de execução que não queremos em produção.

# ─── Estágio 1: compila ──────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# As dependências primeiro, separadas do código: enquanto o package-lock não
# mudar, o Docker reaproveita esta camada e o deploy não reinstala nada.
COPY server/package*.json ./server/
RUN npm --prefix server ci

COPY dashboard/package*.json ./dashboard/
RUN npm --prefix dashboard ci

COPY server ./server
COPY tracker ./tracker
COPY dashboard ./dashboard

# O beacon vira arquivo aqui, com o esbuild ainda instalado.
RUN npm --prefix server run build:beacon

# O painel também. Sem VITE_API_URL de propósito: o padrão de produção é '/api',
# na mesma origem, e é isso que queremos gravado no pacote.
RUN npm --prefix dashboard run build

# Fora as dependências de build, que já fizeram o que tinham de fazer.
RUN npm --prefix server prune --omit=dev

# ─── Estágio 2: executa ──────────────────────────────────────────────────────
FROM node:22-alpine AS run

WORKDIR /app
ENV NODE_ENV=production

# Só o que roda: servidor, dependências de produção, beacon e painel compilados.
COPY --from=build /app/server ./server
COPY --from=build /app/dashboard/dist ./dashboard/dist

# Usuário sem privilégio: a imagem do Node já traz um, e rodar como root um
# processo que recebe requisição da internet inteira não tem justificativa.
USER node

EXPOSE 3002

# Migração antes do servidor. Se ela falhar, o processo morre aqui e o deploy
# não substitui a versão anterior — melhor que subir um servidor falando com um
# banco na forma errada.
CMD ["sh", "-c", "node server/migrate.js && node server/index.js"]

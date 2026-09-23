// Compila o beacon para um arquivo, em vez de montá-lo a cada pedido.
//
//   node build-beacon.js        gera server/publico/t.js
//
// Roda no deploy, antes de instalar só as dependências de produção. É o que
// tira o esbuild do caminho quente: em produção o servidor lê um arquivo
// pronto, e a rota deixa de depender de uma ferramenta de build estar
// instalada na máquina que atende os visitantes.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

export const ENTRADA = fileURLToPath(new URL('../tracker/beacon.js', import.meta.url));
export const SAIDA = fileURLToPath(new URL('./publico/t.js', import.meta.url));

export async function compilarBeacon() {
    const { outputFiles } = await build({
        entryPoints: [ENTRADA],
        bundle: true,
        minify: true,
        format: 'iife',
        target: 'es2020',
        write: false,
        // O beacon mora em tracker/, e o esbuild resolveria a partir de lá —
        // onde não há node_modules. As dependências dele são do servidor, que
        // é quem o entrega.
        nodePaths: [fileURLToPath(new URL('./node_modules', import.meta.url))],
    });
    return outputFiles[0].text;
}

// Só grava quando chamado direto pela linha de comando; importado, exporta.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const codigo = await compilarBeacon();
    await mkdir(fileURLToPath(new URL('./publico', import.meta.url)), { recursive: true });
    await writeFile(SAIDA, codigo);
    console.log(`t.js gerado: ${(codigo.length / 1024).toFixed(1)} kB`);
}

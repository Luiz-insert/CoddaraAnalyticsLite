import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';

// Duas regras inegociáveis neste arquivo:
//   1. Falhar em silêncio — se a nossa API cair, o site do cliente não pisca.
//   2. Ser minúsculo — ele vai em todo site que a Coddara entrega, e nós
//      vendemos Core Web Vitals. Não podemos ser o gargalo.

(() => {
    'use strict';

    try {
        // A própria tag <script> carrega o token e diz de onde viemos.
        // currentScript só vale durante a execução inicial; o querySelector
        // é a rede de segurança para quando não valer.
        const tag = document.currentScript || document.querySelector('script[data-token]');
        if (!tag) return;

        const token = tag.getAttribute('data-token');
        if (!token) return;

        // O endpoint sai do src do próprio script. Assim o cliente troca o host
        // em um lugar só (a tag) e nada aqui dentro precisa saber o domínio.
        const endpoint = new URL(tag.src).origin + '/e';

        // Descarrega antes de encher: lote grande arrisca o teto de payload do
        // sendBeacon, e o tempo evita segurar evento numa aba aberta por horas.
        const MAX_LOTE = 20;
        const INTERVALO = 5000;

        let fila = [];
        let timer = null;
        let contexto = null;

        // ts em ms desde o carregamento, não relógio do visitante: o servidor
        // reconstrói o horário real a partir da chegada do lote.
        const agora = () => Math.round(performance.now());

        const lerContexto = () => ({
            url: location.href,
            referrer: document.referrer || null,
            title: document.title,
        });

        function enviar(eventos, ctx) {
            const payload = {
                v: 1,
                token,
                ...ctx,
                screen: `${screen.width}x${screen.height}`,
                viewport: `${innerWidth}x${innerHeight}`,
                language: navigator.language,
                events: eventos,
            };

            // text/plain de propósito: application/json não está na lista segura
            // do CORS e dispararia um preflight OPTIONS — que o sendBeacon não
            // sabe fazer. Ele falharia calado, que é o pior jeito de falhar.
            const body = new Blob([JSON.stringify(payload)], { type: 'text/plain' });

            // sendBeacon devolve false quando a fila do navegador está cheia.
            if (!navigator.sendBeacon?.(endpoint, body)) {
                // keepalive faz a requisição sobreviver à saída da página.
                fetch(endpoint, { method: 'POST', body, keepalive: true }).catch(() => {});
            }
        }

        // Usa o contexto vigente: o que está na fila aconteceu na página que
        // ainda está no ar, não na próxima.
        function descarregar() {
            clearTimeout(timer);
            timer = null;
            if (fila.length === 0) return;

            const lote = fila;
            fila = [];
            enviar(lote, contexto);
        }

        function enfileirar(evento) {
            fila.push({ ...evento, ts: agora() });

            if (fila.length >= MAX_LOTE) return descarregar();
            if (!timer) timer = setTimeout(descarregar, INTERVALO);
        }

        function pageview() {
            // Descarrega ANTES de trocar o contexto: o envelope iça a URL, então
            // misturar eventos de duas páginas num lote os etiquetaria errado.
            descarregar();
            contexto = lerContexto();

            // Imediato, fora da fila: é o único evento que não pode se perder.
            // Aba fechada em dois segundos ainda registra a visita.
            enviar([{ t: 'pageview', ts: agora() }], contexto);
        }

        // Em SPA não há recarregamento, então trocar de rota não dispara nada.
        // Envolvemos os métodos do history preservando o retorno original — o
        // site do cliente não pode notar diferença.
        function observarRotas() {
            const trocou = () => {
                if (location.href !== contexto.url) pageview();
            };

            for (const nome of ['pushState', 'replaceState']) {
                const original = history[nome];
                history[nome] = function (...args) {
                    const resultado = original.apply(this, args);
                    trocou();
                    return resultado;
                };
            }
            addEventListener('popstate', trocou);
        }

        // A biblioteca do Google, não conta própria: CLS é a maior janela de 5s
        // (não a soma) e INP é percentil de interações (não a média). Número que
        // não bate com o PageSpeed do cliente não é métrica, é discussão.
        function observarVitals() {
            const registrar = (m) => enfileirar({
                t: 'vital',
                name: m.name,
                // CLS é adimensional e vem com muitas casas; o resto é em ms.
                value: m.name === 'CLS' ? Number(m.value.toFixed(4)) : Math.round(m.value),
                rating: m.rating,
            });

            for (const observar of [onLCP, onINP, onCLS, onFCP, onTTFB]) {
                try {
                    observar(registrar);
                } catch {
                    // Navegador sem a API daquela métrica: as outras continuam.
                }
            }
        }

        // A cascata inteira sai de um objeto só, lido uma vez, sem observer e
        // sem biblioteca. É o que transforma "está lento" em "está lento AQUI":
        // TTFB sozinho não distingue DNS ruim de servidor lento.
        function medirCarregamento() {
            const [nav] = performance.getEntriesByType('navigation');
            if (!nav) return;

            // activationStart desloca tudo em página pré-renderizada: os tempos
            // passam a contar da ativação, não do carregamento invisível.
            const zero = nav.activationStart || 0;
            const desde = (t) => (t ? Math.max(0, Math.round(t - zero)) : null);
            const entre = (a, b) => (a && b && b >= a ? Math.round(b - a) : null);

            enfileirar({
                t: 'nav',
                // navigate, reload ou back_forward: recarga e volta no histórico
                // têm cache quente e distorceriam a média se contassem junto.
                kind: nav.type,
                redirect: entre(nav.redirectStart, nav.redirectEnd),
                dns: entre(nav.domainLookupStart, nav.domainLookupEnd),
                tcp: entre(nav.connectStart, nav.secureConnectionStart || nav.connectEnd),
                tls: nav.secureConnectionStart ? entre(nav.secureConnectionStart, nav.connectEnd) : null,
                // O tempo que o servidor do cliente levou pensando.
                server: entre(nav.requestStart, nav.responseStart),
                download: entre(nav.responseStart, nav.responseEnd),
                dom: desde(nav.domContentLoadedEventEnd),
                load: desde(nav.loadEventEnd),
                // Quanto o HTML pesou. Zero costuma significar cache.
                bytes: nav.transferSize ?? null,
            });
        }

        function iniciar() {
            pageview();
            observarRotas();

            // loadEventEnd só existe depois do load; antes dele viria zero.
            if (document.readyState === 'complete') medirCarregamento();
            else addEventListener('load', () => setTimeout(medirCarregamento, 0), { once: true });

            // ORDEM IMPORTA: a biblioteca também escuta visibilitychange para
            // fechar LCP, CLS e INP. Registrando-a primeiro, os listeners dela
            // rodam antes do nosso — as métricas entram na fila e saem no mesmo
            // lote. Invertido, elas seriam enfileiradas depois da descarga e
            // morreriam com a página.
            observarVitals();

            // O gancho que importa. beforeunload e unload não são confiáveis no
            // celular, onde a aba é descartada sem avisar; visibilitychange é o
            // único que dispara de verdade — e é nele que LCP, CLS, INP e tempo
            // na página ficarão definitivos.
            addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') descarregar();
            });

            // Rede de segurança. Descarregar duas vezes é inofensivo: a segunda
            // encontra a fila vazia e sai.
            addEventListener('pagehide', descarregar);
        }

        // Ponto de entrada para os próximos tipos de evento (conversão, scroll,
        // vitals) sem mexer nesta estrutura.
        globalThis.__coddara = { enfileirar, descarregar };

        // Página pré-renderizada pelo navegador — ou aberta em aba de fundo —
        // fica 'hidden' e mede innerWidth 0. Começar aí contaria visita que
        // ninguém viu, então esperamos ficar visível.
        if (document.visibilityState !== 'hidden') {
            iniciar();
        } else {
            addEventListener('visibilitychange', function aoAparecer() {
                if (document.visibilityState === 'hidden') return;
                removeEventListener('visibilitychange', aoAparecer);
                iniciar();
            });
        }
    } catch {
        // Silêncio proposital: nenhum erro nosso vai para o console do cliente.
    }
})();

import geoip from 'geoip-lite';

// IP vira localização e morre aqui. Este módulo é o único lugar do sistema que
// vê o IP de um visitante — depois dele, só sobra cidade, estado e país.
//
// O banco é carregado na memória no primeiro import: ~110MB. É o preço de não
// mandar o IP de cada visitante do cliente para uma API de terceiro, o que
// criaria uma relação de subprocessamento que teríamos de declarar.
export function localizar(ip) {
    if (!ip) return VAZIO;

    // Express devolve IPv6 mapeado ('::ffff:187.45.0.1') quando a conexão é
    // IPv4 num socket dual-stack. O banco não reconhece essa forma.
    const limpo = ip.startsWith('::ffff:') ? ip.slice(7) : ip;

    try {
        const achado = geoip.lookup(limpo);
        if (!achado) return VAZIO;

        return {
            country: achado.country || null,
            region: achado.region || null,
            city: achado.city || null,
        };
    } catch {
        // Faixa estranha ou banco corrompido não pode derrubar o ingest.
        return VAZIO;
    }
}

const VAZIO = Object.freeze({ country: null, region: null, city: null });

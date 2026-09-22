import { createContext, useContext } from 'react';

// O balão da explicação precisa levar para a página "Como funciona", e ele mora
// três ou quatro níveis abaixo de quem controla a navegação. Passar a função de
// mão em mão sujaria a assinatura de todo componente no caminho — inclusive os
// que não têm nada a ver com isso.
export const NavegacaoContext = createContext(null);

export const useIrParaAjuda = () => useContext(NavegacaoContext);

Cofre é a identidade visual de um site de controle financeiro, derivada da paleta, dos raios e da tipografia encontrados no código do app Cerco — Bloqueio de Apps. O verde de identidade, o fundo quase preto e os raios generosos vêm diretamente desse app; a escala numérica e os cartões de saldo são adições intencionais deste sistema, já que o app de origem não exibia valores monetários.

## Fundamentos de conteúdo

Trate o dinheiro do usuário com a mesma objetividade com que o Cerco trata um app bloqueado: direto, sem eufemismo. "Saldo disponível", não "seu dinheirinho"; "Despesas do mês", não "gastinhos". Valores sempre em `amount-*` (fonte `mono`), para os dígitos alinharem em colunas — nunca a fonte `sans` para um número que o usuário vai comparar com outro. Use "R$" antes do valor, vírgula para centavos, ponto para milhar (`R$ 1.906,55`). Sinal de mais ou menos (+ / −) explícito ao lado de todo valor com direção — nunca a cor isolada como único sinal. Sem emoji, sem exclamação em mensagem de erro ou de saldo negativo.

## Fundações visuais

**Cor.** O tema escuro (`dark`) é o padrão, herdado do Cerco: fundo quase preto (`surface-100`, `#08090A`) e texto quase branco (`ink`). O tema claro (`light`) existe para quem prefere ou para impressão/relatório, com os mesmos papéis de token, nunca uma simples inversão de luminosidade — veja `surface-200` e `ink-muted` para os valores exatos de cada tema. `brand` (`#35F58E` no escuro, `#0F6E4F` no claro) é a cor de identidade: ação primária, link, foco e todo valor positivo de saldo. `success` é um verde deliberadamente distinto de `brand` — usado só para confirmações do sistema ("transação salva", "backup concluído"), nunca para saldo, para não confundir identidade de marca com um estado passageiro. `danger` é reservado para erro, conta atrasada e saldo negativo; não decore gastos comuns com ele. As cores de categoria (`category-blue`, `category-orange`, `category-neutral`) identificam tipos de despesa em listas, chips e gráficos — mantenha a mesma cor para a mesma categoria em toda a interface.

**Tipografia.** Pilha de sistema (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`) para toda a interface — o app de origem não carrega fonte própria, e um site de finanças ganha mais com carregamento instantâneo do que com uma fonte de marca. Números usam a pilha monoespaçada `font-mono` (`ui-monospace, "SF Mono", "Cascadia Code", Menlo, monospace`) em todo valor monetário, para que colunas de números alinhem verticalmente. Rótulos em versalete (`label-lg`, `label-md`, `label-sm`) carregam o letter-spacing largo (.12em a .22em) extraído do app de origem — é a assinatura tipográfica do sistema, use-a para todo texto pequeno em maiúsculas, nunca para frases comuns.

**Espaçamento e raio.** Escala de 4px (`space-1` a `space-10`). Os raios vêm quase todos do Cerco: `radius-md` (14px) é o raio padrão de cartão, `radius-lg` (20px) é o de folhas e modais, `radius-xl` (34px) é reservado só para o cartão de saldo — o maior raio marca a superfície mais importante da tela. `radius-pill` (999px) é só para Button, Badge e qualquer rótulo em pílula.

**Elevação e bordas.** No tema escuro, separação vem de `line` e da diferença entre `surface-100`/`surface-200`/`surface-300` — não de sombra. No tema claro, `shadow-sm` e `shadow-md` dão uma elevação suave a chips flutuantes e folhas. Nunca combine sombra pesada com fundo quase preto: lá, a borda é o recurso.

**Estados e contraste.** Todo par texto/fundo nas listas acima mantém pelo menos 4,5:1 em cada tema — nos tokens `warning`, `category-blue` e `category-orange` o valor do tema claro foi escurecido a partir do mesmo matiz do tema escuro para preservar esse contraste; o valor do tema escuro é exatamente o do app de origem. `success` e `danger` nunca se distinguem só pela cor: todo indicador de tendência leva o sinal (+ / −) escrito, e todo rótulo de status leva uma palavra, não só um ponto colorido.

## Iconografia

O app de origem não trouxe um conjunto de ícones próprio — não foi possível copiar nenhum. Até que a marca defina um conjunto, use glifos de um sistema neutro (ex.: Lucide ou Feather) em `ink` ou `ink-muted`, no mesmo peso visual em toda a tela, nunca coloridos exceto quando representam diretamente uma categoria (`category-*`). O ponto de categoria usado em `TransactionRow` — um círculo sólido de 8px — é o único marcador decorativo próprio do sistema, e é também o motivo da capa.

## Componentes

Este sistema inclui `Button`, `Badge`, `StatCard` e `TransactionRow` — o conjunto mínimo para um painel de controle financeiro (ação, status, resumo numérico e lista de lançamentos). Não foram adicionados componentes "de costume" (Avatar, Toast, Tabs) sem um pedido ou uma tela de referência: adicione-os quando o site tiver uma tela que precise deles, descrevendo o uso real, não um genérico.

## Acabamento "HUD" do app (fora dos tokens)

O visual futurista do app é composto só com tokens do Cofre, em `assets/css/style.css` e `login.css`: aura de fundo (`brand` e `category-blue` em baixa opacidade) com malha de `line`, superfícies de vidro (`surface-200` translúcido com desfoque), brilho neon (`--glow`, derivado de `brand`) em foco, ação primária e item ativo, e entrada animada das telas. No tema claro a intensidade cai (`--glow-a`, `--aura-a`). Tudo respeita `prefers-reduced-motion`. Layout responsivo: menu lateral (>1024px), trilho de ícones (681–1024px) e barra inferior (até 680px); blocos internos usam container queries.

## Uso neste projeto

| Arquivo | Função |
|---|---|
| `tokens.json` | Fonte única dos tokens (cores por tema, tipografia, espaçamento, raios, sombras) |
| `tokens.css` | Gerado de `tokens.json` por `python design-system/tools/build_tokens.py`; não edite à mão |
| `components.css` | Componentes de referência do Cofre (`cf-btn`, `cf-badge`, `cf-statcard`, `cf-txn-row`); o app os carrega depois de `tokens.css` e só acrescenta layout em `assets/css/style.css` e `assets/css/login.css` |
| `../assets/icons/sprite.svg` | Ícones Lucide (`<svg class="icon"><use href="assets/icons/sprite.svg#i-plus"/></svg>`), em `currentColor` |

Carregue `tokens.css` antes dos demais estilos. O tema escuro é o padrão; o claro segue `prefers-color-scheme` ou é forçado com `<html data-theme="light">` (o `app.js` guarda a escolha em `amtech-theme`). Para mudar a identidade visual, altere `tokens.json` e gere o CSS de novo.

Fonte original do sistema: artefato "Cofre" no Claude (https://claude.ai/artifact/QYYSvFCr9RR7E5H6jaBbEA).

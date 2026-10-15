# Cofre

Design system do AMTech Financeiro. Paleta, raios e tipografia derivam do app Cerco — Bloqueio de Apps (verde de identidade, fundo quase preto, raios generosos). A escala numérica e os cartões de saldo foram acrescentados aqui.

## Conteúdo

- Texto direto: "Saldo disponível", "Despesas do mês".
- Valores em fonte `mono` (classes `amount-*`), para os dígitos alinharem em colunas.
- Formato `R$ 1.906,55`: "R$" antes do valor, vírgula nos centavos, ponto no milhar.
- Todo valor com direção leva sinal explícito (+ / −). A cor nunca é o único indicador.
- Sem emoji e sem exclamação em erros ou saldo negativo.

## Cor

- **Temas:** o escuro é o padrão (`surface-100` `#08090A`, texto `ink`). O claro usa os mesmos papéis de token, com valores próprios.
- **`brand`:** `#35F58E` no escuro, `#0F6E4F` no claro. Ação primária, link, foco e valores positivos.
- **`success`:** só para confirmações do sistema ("lançamento salvo"). Nunca para saldo.
- **`danger`:** erro, conta atrasada e saldo negativo. Não use em gastos comuns.
- **`category-blue`, `category-orange`, `category-neutral`:** tipos de lançamento. A mesma categoria mantém a mesma cor em toda a interface.
- **Contraste:** todo par texto/fundo tem pelo menos 4,5:1 nos dois temas. Em `warning`, `category-blue` e `category-orange`, o tema claro usa uma versão mais escura do mesmo matiz.

## Tipografia

- Texto: fonte do sistema (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`).
- Valores monetários: `font-mono` (`ui-monospace, "SF Mono", "Cascadia Code", Menlo, monospace`).
- Rótulos em versalete (`label-lg`, `label-md`, `label-sm`), com espaçamento entre letras de .12em a .22em. Só para textos curtos em maiúsculas, nunca para frases.

## Espaçamento, raio e elevação

- Espaçamento em escala de 4px (`space-1` a `space-10`).
- Raios: `radius-md` (14px) para cartões, `radius-lg` (20px) para folhas e modais, `radius-xl` (34px) só para o cartão de saldo, `radius-pill` para botões, badges e rótulos em pílula.
- No tema escuro, a separação vem de `line` e das superfícies `surface-100/200/300`, sem sombra. No claro, `shadow-sm` e `shadow-md` elevam chips e folhas.

## Ícones

Lucide, em `assets/icons/sprite.svg`, na cor `ink` ou `ink-muted`. Só ganham cor quando representam uma categoria. O ponto de categoria (círculo de 8px) é o único marcador próprio do sistema.

## Componentes

`Button`, `Badge`, `StatCard` e `TransactionRow`, em `components.css` (classes `cf-btn`, `cf-badge`, `cf-statcard`, `cf-txn-row`). Novos componentes entram quando houver uma tela que precise deles.

## Acabamento do app

Fica em `assets/css/style.css` e `login.css`, usando só tokens: aura e malha de fundo, superfícies de vidro, brilho em foco, ação primária e item ativo, e animação de entrada das telas. No tema claro os efeitos são mais discretos (`--glow-a`, `--aura-a`). Tudo respeita `prefers-reduced-motion`.

Layout: menu lateral acima de 1024px, trilho de ícones de 681 a 1024px e barra inferior até 680px. Os blocos internos usam container queries.

## Arquivos

| Arquivo | Função |
|---|---|
| `tokens.json` | Fonte dos tokens (cores por tema, tipografia, espaçamento, raios, sombras) |
| `tokens.css` | Gerado por `python design-system/tools/build_tokens.py`; não edite à mão |
| `components.css` | Componentes do Cofre; o app só acrescenta layout em `assets/css/style.css` e `login.css` |
| `../assets/icons/sprite.svg` | Ícones, usados com `<svg class="icon"><use href="assets/icons/sprite.svg#i-plus"/></svg>` |

Carregue `tokens.css` antes dos demais estilos. O tema escuro é o padrão; o claro segue `prefers-color-scheme` ou é forçado com `<html data-theme="light">` (o `app.js` guarda a escolha em `amtech-theme`). Para mudar o visual, edite `tokens.json` e gere o CSS de novo.

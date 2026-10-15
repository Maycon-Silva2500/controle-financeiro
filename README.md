# AMTech Controle Financeiro

Aplicação web estática para controle financeiro, com autenticação e persistência no Firebase.

## Estrutura

```text
.
├── index.html             # aplicação principal
├── login.html             # autenticação e recuperação de acesso
├── manifest.json          # metadados do app instalável (PWA)
├── firestore.rules        # regras sugeridas do Firestore (lançamentos, fechamentos e perfis por usuário)
├── design-system/         # Cofre: tokens, componentes de referência e gerador (fonte única do visual)
│   ├── tokens.json        # fonte dos tokens
│   ├── tokens.css         # gerado de tokens.json
│   ├── components.css
│   ├── tools/build_tokens.py
│   └── README.md
└── assets/
    ├── css/style.css      # layout responsivo (desktop, tablet, celular) e acabamento HUD, sobre tokens e componentes do Cofre
    ├── css/login.css      # autenticação (usa os tokens)
    ├── js/app.js          # interface, regras e integração Firebase
    ├── icons/sprite.svg   # ícones Lucide
    ├── help/              # imagens ilustradas da tela de Ajuda (geradas)
    └── images/            # logo, favicon e ícones do PWA

tools/
└── gerar_ajuda.py         # recria as imagens da Ajuda a partir do próprio app
```

As páginas HTML ficam na raiz para funcionar com hospedagem estática. Arquivos de cada camada ficam em `assets/` por tipo. O JavaScript ainda concentra interface, regras e acesso a dados; conforme o projeto crescer, separar módulos de autenticação, transações, relatórios e serviços Firebase será o próximo passo natural.

## Design system

Os tokens do Cofre ficam em [`design-system/tokens.json`](design-system/tokens.json); [`design-system/tokens.css`](design-system/tokens.css) é gerado por `python design-system/tools/build_tokens.py` e carregado antes de `style.css` e `login.css`. Para mudar cores, fonte, raios ou sombras, edite `tokens.json` e gere o CSS de novo. O tema escuro é o padrão. As regras de uso estão em [`design-system/README.md`](design-system/README.md).

Layout em três faixas: acima de 1024px menu lateral (pode ser recolhido pelo usuário), de 681 a 1024px trilho de ícones e até 680px barra inferior; os blocos internos usam container queries. Validado no Edge em 1440, 1024, 768, 390 e 320px, nos temas claro e escuro.

## Foto de perfil

A foto é recortada em quadrado, reduzida para 160 px e comprimida (WebP, cerca de 10 KB) no navegador; o arquivo original nunca é enviado. Só essa versão pequena é gravada, em `perfis/{uid}` no Firestore, com cópia em `localStorage` para exibir na hora. Se o servidor recusar a gravação (regras sem a coleção `perfis`), a foto fica só no aparelho. A regra necessária está em [`firestore.rules`](firestore.rules).

## Ajuda

A tela Ajuda explica cada tela e cada campo com imagens numeradas (versão escura e clara). Para regenerá-las depois de mudar o visual: `pip install playwright pillow` e `python tools/gerar_ajuda.py`. Os números das imagens precisam continuar batendo com as listas numeradas da seção Ajuda do `index.html`.

## Executar

Sirva a pasta com um servidor HTTP estático e abra `index.html`. O projeto usa módulos ES e imports do Firebase via CDN, portanto não deve ser aberto diretamente como arquivo (`file://`).

## APIs financeiras pesquisadas (13/10/2026)

| API | O que oferece | Gratuidade e limites | Adequação |
|---|---|---|---|
| [Banco Central — dados abertos / SGS](https://dadosabertos.bcb.gov.br/) | Séries econômicas oficiais, como Selic, inflação e câmbio | Dados públicos e abertos; consulte a documentação e limites de cada conjunto | Melhor opção para enriquecer relatórios com indicadores brasileiros, sem importar movimentações bancárias |
| [Frankfurter](https://frankfurter.dev/) | Câmbio diário e séries históricas para mais de 200 moedas | Gratuita, sem chave; taxas diárias, não é cotação intradiária | Simples para conversões e despesas em moeda estrangeira |
| [Belvo Open Finance](https://belvo.com/pt-br/planos-precos/) | Conexão bancária, dados de contas e transações no Brasil | Sandbox gratuito com dados fictícios; produção exige contato comercial e plano | Melhor candidata para sincronizar contas reais no Brasil, mas não é uma API gratuita de produção |
| [Alpha Vantage](https://www.alphavantage.co/support/) | Ações, câmbio e outros dados de mercado | Plano gratuito: 25 requisições por dia na maioria dos conjuntos; realtime US é pago | Útil apenas se o produto passar a acompanhar investimentos/mercado |

### Recomendação

Para este app, que já registra receitas e despesas no Firebase, comece pelo SGS do Banco Central ou Frankfurter se quiser exibir indicadores e câmbio. Para importar extratos reais via Open Finance, a Belvo permite prototipar gratuitamente, mas o uso em produção não é gratuito. O compartilhamento via Open Finance requer consentimento do usuário; o Banco Central informa que esse compartilhamento entre instituições é gratuito para o cliente, mas isso não significa que um agregador de APIs ofereça seu serviço de produção sem custo ([FAQ do Banco Central](https://www.bcb.gov.br/meubc/faqs/s/open-finance)).

Antes de integrar um provedor, confirme cobertura, política de retenção, limites, termos comerciais e requisitos de segurança. Segredos de API de terceiros devem ficar em um backend, nunca no JavaScript entregue ao navegador.

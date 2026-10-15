# AMTech Controle Financeiro

Aplicação web estática para controle financeiro, com autenticação e persistência no Firebase.

## Estrutura

```text
.
├── index.html             # aplicação principal
├── login.html             # autenticação e recuperação de acesso
├── manifest.json          # metadados do app instalável (PWA)
└── assets/
    ├── css/style.css      # estilos da aplicação
    ├── js/app.js          # interface, regras e integração Firebase
    └── images/            # logo, favicon e ícones do PWA
```

As páginas HTML ficam na raiz para funcionar com hospedagem estática. Arquivos de cada camada ficam em `assets/` por tipo. O JavaScript ainda concentra interface, regras e acesso a dados; conforme o projeto crescer, separar módulos de autenticação, transações, relatórios e serviços Firebase será o próximo passo natural.

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

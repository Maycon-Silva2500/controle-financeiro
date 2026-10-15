"""Gera as imagens da tela de Ajuda (assets/help/*.webp), uma por tema.

Abre o app com dados de demonstração (Firebase simulado), numera os campos e captura a tela.
Os números precisam bater com as listas da seção Ajuda do index.html.

Uso, na raiz do projeto: python tools/gerar_ajuda.py
Requisitos: pip install playwright pillow (usa o Edge; sem ele, o Chromium do Playwright)
"""
import datetime
import functools
import http.server
import io
import json
import pathlib
import sys
import threading

from PIL import Image
from playwright.sync_api import sync_playwright

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SAIDA = RAIZ / 'assets' / 'help'
sys.stdout.reconfigure(encoding='utf-8')

# ---- dados de demonstração
HOJE = datetime.date.today()


def mes_atras(n, dia):
    total = HOJE.year * 12 + (HOJE.month - 1) - n
    return datetime.date(total // 12, total % 12 + 1, dia).isoformat()


LANCAMENTOS = [
    (0, 5, 'receita', 'Salário', 6200), (0, 9, 'despesa', 'Aluguel', 1800), (0, 11, 'despesa', 'Supermercado', 640.35),
    (0, 12, 'investimento', 'Tesouro Selic', 800), (0, 13, 'despesa', 'Internet', 129.9),
    (1, 5, 'receita', 'Salário', 6200), (1, 8, 'despesa', 'Aluguel', 1800), (1, 14, 'despesa', 'Supermercado', 890.1),
    (1, 18, 'despesa', 'Restaurante', 310), (1, 20, 'investimento', 'Tesouro Selic', 1000), (1, 25, 'receita', 'Trabalho extra', 1500),
    (2, 5, 'receita', 'Salário', 6000), (2, 8, 'despesa', 'Aluguel', 1800), (2, 15, 'despesa', 'Supermercado', 720),
    (2, 22, 'despesa', 'Plano de saúde', 540), (3, 5, 'receita', 'Salário', 6000), (3, 8, 'despesa', 'Aluguel', 1800),
    (3, 12, 'despesa', 'Supermercado', 810), (3, 17, 'investimento', 'CDB', 1200), (4, 5, 'receita', 'Salário', 5800),
    (4, 8, 'despesa', 'Aluguel', 1800), (4, 19, 'despesa', 'Viagem', 2100), (5, 5, 'receita', 'Salário', 5800),
    (5, 8, 'despesa', 'Aluguel', 1800), (5, 21, 'despesa', 'Supermercado', 690),
]
TRANSACOES = [{'id': f't{i}', 'data': mes_atras(m, d), 'valor': v, 'descricao': desc, 'tipo': tipo}
              for i, (m, d, tipo, desc, v) in enumerate(LANCAMENTOS)]
FECHAMENTOS = [
    {'mesReferencia': mes_atras(1, 1)[:7], 'totalReceitas': 7700, 'totalDespesas': 3000.1, 'totalInvestimentos': 1000, 'saldoFinal': 3699.9},
    {'mesReferencia': mes_atras(2, 1)[:7], 'totalReceitas': 6000, 'totalDespesas': 3060, 'totalInvestimentos': 0, 'saldoFinal': 2940},
]


def instantaneo(itens):
    return "{empty:%s,forEach:(f)=>%s.forEach(d=>f({id:d.id,data:()=>d}))}" % ('false' if itens else 'true', json.dumps(itens))


FIREBASE = {
    'firebase-app.js': "export const initializeApp=()=>({});",
    'firebase-auth.js': """const u={uid:'demo',email:'maria.souza@exemplo.com',displayName:'Maria Souza',metadata:{creationTime:'Tue, 01 Sep 2026 12:00:00 GMT',lastSignInTime:'Wed, 14 Oct 2026 15:30:00 GMT'}};
export const getAuth=()=>({currentUser:u});export const onAuthStateChanged=(a,cb)=>cb(u);export const signOut=async()=>{};
export const updateProfile=async()=>{};export const EmailAuthProvider={credential:()=>({})};export const reauthenticateWithCredential=async()=>{};
export const updatePassword=async()=>{};export const sendPasswordResetEmail=async()=>{};""",
    'firebase-firestore.js': ("export const getFirestore=()=>({});export const collection=(d,n)=>({n});export const query=(r)=>r;export const where=()=>0;"
                              "export const doc=(d,c,i)=>({path:c+'/'+i});"
                              "export const onSnapshot=(q,cb)=>cb(q.path?{exists:()=>false}:(q.n==='transacoes'?%s:%s));"
                              "export const addDoc=async()=>{};export const setDoc=async()=>{};export const deleteDoc=async()=>{};export const updateDoc=async()=>{};"
                              "export const writeBatch=()=>({set(){},delete(){},commit:async()=>{}});"
                              "export const getDoc=async()=>({exists:()=>false});") % (instantaneo(TRANSACOES), instantaneo(FECHAMENTOS)),
}

# ---- figuras
# sels: seletores envolvidos pela moldura; pos: posição do número (tl, tr, bl, br = cantos; l, r = lados)
FIGURAS = {
    'menu': dict(viewport=(1280, 700), preparar='painel+menu', recorte=['body'], itens=[
        dict(sels=['#btn-recolher-menu'], pos='r'),
        dict(sels=['#menu-graficos', '#menu-consulta'], pos='r'),
        dict(sels=['#nav-badge-consulta'], pos='r'),
        dict(sels=['#menu-ajuda'], pos='r'),
        dict(sels=['.nav-user'], pos='r'),
        dict(sels=['#sync-status'], pos='bl'),
        dict(sels=['#btn-theme'], pos='bl'),
        dict(sels=['#btn-user'], pos='tr'),
    ]),
    'painel1': dict(viewport=(1280, 1500), preparar='painel', recorte=['.painel-toolbar', '.card-fluxo', '.card-destino'], itens=[
        dict(sels=['.seg-periodo'], pos='tl'),
        dict(sels=['.balance-card'], pos='tl'),
        dict(sels=['.painel-kpis .cf-statcard:nth-child(1)'], pos='tl'),
        dict(sels=['.painel-kpis .cf-statcard:nth-child(4)'], pos='tl'),
        dict(sels=['.card-fluxo'], pos='tl'),
        dict(sels=['.card-destino'], pos='tl'),
    ]),
    'painel2': dict(viewport=(1280, 1500), preparar='painel', recorte=['.card-top', '.card-recentes'], itens=[
        dict(sels=['.card-top'], pos='tl'),
        dict(sels=['.card-recentes'], pos='tl'),
        dict(sels=['#btn-ver-todos'], pos='bl'),
    ]),
    'lancar': dict(viewport=(1280, 900), preparar='lancar', recorte=['.premium-form'], itens=[
        dict(sels=['.amount-wrapper'], pos='tr'),
        dict(sels=['.type-segmented-control'], pos='tr'),
        dict(sels=['.form-grid .field:nth-child(1) .input-icon'], pos='tr'),
        dict(sels=['.quick-dates'], pos='bl'),
        dict(sels=['.form-grid .field:nth-child(2) .input-icon'], pos='tr'),
        dict(sels=['#btn-salvar-form'], pos='tl'),
        dict(sels=['#btn-limpar'], pos='tl'),
    ]),
    'consulta': dict(viewport=(1280, 900), preparar='consulta', recorte=['.toolbar', '.list-card'], itens=[
        dict(sels=['.toolbar-busca .input-icon'], pos='tl'),
        dict(sels=['.filter-chips'], pos='tl'),
        dict(sels=['#resumo-lista'], pos='tl'),
        dict(sels=['#lista-transacoes .cf-txn-row:first-child .cf-txn-main'], pos='tl'),
        dict(sels=['#lista-transacoes .cf-txn-row:first-child .cf-txn-amount'], pos='tl'),
        dict(sels=['#lista-transacoes .cf-txn-row:first-child .txn-actions'], pos='tl'),
    ]),
    'fechar': dict(viewport=(1280, 900), preparar='fechar', recorte=['#ecra-fechamento'], itens=[
        dict(sels=['#ecra-fechamento .input-icon'], pos='tr'),
        dict(sels=['#btn-fazer-fechamento'], pos='tl'),
        dict(sels=['#lista-fechamentos .cf-txn-row:first-child'], pos='tl'),
    ]),
    'conta1': dict(viewport=(1280, 1100), preparar='conta', recorte=['.conta-grid > section:nth-child(1)', '.conta-grid > section:nth-child(2)'], itens=[
        dict(sels=['.foto-wrap'], pos='tl'),
        dict(sels=['#btn-escolher-foto'], pos='tl'),
        dict(sels=['#form-perfil .field:nth-of-type(1) .input-icon'], pos='tr'),
        dict(sels=['#form-perfil .field:nth-of-type(2) .input-icon'], pos='tr'),
        dict(sels=['.meta-list'], pos='tl'),
        dict(sels=['#form-senha .field:nth-of-type(1) .input-icon'], pos='tr'),
        dict(sels=['#form-senha .field:nth-of-type(2)'], pos='tr'),
        dict(sels=['#form-senha .field:nth-of-type(3) .input-icon'], pos='tr'),
        dict(sels=['#btn-esqueci-senha'], pos='tl'),
    ]),
    'conta2': dict(viewport=(1280, 1100), preparar='conta', recorte=['.conta-grid > section:nth-child(3)', '.conta-grid > section:nth-child(4)'], itens=[
        dict(sels=['.tema-grid'], pos='tl'),
        dict(sels=['#btn-sair-conta'], pos='tl'),
    ]),
}

JS_RETANGULO = """(sels) => { const r = sels.map(s => { const e = document.querySelector(s); if (!e) throw new Error('não achei ' + s); return e.getBoundingClientRect(); });
  const l = Math.min(...r.map(x => x.left)), t = Math.min(...r.map(x => x.top)), rr = Math.max(...r.map(x => x.right)), b = Math.max(...r.map(x => x.bottom));
  return { x: l, y: t, w: rr - l, h: b - t }; }"""

JS_MARCAR = """({ itens, tema, limites }) => {
  const marca = tema === 'dark' ? '#35F58E' : '#0F6E4F', sobre = tema === 'dark' ? '#08090A' : '#FFFFFF';
  const camada = document.createElement('div');
  camada.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none';
  itens.forEach((it, i) => {
    const r = it.sels.map(s => { const e = document.querySelector(s); if (!e) throw new Error('não achei ' + s); return e.getBoundingClientRect(); });
    const l = Math.min(...r.map(x => x.left)), t = Math.min(...r.map(x => x.top)), rr = Math.max(...r.map(x => x.right)), b = Math.max(...r.map(x => x.bottom));
    const caixa = document.createElement('div');
    caixa.style.cssText = `position:absolute;left:${l - 4}px;top:${t - 4}px;width:${rr - l + 8}px;height:${b - t + 8}px;border:2px dashed ${marca};border-radius:12px;background:${marca}14`;
    camada.appendChild(caixa);
    const centro = { tl: [l - 4, t - 4], tr: [rr - 6, t - 4], bl: [l - 4, b + 4], br: [rr + 4, b + 4], l: [l - 4, (t + b) / 2], r: [rr + 4, (t + b) / 2] }[it.pos || 'tl'];
    const x = Math.min(Math.max(centro[0] - 14, limites.x + 2), limites.x + limites.w - 30);
    const y = Math.min(Math.max(centro[1] - 14, limites.y + 2), limites.y + limites.h - 30);
    const n = document.createElement('div');
    n.textContent = String(i + 1);
    n.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:28px;height:28px;border-radius:50%;background:${marca};color:${sobre};font:700 14px/28px system-ui,sans-serif;text-align:center;box-shadow:0 0 0 3px ${tema === 'dark' ? 'rgba(8,9,10,.7)' : 'rgba(255,255,255,.85)'}`;
    camada.appendChild(n);
  });
  document.body.appendChild(camada);
}"""


def preparar(pg, como):
    if como in ('painel', 'painel+menu'):
        pg.click('#menu-graficos')
        pg.click('[data-periodo="3"]')
        pg.wait_for_timeout(1800)
        if como == 'painel+menu':
            pg.click('#btn-user')
            pg.wait_for_timeout(300)
    elif como == 'lancar':
        pg.click('#menu-novo')
        pg.fill('#valor', '125.90')
        pg.fill('#descricao', 'Supermercado')
    elif como == 'consulta':
        pg.click('#menu-consulta')
        # só as primeiras linhas; o contador mantém o total
        pg.add_style_tag(content='#lista-transacoes .cf-txn-row:nth-child(n+5){display:none}')
    elif como == 'fechar':
        pg.click('#menu-fechamento')
        pg.fill('#mes-fechamento', HOJE.strftime('%Y-%m'))
    elif como == 'conta':
        pg.click('#menu-conta')
        pg.fill('#senha-atual', 'senhaatual')
        pg.fill('#senha-nova', 'Segura#2026')
        pg.fill('#senha-confirma', 'Segura#2026')
    pg.wait_for_timeout(700)


def main():
    SAIDA.mkdir(parents=True, exist_ok=True)
    class Silencioso(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args, **kwargs):
            pass

    servidor = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=str(RAIZ)))
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{servidor.server_address[1]}/'
    medidas = {}

    with sync_playwright() as p:
        try:
            nav = p.chromium.launch(channel='msedge')
        except Exception:
            nav = p.chromium.launch()
        for nome, fig in FIGURAS.items():
            for tema in ('dark', 'light'):
                ctx = nav.new_context(viewport={'width': fig['viewport'][0], 'height': fig['viewport'][1]}, color_scheme=tema, locale='pt-BR')
                ctx.add_init_script(f"localStorage.setItem('amtech-theme','{tema}'); localStorage.removeItem('amtech-nav');")
                pg = ctx.new_page()

                def interceptar(rota):
                    for arquivo, corpo in FIREBASE.items():
                        if rota.request.url.endswith(arquivo):
                            return rota.fulfill(body=corpo, content_type='text/javascript')
                    rota.continue_()
                pg.route(lambda u: 'gstatic.com' in u, interceptar)
                pg.goto(base + 'index.html')
                pg.wait_for_timeout(900)
                preparar(pg, fig['preparar'])
                # o clique pode rolar a página; a captura parte do topo
                pg.evaluate("document.getElementById('conteudo-principal').scrollTo(0, 0); window.scrollTo(0, 0)")
                pg.wait_for_timeout(400)

                area = pg.evaluate(JS_RETANGULO, fig['recorte'])
                margem = 22
                vw, vh = fig['viewport']
                x0 = max(0, area['x'] - margem); y0 = max(0, area['y'] - margem)
                x1 = min(vw, area['x'] + area['w'] + margem); y1 = min(vh, area['y'] + area['h'] + margem)
                recorte = {'x': x0, 'y': y0, 'width': x1 - x0, 'height': y1 - y0}
                pg.evaluate(JS_MARCAR, {'itens': fig['itens'], 'tema': tema, 'limites': {'x': x0, 'y': y0, 'w': x1 - x0, 'h': y1 - y0}})
                png = pg.screenshot(clip=recorte)
                imagem = Image.open(io.BytesIO(png)).convert('RGB')
                destino = SAIDA / f'{nome}-{"dark" if tema == "dark" else "light"}.webp'
                imagem.save(destino, 'WEBP', quality=82, method=6)
                medidas[nome] = [imagem.width, imagem.height]
                print(f'{destino.name:22} {imagem.width}x{imagem.height}  {destino.stat().st_size / 1024:.0f} KB')
                ctx.close()
        nav.close()
    servidor.shutdown()
    (SAIDA / 'medidas.json').write_text(json.dumps(medidas, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()

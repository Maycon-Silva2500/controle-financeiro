import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, getDoc, setDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================================
// 1. CHAVES DO FIREBASE
// ==========================================================
const firebaseConfig = {
    apiKey: "AIzaSyB67nN2jRUKktgrDWKrfa4eStLwV9-5WEc",
    authDomain: "amtech-controle-financeiro.firebaseapp.com",
    projectId: "amtech-controle-financeiro",
    storageBucket: "amtech-controle-financeiro.firebasestorage.app",
    messagingSenderId: "370711281254",
    appId: "1:370711281254:web:c2db1fe87be145701577a7",
    measurementId: "G-R927NP336V"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const transacoesRef = collection(db, "transacoes");
const fechamentosRef = collection(db, "fechamentos");

let usuarioAtual = null;
let idEdicaoAtual = null;
const graficos = {};
let periodoPainel = '6';
let appPronto = false;
let fotoAtual = null;
let somaReceitas = 0; let somaDespesas = 0; let somaInvestimentos = 0;
let todasTransacoesGlobais = [];
let registrosLista = [];
let filtroTipo = 'todos';
let termoBusca = '';

const $ = (id) => document.getElementById(id);

// ==========================================================
// ÍCONES, VALORES E ELEMENTOS
// ==========================================================
const SPRITE = 'assets/icons/sprite.svg';
const SVG_NS = 'http://www.w3.org/2000/svg';

const MENOS = '−';
const formatarNumero = (valor) => Math.abs(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Espaço sem quebra entre "R$" e o número
const formatBRL = (valor) => `R$ ${formatarNumero(valor)}`;
const formatBRLComSinal = (valor, sinal) => `${sinal}${formatBRL(valor)}`;
const formatBRLSaldo = (valor) => (valor < 0 ? MENOS : '') + formatBRL(valor);

const TIPOS = {
    receita: { rotulo: 'Receita', ponto: 'dot-receita', sinal: '+', classeValor: 'cf-txn-amount-positive', corGrafico: '--brand' },
    despesa: { rotulo: 'Despesa', ponto: 'dot-despesa', sinal: MENOS, classeValor: 'cf-txn-amount-negative', corGrafico: '--category-orange' },
    investimento: { rotulo: 'Investimento', ponto: 'dot-investimento', sinal: MENOS, classeValor: 'cf-txn-amount-negative', corGrafico: '--category-blue' }
};

function criarElemento(tag, classe, texto) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
}

function criarIcone(nome) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');
    const uso = document.createElementNS(SVG_NS, 'use');
    uso.setAttribute('href', `${SPRITE}#i-${nome}`);
    svg.appendChild(uso);
    return svg;
}

function criarLinha({ ponto, titulo, meta, badge, valor, classeValor, acoes }) {
    const linha = criarElemento('div', 'cf-txn-row');
    linha.appendChild(criarElemento('span', `dot ${ponto}`));

    const principal = criarElemento('div', 'cf-txn-main');
    principal.appendChild(criarElemento('p', 'cf-txn-title', titulo));
    const detalhe = criarElemento('p', 'cf-txn-meta', meta);
    if (badge) detalhe.appendChild(criarElemento('span', `cf-badge ${badge.classe}`, badge.texto));
    principal.appendChild(detalhe);
    linha.appendChild(principal);

    linha.appendChild(criarElemento('span', `cf-txn-amount ${classeValor}`, valor));
    if (acoes) linha.appendChild(acoes);
    return linha;
}

function criarBotaoAcao(classe, icone, rotulo, id) {
    const botao = criarElemento('button', `btn-acao ${classe}`);
    botao.type = 'button';
    botao.dataset.id = id;
    botao.title = rotulo;
    botao.setAttribute('aria-label', rotulo);
    botao.appendChild(criarIcone(icone));
    return botao;
}

function dataLocalISO(data = new Date()) {
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${data.getFullYear()}-${mes}-${dia}`;
}

// localStorage pode falhar em modo privado ou com dados bloqueados
const armazenamento = {
    ler(chave) { try { return localStorage.getItem(chave); } catch (e) { return null; } },
    gravar(chave, valor) { try { localStorage.setItem(chave, valor); } catch (e) { /* sem persistência */ } },
    remover(chave) { try { localStorage.removeItem(chave); } catch (e) { /* sem persistência */ } }
};

const semAcento = (texto) => String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ==========================================================
// TEMA: CLARO, ESCURO OU AUTOMÁTICO
// ==========================================================
const raizDoc = document.documentElement;
const consultaClaro = window.matchMedia('(prefers-color-scheme: light)');

function modoTema() {
    const salvo = armazenamento.ler('amtech-theme');
    return salvo === 'light' || salvo === 'dark' ? salvo : 'auto';
}
function temaEfetivoEscuro() {
    const modo = modoTema();
    return modo === 'auto' ? !consultaClaro.matches : modo === 'dark';
}

function sincronizarTemaUI() {
    $('icone-tema').setAttribute('href', `${SPRITE}#i-${temaEfetivoEscuro() ? 'sun' : 'moon'}`);
    const modo = modoTema();
    document.querySelectorAll('[data-tema-opcao]').forEach(botao => {
        botao.setAttribute('aria-pressed', String(botao.dataset.temaOpcao === modo));
    });
    const metaCor = document.querySelector('meta[name="theme-color"]');
    if (metaCor) metaCor.setAttribute('content', getComputedStyle(raizDoc).getPropertyValue('--surface-100').trim());
    if (appPronto && !$('ecra-graficos').hidden) atualizarPainel();
}

function aplicarTema(modo) {
    if (modo === 'light' || modo === 'dark') {
        raizDoc.setAttribute('data-theme', modo);
        armazenamento.gravar('amtech-theme', modo);
    } else {
        raizDoc.removeAttribute('data-theme');
        armazenamento.remover('amtech-theme');
    }
    sincronizarTemaUI();
}

$('btn-theme').addEventListener('click', () => aplicarTema(temaEfetivoEscuro() ? 'light' : 'dark'));
document.addEventListener('click', (evento) => {
    const opcao = evento.target.closest('[data-tema-opcao]');
    if (opcao) aplicarTema(opcao.dataset.temaOpcao);
});
consultaClaro.addEventListener('change', () => { if (modoTema() === 'auto') sincronizarTemaUI(); });
sincronizarTemaUI();

function setarDataAtualSegura() {
    const dataInput = $('data');
    if (dataInput) dataInput.value = dataLocalISO();
    const dataAtualSpan = $('data-atual');
    if (dataAtualSpan) dataAtualSpan.textContent = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
setarDataAtualSegura();

// ==========================================================
// NOTIFICAÇÕES
// ==========================================================
function mostrarNotificacao(mensagem, tipo = 'sucesso') {
    let container = $('amtech-toast-container');
    if (!container) { container = document.createElement('div'); container.id = 'amtech-toast-container'; document.body.appendChild(container); }

    const estilos = {
        sucesso: { cor: 'var(--success)', icone: 'circle-check' },
        info: { cor: 'var(--category-blue)', icone: 'info' },
        erro: { cor: 'var(--danger)', icone: 'circle-alert' }
    };
    const { cor, icone } = estilos[tipo] || estilos.sucesso;

    const toast = criarElemento('div', 'amtech-toast');
    toast.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
    toast.style.setProperty('--toast-cor', cor);
    toast.appendChild(criarIcone(icone));
    toast.appendChild(criarElemento('span', '', mensagem));

    container.appendChild(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 3500);
}

// ==========================================================
// FORMULÁRIOS: VALIDAÇÃO, SENHA VISÍVEL E FORÇA DA SENHA
// ==========================================================
function mostrarErro(input, mensagem) {
    const erro = $(`${input.id}-erro`);
    input.setAttribute('aria-invalid', 'true');
    input.closest('.input-icon, .amount-wrapper')?.classList.add('is-invalid');
    if (erro) { erro.textContent = mensagem; erro.hidden = false; }
}
function limparErro(input) {
    const erro = $(`${input.id}-erro`);
    input.removeAttribute('aria-invalid');
    input.closest('.input-icon, .amount-wrapper')?.classList.remove('is-invalid');
    if (erro) { erro.textContent = ''; erro.hidden = true; }
}
function limparErrosDo(formulario) {
    formulario.querySelectorAll('[aria-invalid="true"]').forEach(limparErro);
}
// Recebe [campo, mensagem], foca o primeiro inválido e retorna true se não há erros
function aplicarErros(erros) {
    erros.forEach(([input, mensagem]) => mostrarErro(input, mensagem));
    if (erros.length) erros[0][0].focus();
    return erros.length === 0;
}
document.addEventListener('input', (evento) => {
    if (evento.target.matches('[aria-invalid="true"]')) limparErro(evento.target);
});

document.addEventListener('click', (evento) => {
    const botao = evento.target.closest('.toggle-senha');
    if (!botao) return;
    const campo = $(botao.dataset.alvo);
    const mostrar = campo.type === 'password';
    campo.type = mostrar ? 'text' : 'password';
    botao.setAttribute('aria-pressed', String(mostrar));
    botao.setAttribute('aria-label', botao.getAttribute('aria-label').replace(mostrar ? 'Mostrar' : 'Ocultar', mostrar ? 'Ocultar' : 'Mostrar'));
    botao.querySelector('use').setAttribute('href', `${SPRITE}#i-${mostrar ? 'eye-off' : 'eye'}`);
});

const ROTULOS_FORCA = ['Use 8 ou mais caracteres', 'Muito fraca', 'Média', 'Boa', 'Forte'];
function avaliarSenha(senha) {
    if (!senha) return 0;
    if (senha.length < 6) return 1;
    let pontos = 0;
    if (senha.length >= 8) pontos++;
    if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pontos++;
    if (/\d/.test(senha)) pontos++;
    if (/[^A-Za-z0-9]/.test(senha)) pontos++;
    return Math.max(1, Math.min(4, pontos));
}
$('senha-nova').addEventListener('input', (evento) => {
    const nivel = avaliarSenha(evento.target.value);
    $('senha-forca').dataset.nivel = String(nivel);
    $('senha-forca-texto').textContent = nivel === 0 ? ROTULOS_FORCA[0] : `Senha ${ROTULOS_FORCA[nivel].toLowerCase()}`;
});

// ==========================================================
// PAINEL: PERÍODO, INDICADORES E GRÁFICOS
// ==========================================================
const SELO_EXEMPLO = { texto: 'Exemplo', classe: 'cf-badge-neutral' };
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const PERIODOS_VALIDOS = ['1', '3', '6', '12', 'tudo'];
const numeroCompacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

{
    const salvo = armazenamento.ler('amtech-periodo');
    if (PERIODOS_VALIDOS.includes(salvo)) periodoPainel = salvo;
}

const corToken = (nome) => getComputedStyle(raizDoc).getPropertyValue(nome).trim();
const rotuloMes = (chave) => `${MESES_CURTOS[Number(chave.slice(5, 7)) - 1]}/${chave.slice(2, 4)}`;

// Meses em "AAAA-MM" são comparáveis como texto
function somarMeses(chave, quantidade) {
    const [ano, mes] = chave.split('-').map(Number);
    const total = ano * 12 + (mes - 1) + quantidade;
    return `${Math.floor(total / 12)}-${String(total % 12 + 1).padStart(2, '0')}`;
}
function intervaloMeses(inicio, fim) {
    const lista = [];
    for (let mes = inicio; mes <= fim; mes = somarMeses(mes, 1)) lista.push(mes);
    return lista;
}

function totalizar(registros) {
    const total = { rec: 0, desp: 0, inv: 0 };
    registros.forEach(({ transacao, valor }) => {
        if (transacao.tipo === 'receita') total.rec += valor;
        else if (transacao.tipo === 'despesa') total.desp += valor;
        else total.inv += valor;
    });
    return total;
}

function registrosEntre(meses) {
    const inicio = `${meses[0]}-01`;
    const fim = `${meses[meses.length - 1]}-31`;
    return registrosLista.filter(({ transacao }) => transacao.data >= inicio && transacao.data <= fim);
}

// Dados do painel para o período escolhido e o anterior
function calcularPainel() {
    const mesAtual = dataLocalISO().slice(0, 7);
    let meses;
    if (periodoPainel === 'tudo') {
        const maisAntigo = registrosLista.reduce((min, { transacao }) => (transacao.data.slice(0, 7) < min ? transacao.data.slice(0, 7) : min), mesAtual);
        meses = intervaloMeses(maisAntigo, mesAtual);
    } else {
        meses = intervaloMeses(somarMeses(mesAtual, -(Number(periodoPainel) - 1)), mesAtual);
    }
    const quantidade = meses.length;
    const registros = registrosEntre(meses);
    // Sem lançamentos no período anterior, não há tendência
    const registrosAnteriores = periodoPainel === 'tudo' ? [] : registrosEntre(intervaloMeses(somarMeses(meses[0], -quantidade), somarMeses(meses[0], -1)));
    const anterior = registrosAnteriores.length ? totalizar(registrosAnteriores) : null;

    // Um mês: barra por dia; vários meses: barra por mês
    const diario = periodoPainel === '1';
    let rotulos;
    let indiceDe;
    if (diario) {
        const [ano, mes] = meses[0].split('-').map(Number);
        rotulos = Array.from({ length: new Date(ano, mes, 0).getDate() }, (_, i) => String(i + 1));
        indiceDe = (data) => Number(data.slice(8, 10)) - 1;
    } else {
        rotulos = meses.map(rotuloMes);
        indiceDe = (data) => meses.indexOf(data.slice(0, 7));
    }
    const rec = rotulos.map(() => 0); const desp = rotulos.map(() => 0); const inv = rotulos.map(() => 0);
    registros.forEach(({ transacao, valor }) => {
        const indice = indiceDe(transacao.data);
        if (transacao.tipo === 'receita') rec[indice] += valor;
        else if (transacao.tipo === 'despesa') desp[indice] += valor;
        else inv[indice] += valor;
    });

    // O saldo acumulado parte do que existia antes do período
    const antes = totalizar(registrosLista.filter(({ transacao }) => transacao.data < `${meses[0]}-01`));
    let corrente = antes.rec - antes.desp - antes.inv;
    const acumulado = rotulos.map((_, i) => { corrente += rec[i] - desp[i] - inv[i]; return corrente; });

    const texto = diario
        ? new Date(Number(meses[0].slice(0, 4)), Number(meses[0].slice(5, 7)) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        : `${rotuloMes(meses[0])} – ${rotuloMes(meses[quantidade - 1])}`.replace(/(^|– )([a-z])/g, (_, antes, letra) => antes + letra.toUpperCase());

    return { registros, atual: totalizar(registros), anterior, rotulos, rec, desp, inv, acumulado, texto, diario };
}

// ----- Indicadores -----
function definirTendencia(id, atual, anterior, tipo, comparador) {
    const elemento = $(id);
    elemento.className = 'cf-statcard-trend';
    if (anterior === null || (anterior === 0 && atual === 0)) { elemento.hidden = true; return; }
    elemento.hidden = false;
    if (anterior === 0) { elemento.textContent = 'Novo no período'; return; }

    const variacao = (atual - anterior) / anterior * 100;
    const sinal = variacao > 0 ? '+' : variacao < 0 ? MENOS : '';
    elemento.textContent = `${sinal}${Math.abs(variacao).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% vs. ${comparador}`;
    if (variacao === 0) return;
    // Despesa maior é alerta; receita e investimento maiores são positivos
    if (tipo === 'despesa') elemento.classList.add(variacao > 0 ? 'cf-statcard-trend-warn' : 'cf-statcard-trend-up');
    else if (variacao > 0) elemento.classList.add('cf-statcard-trend-up');
    else if (tipo === 'receita') elemento.classList.add('cf-statcard-trend-down');
}

function renderizarIndicadores(dados) {
    const { atual, anterior } = dados;
    const comparador = periodoPainel === '1' ? 'mês anterior' : 'período anterior';
    const textoPeriodo = periodoPainel === 'tudo' ? `${dados.texto} (todo o histórico)` : dados.texto;
    $('painel-periodo-texto').textContent = textoPeriodo.charAt(0).toUpperCase() + textoPeriodo.slice(1);
    $('resumo-receitas').textContent = formatBRL(atual.rec);
    $('resumo-despesas').textContent = formatBRL(atual.desp);
    $('resumo-investimentos').textContent = formatBRL(atual.inv);
    definirTendencia('tendencia-receitas', atual.rec, anterior?.rec ?? null, 'receita', comparador);
    definirTendencia('tendencia-despesas', atual.desp, anterior?.desp ?? null, 'despesa', comparador);
    definirTendencia('tendencia-investimentos', atual.inv, anterior?.inv ?? null, 'investimento', comparador);

    const poupanca = $('resumo-poupanca');
    if (atual.rec > 0) {
        const taxa = (atual.rec - atual.desp) / atual.rec * 100;
        poupanca.textContent = `${taxa < 0 ? MENOS : ''}${Math.abs(taxa).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
        poupanca.classList.toggle('is-negative', taxa < 0);
    } else {
        poupanca.textContent = '—';
        poupanca.classList.remove('is-negative');
    }
}

function renderizarRecentes() {
    const lista = $('lista-recentes');
    lista.replaceChildren();
    if (registrosLista.length === 0) { lista.appendChild(criarElemento('p', 'empty-state', 'Nenhum lançamento no momento.')); return; }
    registrosLista.slice(0, 5).forEach(({ transacao, tipo, valor }) => {
        lista.appendChild(criarLinha({
            ponto: tipo.ponto,
            titulo: transacao.descricao,
            meta: `${transacao.data.split('-').reverse().join('/')} · ${tipo.rotulo}`,
            badge: transacao.exemplo ? SELO_EXEMPLO : null,
            valor: formatBRLComSinal(valor, tipo.sinal),
            classeValor: tipo.classeValor
        }));
    });
}

// ----- Gráficos (Chart.js) -----
// Troca o canvas pelo aviso de vazio; devolve o contexto 2D quando há dados
function prepararGrafico(chave, canvasId, vazio) {
    const canvas = $(canvasId);
    const aviso = canvas.parentElement.querySelector('.chart-empty');
    aviso.dataset.padrao = aviso.dataset.padrao || aviso.textContent;
    graficos[chave]?.destroy();
    delete graficos[chave];

    const semBiblioteca = typeof Chart === 'undefined';
    aviso.textContent = semBiblioteca ? 'Gráficos indisponíveis sem conexão com a internet.' : aviso.dataset.padrao;
    const semDados = vazio || semBiblioteca;
    canvas.hidden = semDados;
    aviso.hidden = !semDados;
    return semDados ? null : canvas.getContext('2d');
}

function opcoesBase() {
    const tinta = corToken('--ink');
    Chart.defaults.font.family = corToken('--font-sans');
    Chart.defaults.color = corToken('--ink-muted');
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top', align: 'start', labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8, padding: 16, color: corToken('--ink-muted') } },
            tooltip: { backgroundColor: corToken('--surface-300'), titleColor: tinta, bodyColor: tinta, borderColor: corToken('--line'), borderWidth: 1, padding: 12, cornerRadius: 12, boxPadding: 4, usePointStyle: true }
        }
    };
}

function escalas(horizontal) {
    const valor = { grid: { color: corToken('--line') }, border: { display: false }, ticks: { color: corToken('--ink-muted'), callback: (v) => numeroCompacto.format(v) } };
    const categoria = { grid: { display: false }, border: { color: corToken('--line') }, ticks: { color: corToken('--ink-muted'), maxRotation: 0, autoSkip: true } };
    return horizontal ? { x: valor, y: categoria } : { x: categoria, y: valor };
}

function desenharFluxo(dados) {
    const contexto = prepararGrafico('fluxo', 'graficoFluxo', dados.registros.length === 0);
    if (!contexto) return;
    const base = opcoesBase();
    $('graficoFluxo').setAttribute('aria-label', `Fluxo do período ${dados.texto}: receitas ${formatBRL(dados.atual.rec)}, despesas ${formatBRL(dados.atual.desp)}, investimentos ${formatBRL(dados.atual.inv)}.`);
    graficos.fluxo = new Chart(contexto, {
        type: 'bar',
        data: {
            labels: dados.rotulos,
            datasets: [
                { type: 'bar', label: 'Receitas', data: dados.rec, backgroundColor: corToken(TIPOS.receita.corGrafico), borderRadius: 6, maxBarThickness: 26, order: 2 },
                { type: 'bar', label: 'Despesas', data: dados.desp, backgroundColor: corToken(TIPOS.despesa.corGrafico), borderRadius: 6, maxBarThickness: 26, order: 2 },
                { type: 'bar', label: 'Investimentos', data: dados.inv, backgroundColor: corToken(TIPOS.investimento.corGrafico), borderRadius: 6, maxBarThickness: 26, order: 2 },
                { type: 'line', label: 'Saldo acumulado', data: dados.acumulado, borderColor: corToken('--ink'), backgroundColor: corToken('--ink'), borderWidth: 2, tension: 0.3, pointRadius: dados.rotulos.length > 16 ? 0 : 3, pointHoverRadius: 5, order: 1 }
            ]
        },
        options: {
            ...base,
            interaction: { mode: 'index', intersect: false },
            scales: escalas(false),
            plugins: { ...base.plugins, tooltip: { ...base.plugins.tooltip, callbacks: { label: (item) => ` ${item.dataset.label}: ${formatBRLSaldo(item.parsed.y)}` } } }
        }
    });
}

function desenharDestino(dados) {
    const { rec, desp, inv } = dados.atual;
    const legenda = $('destino-legenda');
    legenda.replaceChildren();
    const contexto = prepararGrafico('destino', 'graficoDestino', rec <= 0);
    if (!contexto) return;

    const sobra = Math.max(0, rec - desp - inv);
    const fatias = [
        { rotulo: 'Despesas', valor: desp, cor: TIPOS.despesa.corGrafico, ponto: 'dot-despesa' },
        { rotulo: 'Investimentos', valor: inv, cor: TIPOS.investimento.corGrafico, ponto: 'dot-investimento' },
        { rotulo: 'Sobra', valor: sobra, cor: TIPOS.receita.corGrafico, ponto: 'dot-receita' }
    ];
    const base = fatias.reduce((soma, f) => soma + f.valor, 0);

    fatias.forEach((fatia) => {
        const item = criarElemento('li');
        item.append(
            criarElemento('span', `dot ${fatia.ponto}`),
            criarElemento('span', 'legenda-nome', fatia.rotulo),
            criarElemento('span', 'legenda-pct', `${Math.round(fatia.valor / base * 100)}%`),
            criarElemento('span', 'legenda-valor', formatBRL(fatia.valor))
        );
        legenda.appendChild(item);
    });
    if (desp + inv > rec) legenda.appendChild(criarElemento('li', 'legenda-aviso', 'Gastos e investimentos acima da receita do período.'));

    $('graficoDestino').setAttribute('aria-label', `Destino da receita: ${fatias.map(f => `${f.rotulo} ${Math.round(f.valor / base * 100)}%`).join(', ')}.`);
    const opcoes = opcoesBase();
    graficos.destino = new Chart(contexto, {
        type: 'doughnut',
        data: { labels: fatias.map(f => f.rotulo), datasets: [{ data: fatias.map(f => f.valor), backgroundColor: fatias.map(f => corToken(f.cor)), borderColor: corToken('--surface-200'), borderWidth: 2 }] },
        options: { ...opcoes, cutout: '70%', plugins: { ...opcoes.plugins, legend: { display: false }, tooltip: { ...opcoes.plugins.tooltip, callbacks: { label: (item) => ` ${item.label}: ${formatBRL(item.parsed)}` } } } }
    });
}

function desenharTopDespesas(dados) {
    const grupos = new Map();
    dados.registros.filter(({ transacao }) => transacao.tipo === 'despesa').forEach(({ transacao, valor }) => {
        const rotulo = transacao.descricao.trim();
        const chave = semAcento(rotulo);
        const grupo = grupos.get(chave) || { rotulo, total: 0 };
        grupo.total += valor;
        grupos.set(chave, grupo);
    });
    const top = [...grupos.values()].sort((a, b) => b.total - a.total).slice(0, 5);
    const contexto = prepararGrafico('top', 'graficoTop', top.length === 0);
    if (!contexto) return;

    $('graficoTop').setAttribute('aria-label', `Maiores despesas: ${top.map(t => `${t.rotulo} ${formatBRL(t.total)}`).join(', ')}.`);
    const opcoes = opcoesBase();
    graficos.top = new Chart(contexto, {
        type: 'bar',
        data: { labels: top.map(t => (t.rotulo.length > 22 ? `${t.rotulo.slice(0, 21)}…` : t.rotulo)), datasets: [{ label: 'Despesas', data: top.map(t => t.total), backgroundColor: corToken(TIPOS.despesa.corGrafico), borderRadius: 6, maxBarThickness: 22 }] },
        options: {
            ...opcoes,
            indexAxis: 'y',
            scales: escalas(true),
            plugins: { ...opcoes.plugins, legend: { display: false }, tooltip: { ...opcoes.plugins.tooltip, callbacks: { title: (itens) => top[itens[0].dataIndex].rotulo, label: (item) => ` ${formatBRL(item.parsed.x)}` } } }
        }
    });
}

function atualizarPainel() {
    const dados = calcularPainel();
    renderizarIndicadores(dados);
    renderizarRecentes();
    // Canvas oculto não tem tamanho: os gráficos são desenhados quando a tela aparece
    if ($('ecra-graficos').hidden) return;
    desenharFluxo(dados);
    desenharDestino(dados);
    desenharTopDespesas(dados);
}

function sincronizarPeriodoUI() {
    document.querySelectorAll('[data-periodo]').forEach(botao => botao.setAttribute('aria-pressed', String(botao.dataset.periodo === periodoPainel)));
}
sincronizarPeriodoUI();
document.querySelector('.seg-periodo').addEventListener('click', (evento) => {
    const botao = evento.target.closest('[data-periodo]');
    if (!botao || botao.dataset.periodo === periodoPainel) return;
    periodoPainel = botao.dataset.periodo;
    armazenamento.gravar('amtech-periodo', periodoPainel);
    sincronizarPeriodoUI();
    atualizarPainel();
});
$('btn-ver-todos').addEventListener('click', () => irParaAba('menu-consulta'));

// ==========================================================
// DADOS DE EXEMPLO
// ==========================================================
// Marcados com `exemplo: true`; podem ser removidos de uma vez sem afetar os reais.
const LOTE_ESCRITA = 400;

// 12 meses de lançamentos; os valores de cada mês são sempre os mesmos
function gerarLancamentosExemplo() {
    const hoje = new Date();
    const limite = dataLocalISO(hoje);
    const lista = [];
    for (let atras = 11; atras >= 0; atras--) {
        const base = new Date(hoje.getFullYear(), hoje.getMonth() - atras, 1);
        const ano = base.getFullYear(); const mes = base.getMonth();
        const ultimoDia = new Date(ano, mes + 1, 0).getDate();
        // Pseudoaleatório determinístico por mês e item
        const sorteio = (item, minimo, maximo) => {
            const x = Math.sin((ano * 12 + mes + 1) * 12.9898 + item * 78.233) * 43758.5453;
            return minimo + (x - Math.floor(x)) * (maximo - minimo);
        };
        const incluir = (dia, tipo, descricao, valor) => {
            const data = dataLocalISO(new Date(ano, mes, Math.min(dia, ultimoDia)));
            if (data > limite) return; // nada no futuro
            lista.push({ data, tipo, descricao, valor: Math.round(valor * 100) / 100 });
        };

        incluir(5, 'receita', 'Salário', 5800 + (11 - atras) * 40);
        if (atras % 3 === 1) incluir(20, 'receita', 'Trabalho extra', sorteio(1, 600, 1800));
        incluir(8, 'despesa', 'Aluguel', 1800);
        [[3, 2], [12, 3], [22, 4]].forEach(([dia, item]) => incluir(dia, 'despesa', 'Supermercado', sorteio(item, 250, 450)));
        incluir(10, 'despesa', 'Energia elétrica', sorteio(5, 130, 220));
        incluir(10, 'despesa', 'Internet', 129.9);
        incluir(15, 'despesa', 'Plano de saúde', 540);
        [[6, 6], [18, 7]].forEach(([dia, item]) => incluir(dia, 'despesa', 'Transporte', sorteio(item, 60, 120)));
        [[14, 8], [25, 9]].forEach(([dia, item]) => incluir(dia, 'despesa', 'Restaurante', sorteio(item, 50, 140)));
        incluir(21, 'despesa', 'Lazer', sorteio(10, 80, 300));
        if (atras % 4 === 2) incluir(16, 'despesa', 'Farmácia', sorteio(11, 40, 120));
        if (atras === 4) incluir(19, 'despesa', 'Viagem', 2100);
        incluir(11, 'investimento', 'Tesouro Selic', sorteio(12, 600, 1000));
        if (atras % 2 === 1) incluir(17, 'investimento', 'CDB', 500);
    }
    return lista;
}

async function gravarEmLotes(itens, operacao) {
    for (let i = 0; i < itens.length; i += LOTE_ESCRITA) {
        const lote = writeBatch(db);
        itens.slice(i, i + LOTE_ESCRITA).forEach(item => operacao(lote, item));
        await lote.commit();
    }
}

const idsExemplo = () => registrosLista.filter(({ transacao }) => transacao.exemplo).map(({ id }) => id);

function atualizarExemplos() {
    const quantidade = idsExemplo().length;
    $('exemplo-status').textContent = quantidade
        ? `${quantidade} ${quantidade === 1 ? 'lançamento de exemplo' : 'lançamentos de exemplo'} na conta.`
        : 'Nenhum lançamento de exemplo na conta.';
    $('btn-gerar-exemplo').disabled = quantidade > 0;
    $('btn-remover-exemplo').hidden = quantidade === 0;
    // Sem lançamentos, o painel oferece os dados de exemplo
    $('painel-vazio').hidden = registrosLista.length > 0;
}

async function gerarExemplos() {
    if (!usuarioAtual || idsExemplo().length) return;
    const itens = gerarLancamentosExemplo();
    if (!confirm(`Isso adiciona ${itens.length} lançamentos de exemplo, dos últimos 12 meses, à sua conta. Você poderá removê-los depois. Continuar?`)) return;

    const botoes = [$('btn-gerar-exemplo'), $('btn-exemplo-painel')];
    const rotulos = botoes.map(b => b.textContent);
    botoes.forEach(b => { b.disabled = true; b.textContent = 'Gerando…'; });
    try {
        await gravarEmLotes(itens, (lote, item) => lote.set(doc(transacoesRef), { ...item, userId: usuarioAtual.uid, exemplo: true }));
        mostrarNotificacao(`${itens.length} lançamentos de exemplo criados.`);
    } catch (erro) {
        mostrarNotificacao('Não foi possível criar os dados de exemplo. Verifique a conexão e as regras do Firestore.', 'erro');
    } finally {
        botoes.forEach((b, i) => { b.textContent = rotulos[i]; b.disabled = false; });
        atualizarExemplos();
    }
}

async function removerExemplos() {
    const ids = idsExemplo();
    if (!ids.length) return;
    if (!confirm(`Remover os ${ids.length} lançamentos de exemplo? Os seus lançamentos reais não serão afetados.`)) return;
    const botao = $('btn-remover-exemplo');
    botao.disabled = true; botao.textContent = 'Removendo…';
    try {
        await gravarEmLotes(ids, (lote, id) => lote.delete(doc(db, 'transacoes', id)));
        mostrarNotificacao('Dados de exemplo removidos.', 'info');
    } catch (erro) {
        mostrarNotificacao('Não foi possível remover os dados de exemplo.', 'erro');
    } finally {
        botao.disabled = false; botao.textContent = 'Remover dados de exemplo';
    }
}

$('btn-gerar-exemplo').addEventListener('click', gerarExemplos);
$('btn-exemplo-painel').addEventListener('click', gerarExemplos);
$('btn-remover-exemplo').addEventListener('click', removerExemplos);
$('btn-lancar-painel').addEventListener('click', () => irParaAba('menu-novo'));

// ==========================================================
// NAVEGAÇÃO
// ==========================================================
const abas = [
    { btn: 'menu-novo', div: 'ecra-novo-lancamento', eyebrow: 'Registro', tit: 'Novo lançamento', sub: 'Registre uma receita, despesa ou investimento' },
    { btn: 'menu-consulta', div: 'ecra-consulta', eyebrow: 'Histórico', tit: 'Lançamentos', sub: 'Seu histórico financeiro' },
    { btn: 'menu-graficos', div: 'ecra-graficos', eyebrow: 'Visão geral', tit: 'Painel', sub: 'Seus números do período, em gráficos' },
    { btn: 'menu-fechamento', div: 'ecra-fechamento', eyebrow: 'Mensal', tit: 'Fechamento', sub: 'Guarde o resultado de cada mês' },
    { btn: 'menu-conta', div: 'ecra-conta', eyebrow: 'Perfil', tit: 'Minha conta', sub: 'Dados do usuário, senha e aparência' },
    { btn: 'menu-ajuda', div: 'ecra-ajuda', eyebrow: 'Suporte', tit: 'Ajuda', sub: 'Como usar o AMTech Financeiro, tela por tela' }
];

function irParaAba(idBotao) {
    const aba = abas.find(a => a.btn === idBotao);
    if (!aba) return;
    abas.forEach(a => {
        $(a.div).hidden = true;
        const item = $(a.btn);
        item.classList.remove('active');
        item.removeAttribute('aria-current');
    });
    const tela = $(aba.div);
    tela.hidden = false;
    tela.classList.remove('entrando');
    void tela.offsetWidth; // reinicia a animação de entrada
    tela.classList.add('entrando');

    const botao = $(aba.btn);
    botao.classList.add('active');
    botao.setAttribute('aria-current', 'page');
    $('eyebrow-pagina').textContent = aba.eyebrow;
    $('titulo-pagina').textContent = aba.tit;
    $('subtitulo-pagina').textContent = aba.sub;
    $('conteudo-principal').scrollTo({ top: 0, behavior: 'instant' });
    window.scrollTo({ top: 0, behavior: 'instant' });

    if (aba.btn === 'menu-graficos') {
        atualizarPainel();
        atualizarDicasBot(somaReceitas, somaDespesas, somaInvestimentos, (somaReceitas - somaDespesas - somaInvestimentos));
    }
}
abas.forEach(aba => $(aba.btn).addEventListener('click', () => irParaAba(aba.btn)));
$('nav-user').addEventListener('click', () => irParaAba('menu-conta'));

// Menu recolhido (só ícones) no desktop; a escolha é salva
const btnRecolher = $('btn-recolher-menu');
function aplicarMenuRecolhido(recolhido, salvar) {
    raizDoc.classList.toggle('nav-recolhido', recolhido);
    btnRecolher.setAttribute('aria-expanded', String(!recolhido));
    btnRecolher.setAttribute('aria-label', recolhido ? 'Expandir menu lateral' : 'Recolher menu lateral');
    btnRecolher.title = recolhido ? 'Expandir menu' : 'Recolher menu';
    if (salvar) armazenamento.gravar('amtech-nav', recolhido ? 'recolhido' : 'expandido');
}
aplicarMenuRecolhido(raizDoc.classList.contains('nav-recolhido'), false);
btnRecolher.addEventListener('click', () => aplicarMenuRecolhido(!raizDoc.classList.contains('nav-recolhido'), true));

// Índice da ajuda: rolagem suave sem alterar a URL
document.querySelector('.ajuda-indice').addEventListener('click', (evento) => {
    const link = evento.target.closest('a[href^="#"]');
    if (!link) return;
    evento.preventDefault();
    $(link.getAttribute('href').slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ==========================================================
// MENU DO USUÁRIO
// ==========================================================
const btnUser = $('btn-user');
const popoverUser = $('user-popover');

function alternarMenuUsuario(abrir) {
    popoverUser.hidden = !abrir;
    btnUser.setAttribute('aria-expanded', String(abrir));
}
btnUser.addEventListener('click', () => alternarMenuUsuario(popoverUser.hidden));
document.addEventListener('click', (evento) => {
    if (!popoverUser.hidden && !evento.target.closest('.user-menu')) alternarMenuUsuario(false);
});
document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && !popoverUser.hidden) { alternarMenuUsuario(false); btnUser.focus(); }
});
popoverUser.addEventListener('focusout', (evento) => {
    if (evento.relatedTarget && !evento.relatedTarget.closest('.user-menu')) alternarMenuUsuario(false);
});

$('menu-ir-conta').addEventListener('click', () => { alternarMenuUsuario(false); irParaAba('menu-conta'); $('nome-exibicao').focus({ preventScroll: true }); });
$('menu-ir-senha').addEventListener('click', () => {
    alternarMenuUsuario(false);
    irParaAba('menu-conta');
    $('card-senha').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('senha-atual').focus({ preventScroll: true });
});

$('menu-ir-ajuda').addEventListener('click', () => { alternarMenuUsuario(false); irParaAba('menu-ajuda'); });

function sair() { return signOut(auth).then(() => { window.location.href = "login.html"; }); }
$('btn-sair').addEventListener('click', sair);
$('btn-sair-conta').addEventListener('click', sair);

// ==========================================================
// DADOS DO USUÁRIO, PERFIL E SENHA
// ==========================================================
const SEPARADORES_NOME = /[\s.\-_]+/;
const capitalizar = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();

function nomeDoUsuario(user) {
    const nome = (user.displayName || '').trim();
    if (nome) return nome;
    return (user.email || 'Usuário').split('@')[0].split(SEPARADORES_NOME).filter(Boolean).map(capitalizar).join(' ');
}
function iniciaisDoNome(nome) {
    const partes = nome.split(SEPARADORES_NOME).filter(Boolean);
    if (!partes.length) return '?';
    return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}
function formatarDataHora(texto, comHora) {
    const data = new Date(texto);
    if (!texto || Number.isNaN(data.getTime())) return '—';
    const opcoes = comHora ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: 'short', year: 'numeric' };
    return data.toLocaleDateString('pt-BR', opcoes);
}

function atualizarUsuarioUI() {
    if (!usuarioAtual) return;
    const nome = nomeDoUsuario(usuarioAtual);
    const email = usuarioAtual.email || '';
    $('saudacao-usuario').textContent = `Olá, ${nome.split(SEPARADORES_NOME)[0]}`;
    document.querySelectorAll('[data-user-nome]').forEach(el => { el.textContent = nome; });
    document.querySelectorAll('[data-user-email]').forEach(el => { el.textContent = email; });
    aplicarFotoNosAvatares();
    $('nav-user').setAttribute('aria-label', `Abrir minha conta (${nome})`);
    if (document.activeElement !== $('nome-exibicao')) $('nome-exibicao').value = nome;
    $('email-conta').value = email;
    $('usuario-oculto').value = email;
    $('conta-criada').textContent = formatarDataHora(usuarioAtual.metadata?.creationTime, false);
    $('conta-acesso').textContent = formatarDataHora(usuarioAtual.metadata?.lastSignInTime, true);
}

$('form-perfil').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const campo = $('nome-exibicao');
    const nome = campo.value.trim().replace(/\s+/g, ' ');
    limparErrosDo(evento.target);
    if (!aplicarErros(nome.length < 2 ? [[campo, 'Informe um nome com pelo menos 2 letras.']] : [])) return;
    if (nome === nomeDoUsuario(usuarioAtual)) { mostrarNotificacao('Nenhuma alteração para salvar.', 'info'); return; }

    const botao = $('btn-salvar-perfil');
    botao.disabled = true; botao.textContent = 'Salvando…';
    try {
        await updateProfile(usuarioAtual, { displayName: nome });
        atualizarUsuarioUI();
        mostrarNotificacao('Dados atualizados.');
    } catch (erro) {
        mostrarNotificacao('Não foi possível salvar seus dados. Tente novamente.', 'erro');
    } finally { botao.disabled = false; botao.textContent = 'Salvar dados'; }
});

const MENSAGENS_AUTH = {
    'auth/wrong-password': 'Senha atual incorreta.',
    'auth/invalid-credential': 'Senha atual incorreta.',
    'auth/weak-password': 'A nova senha é muito fraca. Use pelo menos 6 caracteres.',
    'auth/requires-recent-login': 'Por segurança, saia e entre novamente antes de trocar a senha.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
    'auth/network-request-failed': 'Sem conexão. Verifique a internet e tente de novo.'
};

$('form-senha').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const atual = $('senha-atual'); const nova = $('senha-nova'); const confirma = $('senha-confirma');
    limparErrosDo(evento.target);

    const erros = [];
    if (!atual.value) erros.push([atual, 'Informe a senha atual.']);
    if (nova.value.length < 6) erros.push([nova, 'A nova senha precisa ter pelo menos 6 caracteres.']);
    else if (nova.value === atual.value) erros.push([nova, 'A nova senha deve ser diferente da atual.']);
    if (!confirma.value) erros.push([confirma, 'Repita a nova senha.']);
    else if (confirma.value !== nova.value) erros.push([confirma, 'As senhas não conferem.']);
    if (!aplicarErros(erros)) return;

    const botao = $('btn-salvar-senha');
    botao.disabled = true; botao.textContent = 'Atualizando…';
    try {
        await reauthenticateWithCredential(usuarioAtual, EmailAuthProvider.credential(usuarioAtual.email, atual.value));
        await updatePassword(usuarioAtual, nova.value);
        evento.target.reset();
        $('senha-forca').dataset.nivel = '0';
        $('senha-forca-texto').textContent = ROTULOS_FORCA[0];
        mostrarNotificacao('Senha atualizada.');
    } catch (erro) {
        const mensagem = MENSAGENS_AUTH[erro.code] || 'Não foi possível atualizar a senha. Tente novamente.';
        if (erro.code === 'auth/wrong-password' || erro.code === 'auth/invalid-credential') aplicarErros([[atual, mensagem]]);
        else if (erro.code === 'auth/weak-password') aplicarErros([[nova, mensagem]]);
        else mostrarNotificacao(mensagem, 'erro');
    } finally { botao.disabled = false; botao.textContent = 'Atualizar senha'; }
});

$('btn-esqueci-senha').addEventListener('click', async () => {
    if (!usuarioAtual?.email) return;
    try {
        await sendPasswordResetEmail(auth, usuarioAtual.email);
        mostrarNotificacao(`Enviamos um link de redefinição para ${usuarioAtual.email}.`, 'info');
    } catch (erro) {
        mostrarNotificacao(MENSAGENS_AUTH[erro.code] || 'Não foi possível enviar o link. Tente novamente.', 'erro');
    }
});

// ----- Foto de perfil -----
// Recortada e comprimida no navegador (160 px, poucos KB); o original não é enviado.
const FOTO_LADO = 160;
const FOTO_ALVO_BYTES = 12 * 1024;
const FOTO_LIMITE_ENTRADA = 15 * 1024 * 1024;
const FOTO_VALIDA = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/;
const chaveFoto = (uid) => `amtech-foto-${uid}`;
const chaveFotoLocal = (uid) => `amtech-foto-local-${uid}`;

function aplicarFotoNosAvatares() {
    if (!usuarioAtual) return;
    const iniciais = iniciaisDoNome(nomeDoUsuario(usuarioAtual));
    document.querySelectorAll('[data-avatar]').forEach(el => {
        if (fotoAtual) {
            el.style.backgroundImage = `url("${fotoAtual}")`;
            el.classList.add('avatar-foto');
            el.textContent = '';
        } else {
            el.style.backgroundImage = '';
            el.classList.remove('avatar-foto');
            el.textContent = iniciais;
        }
    });
    $('btn-remover-foto').hidden = !fotoAtual;
    $('btn-escolher-foto').textContent = fotoAtual ? 'Trocar foto' : 'Adicionar foto';
}

function definirFoto(texto) {
    fotoAtual = texto && FOTO_VALIDA.test(texto) ? texto : null;
    aplicarFotoNosAvatares();
}

function formatarTamanho(bytes) {
    return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} KB`;
}

function carregarImagem(arquivo) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(arquivo);
        const imagem = new Image();
        imagem.onload = () => { URL.revokeObjectURL(url); resolve(imagem); };
        imagem.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagem ilegível')); };
        imagem.src = url;
    });
}
const canvasParaBlob = (canvas, tipo, qualidade) => new Promise(resolve => canvas.toBlob(resolve, tipo, qualidade));
const blobParaDataURL = (blob) => new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result);
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(blob);
});

async function comprimirFoto(arquivo) {
    const imagem = await carregarImagem(arquivo);
    const largura = imagem.naturalWidth; const altura = imagem.naturalHeight;
    const lado = Math.min(largura, altura);
    const canvas = document.createElement('canvas');
    canvas.width = FOTO_LADO; canvas.height = FOTO_LADO;
    const contexto = canvas.getContext('2d');
    contexto.imageSmoothingQuality = 'high';
    // Recorte central quadrado
    contexto.drawImage(imagem, (largura - lado) / 2, (altura - lado) / 2, lado, lado, 0, 0, FOTO_LADO, FOTO_LADO);

    // WebP; sem suporte para codificar, JPEG com fundo branco
    const tentativas = [['image/webp', [0.82, 0.7, 0.58, 0.45]], ['image/jpeg', [0.8, 0.65, 0.5, 0.4]]];
    for (const [tipo, qualidades] of tentativas) {
        if (tipo === 'image/jpeg') { contexto.globalCompositeOperation = 'destination-over'; contexto.fillStyle = '#fff'; contexto.fillRect(0, 0, FOTO_LADO, FOTO_LADO); }
        let menor = null;
        for (const qualidade of qualidades) {
            const blob = await canvasParaBlob(canvas, tipo, qualidade);
            if (!blob || blob.type !== tipo) break;
            menor = blob;
            if (blob.size <= FOTO_ALVO_BYTES) break;
        }
        if (menor) return menor;
    }
    throw new Error('sem codificador de imagem');
}

async function salvarFoto(dataUrl, bytes) {
    const uid = usuarioAtual.uid;
    definirFoto(dataUrl);
    armazenamento.gravar(chaveFoto(uid), dataUrl);
    try {
        await setDoc(doc(db, 'perfis', uid), { foto: dataUrl, atualizadoEm: new Date().toISOString() });
        armazenamento.remover(chaveFotoLocal(uid));
        mostrarNotificacao(`Foto atualizada (${formatarTamanho(bytes)}).`);
    } catch (erro) {
        armazenamento.gravar(chaveFotoLocal(uid), '1');
        mostrarNotificacao('Foto salva só neste dispositivo: o servidor não permitiu gravar o perfil.', 'info');
    }
}

async function removerFoto() {
    const uid = usuarioAtual.uid;
    definirFoto(null);
    armazenamento.remover(chaveFoto(uid));
    armazenamento.remover(chaveFotoLocal(uid));
    try { await deleteDoc(doc(db, 'perfis', uid)); } catch (erro) { /* sem perfil salvo no servidor */ }
    mostrarNotificacao('Foto removida.', 'info');
}

function escutarPerfil() {
    const uid = usuarioAtual.uid;
    definirFoto(armazenamento.ler(chaveFoto(uid))); // foto local até o servidor responder
    onSnapshot(doc(db, 'perfis', uid), (snapshot) => {
        if (snapshot.exists()) {
            const foto = snapshot.data().foto;
            definirFoto(foto);
            if (fotoAtual) armazenamento.gravar(chaveFoto(uid), fotoAtual);
        } else if (!snapshot.metadata?.fromCache && !armazenamento.ler(chaveFotoLocal(uid))) {
            definirFoto(null);
            armazenamento.remover(chaveFoto(uid));
        }
    }, () => { /* sem acesso ao perfil: mantém a foto local */ });
}

const inputFoto = $('input-foto');
const abrirSeletorDeFoto = () => inputFoto.click();
$('btn-escolher-foto').addEventListener('click', abrirSeletorDeFoto);
$('btn-foto-camera').addEventListener('click', abrirSeletorDeFoto);
$('btn-remover-foto').addEventListener('click', removerFoto);
inputFoto.addEventListener('change', async () => {
    const arquivo = inputFoto.files[0];
    inputFoto.value = '';
    if (!arquivo) return;
    if (!arquivo.type.startsWith('image/')) { mostrarNotificacao('Escolha um arquivo de imagem (JPG, PNG ou WebP).', 'erro'); return; }
    if (arquivo.size > FOTO_LIMITE_ENTRADA) { mostrarNotificacao('A imagem passa de 15 MB. Escolha uma menor.', 'erro'); return; }

    const botao = $('btn-escolher-foto');
    const rotulo = botao.textContent;
    botao.disabled = true; botao.textContent = 'Processando…';
    let blob;
    try { blob = await comprimirFoto(arquivo); }
    catch (erro) { mostrarNotificacao('Não foi possível ler essa imagem. Tente um arquivo JPG ou PNG.', 'erro'); botao.disabled = false; botao.textContent = rotulo; return; }
    try { await salvarFoto(await blobParaDataURL(blob), blob.size); }
    finally { botao.disabled = false; aplicarFotoNosAvatares(); }
});

// ==========================================================
// CONEXÃO COM BANCO DE DADOS
// ==========================================================
function definirSincronizacao(estado) {
    const rotulos = { online: 'Sincronizado', offline: 'Sem conexão', conectando: 'Conectando…' };
    $('sync-status').classList.toggle('is-online', estado === 'online');
    $('sync-texto').textContent = rotulos[estado];
}
window.addEventListener('offline', () => definirSincronizacao('offline'));
window.addEventListener('online', () => definirSincronizacao('conectando'));

onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioAtual = user;
        atualizarUsuarioUI();
        escutarPerfil();
        escutarBancoDeDados();
        escutarFechamentos();
    } else {
        window.location.href = "login.html";
    }
});

function aoFalharLeitura() {
    definirSincronizacao('offline');
    mostrarNotificacao('Não foi possível carregar seus dados.', 'erro');
}

function escutarBancoDeDados() {
    if (!usuarioAtual) return;
    onSnapshot(query(transacoesRef, where("userId", "==", usuarioAtual.uid)), (snapshot) => {
        somaReceitas = 0; somaDespesas = 0; somaInvestimentos = 0; todasTransacoesGlobais = [];
        const registros = [];

        snapshot.forEach((documento) => {
            const transacao = documento.data();
            const tipo = TIPOS[transacao.tipo];
            if(!transacao.data || transacao.valor === undefined || !tipo) return;

            const valor = parseFloat(transacao.valor);
            todasTransacoesGlobais.push(transacao);
            if(transacao.tipo === 'receita') somaReceitas += valor;
            else if(transacao.tipo === 'despesa') somaDespesas += valor;
            else somaInvestimentos += valor;
            registros.push({ id: documento.id, transacao, tipo, valor });
        });

        // Mais recentes primeiro
        registros.sort((a, b) => b.transacao.data.localeCompare(a.transacao.data));
        registrosLista = registros;
        renderizarLista();
        atualizarExemplos();
        $('conta-lancamentos').textContent = String(registros.length);
        const selo = $('nav-badge-consulta');
        selo.textContent = registros.length > 99 ? '99+' : String(registros.length);
        selo.hidden = registros.length === 0;

        const saldo = somaReceitas - somaDespesas - somaInvestimentos;
        const saldoEl = $('resumo-saldo');
        saldoEl.textContent = formatBRLSaldo(saldo);
        saldoEl.classList.toggle('is-negative', saldo < 0);

        atualizarPainel();
        if (!$('ecra-graficos').hidden) {
            atualizarDicasBot(somaReceitas, somaDespesas, somaInvestimentos, saldo);
        }
        definirSincronizacao('online');
    }, aoFalharLeitura);
}

// ===== Lista de lançamentos com busca e filtro por tipo =====
function renderizarLista() {
    const lista = $('lista-transacoes');
    const termo = semAcento(termoBusca.trim());
    const visiveis = registrosLista.filter(({ transacao }) =>
        (filtroTipo === 'todos' || transacao.tipo === filtroTipo) && (!termo || semAcento(transacao.descricao).includes(termo)));

    lista.replaceChildren();
    if (registrosLista.length === 0) lista.appendChild(criarElemento('p', 'empty-state', 'Nenhum lançamento no momento.'));
    else if (visiveis.length === 0) lista.appendChild(criarElemento('p', 'empty-state', 'Nenhum lançamento encontrado para esse filtro.'));

    visiveis.forEach(({ id, transacao, tipo, valor }) => {
        const acoes = criarElemento('div', 'txn-actions');
        acoes.appendChild(criarBotaoAcao('btn-editar', 'pencil', `Editar ${transacao.descricao}`, id));
        acoes.appendChild(criarBotaoAcao('btn-eliminar', 'trash-2', `Apagar ${transacao.descricao}`, id));

        lista.appendChild(criarLinha({
            ponto: tipo.ponto,
            titulo: transacao.descricao,
            meta: `${transacao.data.split('-').reverse().join('/')} · ${tipo.rotulo}`,
            badge: transacao.exemplo ? SELO_EXEMPLO : null,
            valor: formatBRLComSinal(valor, tipo.sinal),
            classeValor: tipo.classeValor,
            acoes
        }));
    });

    const plural = (n) => `${n} ${n === 1 ? 'lançamento' : 'lançamentos'}`;
    $('resumo-lista').textContent = visiveis.length === registrosLista.length ? plural(visiveis.length) : `${plural(visiveis.length)} de ${registrosLista.length}`;
}

$('busca').addEventListener('input', (evento) => { termoBusca = evento.target.value; renderizarLista(); });
document.querySelector('.filter-chips').addEventListener('click', (evento) => {
    const chip = evento.target.closest('.filter-chip');
    if (!chip) return;
    filtroTipo = chip.dataset.filtro;
    document.querySelectorAll('.filter-chip').forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
    renderizarLista();
});

function escutarFechamentos() {
    onSnapshot(query(fechamentosRef, where("userId", "==", usuarioAtual.uid)), (snapshot) => {
        const lista = $('lista-fechamentos');
        lista.replaceChildren();
        if(snapshot.empty) { lista.appendChild(criarElemento('p', 'empty-state', 'Nenhum histórico registrado.')); return; }

        let listaFechamentos = [];
        snapshot.forEach(doc => listaFechamentos.push(doc.data()));
        listaFechamentos.sort((a, b) => b.mesReferencia.localeCompare(a.mesReferencia));

        listaFechamentos.forEach((f) => {
            const saldo = f.saldoFinal;
            const situacao = saldo > 0 ? { texto: 'Positivo', classe: 'cf-badge-brand' }
                : saldo < 0 ? { texto: 'Negativo', classe: 'cf-badge-danger' }
                : { texto: 'Zerado', classe: 'cf-badge-neutral' };

            lista.appendChild(criarLinha({
                ponto: saldo < 0 ? 'dot-despesa' : 'dot-receita',
                titulo: `Referência ${f.mesReferencia.split('-').reverse().join('/')}`,
                meta: `Entrou ${formatBRLComSinal(f.totalReceitas, '+')} · Saiu ${formatBRLComSinal(f.totalDespesas, MENOS)}`,
                badge: situacao,
                valor: formatBRLSaldo(saldo),
                classeValor: saldo < 0 ? 'cf-txn-amount-danger' : 'cf-txn-amount-brand'
            }));
        });
    }, aoFalharLeitura);
}

// ==========================================================
// AMBOT (MENSAGENS DE SUGESTÃO COM DICAS DE INVESTIMENTO)
// ==========================================================
function atualizarDicasBot(receitas, despesas, investimentos, saldoLivre) {
    const textoBot = $('texto-dica-bot');
    if (!textoBot) return;

    if (receitas === 0 && despesas === 0 && (investimentos || 0) === 0) {
        textoBot.innerHTML = `<p>Nenhuma movimentação. Lance suas receitas e despesas para começar a análise.</p>`; return;
    }

    let mensagem = "";

    if (saldoLivre < 0) {
        mensagem += `<p>O saldo disponível está negativo em <strong>${formatBRL(saldoLivre)}</strong>.</p>
        <p><strong>Sugestão:</strong> revise os lançamentos recentes, corte gastos supérfluos e evite o cartão de crédito até equilibrar as contas.</p>`;
    }
    else if (saldoLivre > 0) {
        mensagem += `<p>Você tem <strong>${formatBRL(saldoLivre)}</strong> disponíveis. A poupança perde para a inflação; veja onde esse dinheiro pode render mais.</p>

        <p><strong>Renda fixa, mais segura que a poupança</strong></p>
        <ul>
            <li><strong>Tesouro Selic:</strong> ideal para a reserva de emergência. Rende todos os dias e permite sacar quando quiser sem perder dinheiro.</li>
            <li><strong>CDBs (100% do CDI ou mais):</strong> oferecidos por bancos como Nubank, Inter ou Sofisa. Têm a proteção do FGC e rendem quase o dobro da poupança.</li>
            <li><strong>LCIs e LCAs:</strong> isentas de Imposto de Renda, o que aumenta o lucro real.</li>
        </ul>

        <p><strong>Fundos imobiliários, para renda passiva</strong></p>
        <ul>
            <li><strong>KNCR11 (fundo de papel):</strong> dívidas imobiliárias atreladas aos juros. Mais conservador e costuma pagar dividendos consistentes.</li>
            <li><strong>BTLG11 (galpões logísticos):</strong> galpões alugados a grandes empresas.</li>
            <li><strong>TRXF11 (varejo):</strong> imóveis de varejo, como supermercados.</li>
        </ul>

        <p>Pesquise sempre antes de investir. O AMBot é uma ferramenta de apoio, não uma recomendação financeira.</p>`;
    }
    else {
        mensagem += `<p>As contas estão empatadas (saldo ${formatBRL(0)}): o que entrou, saiu. Atenção no próximo mês para não ficar no negativo.</p>`;
    }

    if (investimentos > 0) {
        mensagem += `<p class="ambot-note">Você já separou <strong>${formatBRL(investimentos)}</strong> para investimentos.</p>`;
    }

    textoBot.innerHTML = mensagem;
}

// ==========================================================
// FORMULÁRIO DE LANÇAMENTO
// ==========================================================
const formTransacao = $('form-transacao');
const badgeEdicao = $('badge-edicao');
const btnSalvarForm = $('btn-salvar-form');
const selectTipo = $('tipo');
const ROTULO_SALVAR = 'Salvar lançamento';

document.querySelectorAll('input[name="ui-tipo"]').forEach(radio => {
    radio.addEventListener('change', (e) => { selectTipo.value = e.target.value; });
});

function syncRadiosFromSelect() {
    const radioCorrespondente = document.querySelector(`input[name="ui-tipo"][value="${selectTipo.value || 'despesa'}"]`);
    if(radioCorrespondente) radioCorrespondente.checked = true;
}

document.querySelector('.quick-dates').addEventListener('click', (evento) => {
    const atalho = evento.target.closest('.mini-chip');
    if (!atalho) return;
    const data = new Date();
    data.setDate(data.getDate() - Number(atalho.dataset.dias));
    $('data').value = dataLocalISO(data);
    limparErro($('data'));
});

function sairDoModoEdicao() {
    idEdicaoAtual = null;
    badgeEdicao.hidden = true;
    btnSalvarForm.textContent = ROTULO_SALVAR;
}

function reiniciarFormulario() {
    formTransacao.reset(); setarDataAtualSegura(); sairDoModoEdicao(); limparErrosDo(formTransacao);
    selectTipo.value = 'despesa'; syncRadiosFromSelect();
    if (!$('ecra-novo-lancamento').hidden) $('titulo-pagina').textContent = abas[0].tit;
}

formTransacao.addEventListener('submit', async function(e) {
    e.preventDefault();
    if (btnSalvarForm.disabled) return;
    limparErrosDo(formTransacao);

    const campoValor = $('valor'); const campoData = $('data'); const campoDescricao = $('descricao');
    const valorInput = parseFloat(campoValor.value);
    const descricaoInput = campoDescricao.value.trim();
    const erros = [];
    if (!(valorInput > 0)) erros.push([campoValor, 'Informe um valor maior que zero.']);
    if (!campoData.value) erros.push([campoData, 'Informe a data do lançamento.']);
    if (!descricaoInput) erros.push([campoDescricao, 'Descreva o lançamento.']);
    if (!aplicarErros(erros)) return;

    btnSalvarForm.textContent = 'Salvando…'; btnSalvarForm.disabled = true;
    const dataInput = campoData.value;
    const tipoInput = selectTipo.value || 'despesa';

    try {
        if (idEdicaoAtual) {
            await updateDoc(doc(db, "transacoes", idEdicaoAtual), { data: dataInput, valor: valorInput, descricao: descricaoInput, tipo: tipoInput });
            mostrarNotificacao("Lançamento atualizado.");
        } else {
            await addDoc(transacoesRef, { data: dataInput, valor: valorInput, descricao: descricaoInput, tipo: tipoInput, userId: usuarioAtual.uid });
            mostrarNotificacao("Lançamento salvo.");
        }
        reiniciarFormulario();
    } catch (error) { mostrarNotificacao("Não foi possível salvar: " + error.message, "erro"); }
    finally { btnSalvarForm.disabled = false; btnSalvarForm.textContent = idEdicaoAtual ? 'Atualizar lançamento' : ROTULO_SALVAR; }
});

$('lista-transacoes').addEventListener('click', async (evento) => {
    const botaoApagar = evento.target.closest('.btn-eliminar');
    if (botaoApagar) {
        if(confirm("Deseja apagar esta transação?")) {
            try { await deleteDoc(doc(db, "transacoes", botaoApagar.dataset.id)); mostrarNotificacao("Lançamento apagado.", "info"); }
            catch (erro) { mostrarNotificacao("Não foi possível apagar o lançamento.", "erro"); }
        }
        return;
    }
    const botaoEditar = evento.target.closest('.btn-editar');
    if (botaoEditar) {
        const idT = botaoEditar.dataset.id;
        try {
            const docSnap = await getDoc(doc(db, "transacoes", idT));
            if (docSnap.exists()) {
                const dados = docSnap.data();
                limparErrosDo(formTransacao);
                $('data').value = dados.data || "";
                $('valor').value = dados.valor || "";
                $('descricao').value = dados.descricao || "";
                selectTipo.value = dados.tipo || ""; syncRadiosFromSelect();
                idEdicaoAtual = idT; irParaAba('menu-novo');
                $('titulo-pagina').textContent = "Editar lançamento";
                badgeEdicao.hidden = false;
                btnSalvarForm.textContent = 'Atualizar lançamento';
            }
        } catch (erro) { mostrarNotificacao("Não foi possível abrir o lançamento.", "erro"); }
    }
});

// ==========================================================
// FECHAMENTO MENSAL
// ==========================================================
const btnFazerFechamento = $('btn-fazer-fechamento');
btnFazerFechamento.addEventListener('click', async () => {
    const campoMes = $('mes-fechamento');
    limparErro(campoMes);
    const mesInput = campoMes.value;
    if (!aplicarErros(mesInput ? [] : [[campoMes, 'Selecione o mês de referência.']])) return;

    const tMes = todasTransacoesGlobais.filter(t => t.data.startsWith(mesInput));
    let cR = 0, cD = 0, cI = 0;
    tMes.forEach(t => { if(t.tipo === 'receita') cR+=parseFloat(t.valor); else if(t.tipo === 'despesa') cD+=parseFloat(t.valor); else if(t.tipo === 'investimento') cI+=parseFloat(t.valor); });

    btnFazerFechamento.textContent = 'Processando…'; btnFazerFechamento.disabled = true;
    try {
        await addDoc(fechamentosRef, { userId: usuarioAtual.uid, mesReferencia: mesInput, totalReceitas: cR, totalDespesas: cD, totalInvestimentos: cI, saldoFinal: (cR - cD - cI), dataRegistro: new Date().toISOString() });
        mostrarNotificacao("Fechamento salvo."); campoMes.value = '';
    } catch (error) { mostrarNotificacao("Não foi possível salvar o fechamento.", "erro"); }
    finally { btnFazerFechamento.disabled = false; btnFazerFechamento.textContent = 'Gravar fechamento'; }
});

$('btn-limpar').addEventListener('click', reiniciarFormulario);

appPronto = true;

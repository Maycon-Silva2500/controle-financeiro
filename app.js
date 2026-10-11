import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
let graficoInstancia = null;
let somaReceitas = 0; let somaDespesas = 0; let somaInvestimentos = 0; 
let todasTransacoesGlobais = []; 

// ==========================================================
// TEMA ESCURO / CLARO E DATA
// ==========================================================
const btnTheme = document.getElementById('btn-theme');
const iconeTema = btnTheme.querySelector('i');

const temaSalvo = localStorage.getItem('amtech-theme');
if (temaSalvo === 'dark' || (!temaSalvo && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.body.setAttribute('data-theme', 'dark');
    iconeTema.className = 'fa-solid fa-sun';
}

btnTheme.addEventListener('click', () => {
    if (document.body.getAttribute('data-theme') === 'dark') {
        document.body.removeAttribute('data-theme');
        localStorage.setItem('amtech-theme', 'light');
        iconeTema.className = 'fa-solid fa-moon';
    } else {
        document.body.setAttribute('data-theme', 'dark');
        localStorage.setItem('amtech-theme', 'dark');
        iconeTema.className = 'fa-solid fa-sun';
    }
});

function setarDataAtualSegura() {
    const dataInput = document.getElementById('data');
    if (dataInput) dataInput.value = new Date().toISOString().split('T')[0];
    const dataAtualSpan = document.getElementById('data-atual');
    if (dataAtualSpan) dataAtualSpan.innerHTML = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
setarDataAtualSegura();

// ==========================================================
// CHIPS E NOTIFICAÇÕES
// ==========================================================
const selectTipo = document.getElementById('tipo');
const radiosTipo = document.querySelectorAll('input[name="ui-tipo"]');

radiosTipo.forEach(radio => {
    radio.addEventListener('change', (e) => { if(selectTipo) selectTipo.value = e.target.value; });
});

function syncRadiosFromSelect() {
    if(!selectTipo) return;
    const radioCorrespondente = document.querySelector(`input[name="ui-tipo"][value="${selectTipo.value || 'despesa'}"]`);
    if(radioCorrespondente) radioCorrespondente.checked = true;
}

function mostrarNotificacao(mensagem, tipo = 'sucesso') {
    let container = document.getElementById('amtech-toast-container');
    if (!container) { container = document.createElement('div'); container.id = 'amtech-toast-container'; document.body.appendChild(container); }
    
    let corDestaque = '#10b981'; let iconeClass = 'fa-circle-check';
    if (tipo === 'info') { corDestaque = '#3b82f6'; iconeClass = 'fa-circle-info'; } 
    if (tipo === 'erro') { corDestaque = '#ef4444'; iconeClass = 'fa-circle-exclamation'; } 
    
    const toast = document.createElement('div'); toast.className = 'amtech-toast';
    toast.innerHTML = `<div style="background:${corDestaque}20; padding:10px; border-radius:12px; display:flex"><i class="fa-solid ${iconeClass}" style="color:${corDestaque}; font-size: 20px;"></i></div><span style="color: var(--text-main); font-weight: 600; font-size: 0.95rem;">${mensagem}</span>`;
    
    container.appendChild(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 3000);
}

// ==========================================================
// NAVEGAÇÃO
// ==========================================================
const abas = [
    { btn: 'menu-novo', div: 'ecra-novo-lancamento', tit: 'Novo Lançamento', sub: 'Registre uma transação' },
    { btn: 'menu-consulta', div: 'ecra-consulta', tit: 'Transações', sub: 'Seu histórico financeiro' },
    { btn: 'menu-graficos', div: 'ecra-graficos', tit: 'Visão Geral', sub: 'Análise do seu dinheiro' },
    { btn: 'menu-fechamento', div: 'ecra-fechamento', tit: 'Fechamento', sub: 'Gere relatórios mensais' }
];

abas.forEach(aba => {
    const botao = document.getElementById(aba.btn);
    if(botao) {
        botao.addEventListener('click', () => {
            abas.forEach(a => {
                document.getElementById(a.div).style.display = 'none';
                document.getElementById(a.btn).classList.remove('active');
            });
            document.getElementById(aba.div).style.display = 'block';
            botao.classList.add('active');
            document.getElementById('titulo-pagina').innerText = aba.tit;
            document.getElementById('subtitulo-pagina').innerText = aba.sub;
            
            if(aba.btn === 'menu-graficos') {
                if (typeof atualizarGraficos === 'function') atualizarGraficos(somaReceitas, somaDespesas, somaInvestimentos);
                if (typeof atualizarDicasBot === 'function') atualizarDicasBot(somaReceitas, somaDespesas, somaInvestimentos, (somaReceitas - somaDespesas - somaInvestimentos));
            }
        });
    }
});

// ==========================================================
// CONEXÃO COM BANCO DE DADOS & IDENTIFICAÇÃO DE NOME
// ==========================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioAtual = user;
        
        let nomeBruto = user.displayName || user.email.split('@')[0];
        let primeiroNome = nomeBruto.split(/[\.\-\_ ]/)[0]; 
        primeiroNome = primeiroNome.charAt(0).toUpperCase() + primeiroNome.slice(1);
        
        const saudacaoEl = document.getElementById('saudacao-usuario');
        if (saudacaoEl) saudacaoEl.innerText = `Olá, ${primeiroNome}!`;

        escutarBancoDeDados();
        if (typeof escutarFechamentos === 'function') escutarFechamentos(); 
    } else {
        window.location.href = "login.html";
    }
});

function escutarBancoDeDados() {
    if (!usuarioAtual) return;
    onSnapshot(query(transacoesRef, where("userId", "==", usuarioAtual.uid)), (snapshot) => {
        const corpoTabela = document.getElementById('corpo-tabela');
        if (!corpoTabela) return;

        corpoTabela.innerHTML = '';
        somaReceitas = 0; somaDespesas = 0; somaInvestimentos = 0; todasTransacoesGlobais = []; 

        if(snapshot.empty) corpoTabela.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhum lançamento no momento.</td></tr>';

        snapshot.forEach((documento) => {
            const transacao = documento.data(); const id = documento.id;
            if(!transacao.data || transacao.valor === undefined) return; 

            todasTransacoesGlobais.push(transacao);
            const dataFormatada = transacao.data.split('-').reverse().join('/');
            
            let corTexto = ''; let tipoF = '';
            if(transacao.tipo === 'receita') { corTexto = 'receita-texto'; tipoF = 'Receita'; somaReceitas += parseFloat(transacao.valor); } 
            else if(transacao.tipo === 'despesa') { corTexto = 'despesa-texto'; tipoF = 'Despesa'; somaDespesas += parseFloat(transacao.valor); } 
            else if(transacao.tipo === 'investimento') { corTexto = 'investimento-texto'; tipoF = 'Investimento'; somaInvestimentos += parseFloat(transacao.valor); }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${dataFormatada} • ${tipoF}</td>
                <td>${transacao.descricao}</td>
                <td class="${corTexto}">R$ ${parseFloat(transacao.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                <td>
                    <button class="btn-acao btn-editar" data-id="${id}"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-acao btn-eliminar" data-id="${id}"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            corpoTabela.appendChild(tr);
        });

        const formatBRL = (val) => `R$ ${val.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        document.getElementById('resumo-receitas').innerText = formatBRL(somaReceitas);
        document.getElementById('resumo-despesas').innerText = formatBRL(somaDespesas);
        document.getElementById('resumo-investimentos').innerText = formatBRL(somaInvestimentos);
        document.getElementById('resumo-saldo').innerText = formatBRL(somaReceitas - somaDespesas - somaInvestimentos);
    });
}

function escutarFechamentos() {
    onSnapshot(query(fechamentosRef, where("userId", "==", usuarioAtual.uid)), (snapshot) => {
        const corpoTabelaFechamentos = document.getElementById('corpo-tabela-fechamentos');
        if(!corpoTabelaFechamentos) return;
        corpoTabelaFechamentos.innerHTML = '';
        if(snapshot.empty) { corpoTabelaFechamentos.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhum histórico registado.</td></tr>'; return; }

        let listaFechamentos = [];
        snapshot.forEach(doc => listaFechamentos.push(doc.data()));
        listaFechamentos.sort((a, b) => b.mesReferencia.localeCompare(a.mesReferencia));

        listaFechamentos.forEach((f) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>Ref: ${f.mesReferencia.split('-').reverse().join('/')}</td>
                <td style="font-size:0.85rem">Entrou: R$ ${f.totalReceitas.toFixed(2)}<br>Saiu: R$ ${f.totalDespesas.toFixed(2)}</td>
                <td class="${f.saldoFinal >= 0 ? 'receita-texto' : 'despesa-texto'}">Saldo: R$ ${f.saldoFinal.toFixed(2)}</td>
            `;
            corpoTabelaFechamentos.appendChild(tr);
        });
    });
}

// ==========================================================
// CÉREBRO DO AMBOT (MENSAGENS DE SUGESTÃO COM DICAS DE INVESTIMENTO)
// ==========================================================
function atualizarDicasBot(receitas, despesas, investimentos, saldoLivre) {
    const textoBot = document.getElementById('texto-dica-bot');
    if (!textoBot) return;

    if (receitas === 0 && despesas === 0 && (investimentos || 0) === 0) {
        textoBot.innerHTML = `Nenhuma movimentação. Lance suas despesas e receitas para começarmos a análise!`; return;
    }

    let mensagem = "";

    if (saldoLivre < 0) {
        mensagem += `Ops! Vejo que o seu caixa livre está negativo em <strong>R$ ${Math.abs(saldoLivre).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>.<br><br>
        <strong>⚠️ Minha dica:</strong> Este é o momento de colocar o pé no freio. Revise os seus lançamentos recentes, corte gastos supérfluos e evite usar o cartão de crédito. Foco em equilibrar as contas para o próximo mês!`;
    } 
    else if (saldoLivre > 0) {
        const valorInvestir = saldoLivre * 0.6;
        const valorLazer = saldoLivre * 0.4;
        
        mensagem += `Excelente trabalho! Você tem um saldo livre de <strong>R$ ${saldoLivre.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>. A poupança perde para a inflação, então aqui estão algumas ideias de onde colocar esse dinheiro:<br><br>
        
        <strong style="color:var(--primary)"><i class="fa-solid fa-chart-line"></i> Opções de Renda Fixa (Mais seguras que a poupança):</strong><br>
        • <strong>Tesouro Selic:</strong> Ideal para a sua reserva de emergência. Rende todos os dias e pode sacar quando quiser sem perder dinheiro.<br>
        • <strong>CDBs (100% do CDI ou mais):</strong> Oferecidos por bancos como Nubank, Inter, ou Sofisa. Têm a mesma segurança da poupança (proteção do FGC) mas rendem quase o dobro.<br>
        • <strong>LCIs e LCAs:</strong> Ótimas opções porque são isentas de Imposto de Renda, o que aumenta o seu lucro real.<br><br>
        
        <strong style="color:var(--primary)"><i class="fa-solid fa-city"></i> Fundos Imobiliários (FIIs - Para gerar Renda Passiva):</strong><br>
        Se quer receber "aluguéis" na sua conta todos os meses sem precisar de comprar uma casa de 300 mil reais, os FIIs são a solução. Algumas boas opções do mercado incluem:<br>
        • <strong>KNCR11 (Fundo de Papel):</strong> Foca em dívidas imobiliárias atreladas aos juros. É mais conservador e costuma pagar dividendos consistentes.<br>
        • <strong>BTLG11 (Galpões Logísticos):</strong> Investe em enormes galpões alugados a empresas gigantes (como a Ambev ou o Mercado Livre).<br>
        • <strong>TRXF11 (Imóveis de Varejo):</strong> Dono de terrenos onde estão construídos supermercados famosos.<br><br>
        
        <em>* Lembre-se: O AMBot é uma inteligência de apoio. Pesquise sempre antes de investir o seu suado dinheiro!</em>`;
    } 
    else {
        mensagem += `As suas contas estão exatamente empatadas (Caixa R$ 0,00). O que entrou, saiu. Cuidado redobrado no próximo mês para não entrar no vermelho!`;
    }

    if (investimentos > 0) {
        mensagem += `<br><br><div style="background:var(--warning-light); padding:12px; border-radius:12px; border-left:4px solid var(--warning); margin-top:15px;">
        <span style="color:var(--text-main)"><i class="fa-solid fa-star" style="color:var(--warning)"></i> <strong>Visão de Futuro!</strong> O AMBot detectou que você já separou <strong>R$ ${investimentos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong> para Investimentos este mês. Parabéns por colocar o seu dinheiro a trabalhar para si!</span></div>`;
    }
    
    textoBot.innerHTML = mensagem;
}

// ==========================================================
// GRÁFICOS E FORMULÁRIO
// ==========================================================
function atualizarGraficos(receitas, despesas, investimentos) {
    const canvas = document.getElementById('meuGraficoCircular');
    if (!canvas || typeof Chart === 'undefined') return;
    if(graficoInstancia) graficoInstancia.destroy();
    
    graficoInstancia = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Receitas', 'Despesas', 'Investimentos'],
            datasets: [{ data: [receitas, despesas, investimentos || 0], backgroundColor: ['#10b981', '#ef4444', '#8b5cf6'], borderWidth: 0 }]
        },
        options: { cutout: '75%', plugins: { legend: { position: 'bottom', labels: {usePointStyle: true, color: '#6b7280'} } } }
    });
}

const formTransacao = document.getElementById('form-transacao');
if (formTransacao) {
    formTransacao.addEventListener('submit', async function(e) {
        e.preventDefault(); 
        const btnSalvarForm = document.getElementById('btn-salvar-form');
        if (btnSalvarForm && btnSalvarForm.disabled) return;
        if (btnSalvarForm) { btnSalvarForm.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A guardar...'; btnSalvarForm.disabled = true; }

        const dataInput = document.getElementById('data').value;
        const valorInput = parseFloat(document.getElementById('valor').value);
        const descricaoInput = document.getElementById('descricao').value;
        const tipoInput = document.getElementById('tipo').value || 'despesa';

        try {
            if (idEdicaoAtual) {
                await updateDoc(doc(db, "transacoes", idEdicaoAtual), { data: dataInput, valor: valorInput, descricao: descricaoInput, tipo: tipoInput });
                mostrarNotificacao("Atualizado com sucesso!");
            } else {
                await addDoc(transacoesRef, { data: dataInput, valor: valorInput, descricao: descricaoInput, tipo: tipoInput, userId: usuarioAtual.uid });
                mostrarNotificacao("Lançamento guardado!");
            }
            formTransacao.reset(); setarDataAtualSegura(); idEdicaoAtual = null;
            if(selectTipo) selectTipo.value = 'despesa'; syncRadiosFromSelect();
            document.getElementById('titulo-pagina').innerText = "Novo Lançamento";
        } catch (error) { mostrarNotificacao("Erro: " + error.message, "erro"); } 
        finally { if (btnSalvarForm) { btnSalvarForm.disabled = false; btnSalvarForm.innerHTML = 'Guardar Lançamento'; } }
    });
}

const corpoTabelaAction = document.getElementById('corpo-tabela');
if (corpoTabelaAction) {
    corpoTabelaAction.addEventListener('click', async (evento) => {
        if (evento.target.closest('.btn-eliminar')) {
            if(confirm("Deseja apagar esta transação?")) {
                try { await deleteDoc(doc(db, "transacoes", evento.target.closest('.btn-eliminar').getAttribute('data-id'))); mostrarNotificacao("Lançamento apagado.", "info"); } catch (erro) { }
            }
        }
        if (evento.target.closest('.btn-editar')) {
            const idT = evento.target.closest('.btn-editar').getAttribute('data-id');
            try {
                const docSnap = await getDoc(doc(db, "transacoes", idT));
                if (docSnap.exists()) {
                    const dados = docSnap.data();
                    document.getElementById('data').value = dados.data || "";
                    document.getElementById('valor').value = dados.valor || "";
                    document.getElementById('descricao').value = dados.descricao || "";
                    if (selectTipo) { selectTipo.value = dados.tipo || ""; syncRadiosFromSelect(); }
                    idEdicaoAtual = idT; document.getElementById('menu-novo').click(); 
                    document.getElementById('titulo-pagina').innerText = "Editar Transação";
                    document.getElementById('btn-salvar-form').innerHTML = 'Atualizar';
                }
            } catch (erro) {}
        }
    });
}

const btnFazerFechamento = document.getElementById('btn-fazer-fechamento');
if (btnFazerFechamento) {
    btnFazerFechamento.addEventListener('click', async () => {
        const mesInput = document.getElementById('mes-fechamento').value; 
        if (!mesInput) { mostrarNotificacao("Selecione um mês.", "erro"); return; }
        const tMes = todasTransacoesGlobais.filter(t => t.data.startsWith(mesInput));
        let cR = 0, cD = 0, cI = 0;
        tMes.forEach(t => { if(t.tipo === 'receita') cR+=parseFloat(t.valor); else if(t.tipo === 'despesa') cD+=parseFloat(t.valor); else if(t.tipo === 'investimento') cI+=parseFloat(t.valor); });

        btnFazerFechamento.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando...';
        try {
            await addDoc(fechamentosRef, { userId: usuarioAtual.uid, mesReferencia: mesInput, totalReceitas: cR, totalDespesas: cD, totalInvestimentos: cI, saldoFinal: (cR - cD - cI), dataRegistro: new Date().toISOString() });
            mostrarNotificacao("Fechamento salvo!"); document.getElementById('mes-fechamento').value = ''; 
        } catch (error) { mostrarNotificacao("Erro", "erro"); } 
        finally { btnFazerFechamento.innerHTML = 'Gravar Fechamento'; }
    });
}

const btnLimpar = document.getElementById('btn-limpar');
if (btnLimpar) btnLimpar.addEventListener('click', () => {
    if (formTransacao) formTransacao.reset(); setarDataAtualSegura(); idEdicaoAtual = null;
    if(selectTipo) selectTipo.value = 'despesa'; syncRadiosFromSelect();
    document.getElementById('titulo-pagina').innerText = "Novo Lançamento"; document.getElementById('btn-salvar-form').innerHTML = 'Guardar Lançamento';
});

const btnSair = document.getElementById('btn-sair');
if (btnSair) btnSair.addEventListener('click', () => signOut(auth).then(() => window.location.href = "login.html"));
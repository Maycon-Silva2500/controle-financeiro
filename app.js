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
let somaReceitas = 0;
let somaDespesas = 0;
let somaInvestimentos = 0; 
let todasTransacoesGlobais = []; 

function setarDataAtualSegura() {
    const dataInput = document.getElementById('data');
    if (dataInput) {
        const hoje = new Date();
        dataInput.value = hoje.toISOString().split('T')[0];
    }
    const dataAtualSpan = document.getElementById('data-atual');
    if (dataAtualSpan) {
        dataAtualSpan.innerHTML = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    }
}
setarDataAtualSegura();

// ==========================================================
// INTERAÇÃO VISUAL: CHIPS DE TIPO
// ==========================================================
// Mantemos o seu <select id="tipo"> atualizado nos bastidores
const selectTipo = document.getElementById('tipo');
const radiosTipo = document.querySelectorAll('input[name="ui-tipo"]');

radiosTipo.forEach(radio => {
    radio.addEventListener('change', (e) => {
        if(selectTipo) selectTipo.value = e.target.value;
    });
});

function syncRadiosFromSelect() {
    if(!selectTipo) return;
    const valor = selectTipo.value || 'despesa';
    const radioCorrespondente = document.querySelector(`input[name="ui-tipo"][value="${valor}"]`);
    if(radioCorrespondente) radioCorrespondente.checked = true;
}

// ==========================================================
// SISTEMA DE NOTIFICAÇÕES TOAST
// ==========================================================
function mostrarNotificacao(mensagem, tipo = 'sucesso') {
    try {
        let container = document.getElementById('amtech-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'amtech-toast-container';
            document.body.appendChild(container);
        }
        
        let corDestaque = '#10b981'; let iconeClass = 'fa-circle-check';
        if (tipo === 'info') { corDestaque = '#3b82f6'; iconeClass = 'fa-circle-info'; } 
        if (tipo === 'erro') { corDestaque = '#ef4444'; iconeClass = 'fa-circle-exclamation'; } 
        
        const toast = document.createElement('div');
        toast.className = 'amtech-toast';
        toast.innerHTML = `<div style="background:${corDestaque}20; padding:10px; border-radius:12px; display:flex"><i class="fa-solid ${iconeClass}" style="color:${corDestaque}; font-size: 20px;"></i></div><span style="color: #1f2937; font-weight: 600; font-size: 0.9rem;">${mensagem}</span>`;
        
        container.appendChild(toast);
        requestAnimationFrame(() => { requestAnimationFrame(() => { toast.classList.add('show'); }); });
        
        setTimeout(() => { 
            toast.classList.remove('show');
            setTimeout(() => { toast.remove(); }, 400); 
        }, 3000);
    } catch (err) { alert(mensagem); }
}

// ==========================================================
// NAVEGAÇÃO ENTRE TELAS (Bottom Nav)
// ==========================================================
const btnMenuNovo = document.getElementById('menu-novo');
const btnMenuConsulta = document.getElementById('menu-consulta');
const btnMenuGraficos = document.getElementById('menu-graficos');
const btnMenuFechamento = document.getElementById('menu-fechamento'); 

const ecraNovo = document.getElementById('ecra-novo-lancamento');
const ecraConsulta = document.getElementById('ecra-consulta');
const ecraGraficos = document.getElementById('ecra-graficos');
const ecraFechamento = document.getElementById('ecra-fechamento');

const tituloPagina = document.getElementById('titulo-pagina');
const subtituloPagina = document.getElementById('subtitulo-pagina');
const btnSalvarForm = document.getElementById('btn-salvar-form');
const btnLimpar = document.getElementById('btn-limpar');
const btnSair = document.getElementById('btn-sair');

function esconderTodosEcras() {
    if (ecraNovo) ecraNovo.style.display = 'none';
    if (ecraConsulta) ecraConsulta.style.display = 'none';
    if (ecraGraficos) ecraGraficos.style.display = 'none';
    if (ecraFechamento) ecraFechamento.style.display = 'none';
    
    [btnMenuNovo, btnMenuConsulta, btnMenuGraficos, btnMenuFechamento].forEach(btn => {
        if(btn) btn.classList.remove('active');
    });
}

if (btnMenuNovo) {
    btnMenuNovo.addEventListener('click', () => {
        esconderTodosEcras(); 
        if (ecraNovo) ecraNovo.style.display = 'block'; 
        btnMenuNovo.classList.add('active');
        if (tituloPagina) tituloPagina.innerText = "Novo Lançamento"; 
        if (subtituloPagina) subtituloPagina.innerText = "Registre uma transação";
    });
}

if (btnMenuConsulta) {
    btnMenuConsulta.addEventListener('click', () => {
        esconderTodosEcras(); 
        if (ecraConsulta) ecraConsulta.style.display = 'block'; 
        btnMenuConsulta.classList.add('active'); 
        if (tituloPagina) tituloPagina.innerText = "Transações"; 
        if (subtituloPagina) subtituloPagina.innerText = "Seu histórico financeiro";
    });
}

if (btnMenuGraficos) {
    btnMenuGraficos.addEventListener('click', () => {
        esconderTodosEcras(); 
        if (ecraGraficos) ecraGraficos.style.display = 'block'; 
        btnMenuGraficos.classList.add('active'); 
        if (tituloPagina) tituloPagina.innerText = "Visão Geral"; 
        if (subtituloPagina) subtituloPagina.innerText = "Análise do seu dinheiro";
        
        if (typeof atualizarGraficos === 'function') atualizarGraficos(somaReceitas, somaDespesas, somaInvestimentos);
        if (typeof atualizarDicasBot === 'function') atualizarDicasBot(somaReceitas, somaDespesas, somaInvestimentos, (somaReceitas - somaDespesas - somaInvestimentos));
    });
}

if (btnMenuFechamento) {
    btnMenuFechamento.addEventListener('click', () => {
        esconderTodosEcras(); 
        if (ecraFechamento) ecraFechamento.style.display = 'block'; 
        btnMenuFechamento.classList.add('active'); 
        if (tituloPagina) tituloPagina.innerText = "Fechamento"; 
        if (subtituloPagina) subtituloPagina.innerText = "Gere relatórios mensais";
    });
}

// ==========================================================
// CONEXÃO COM BANCO DE DADOS FIREBASE 
// ==========================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioAtual = user;
        escutarBancoDeDados();
        if (typeof escutarFechamentos === 'function') escutarFechamentos(); 
    } else {
        window.location.href = "login.html";
    }
});

function escutarBancoDeDados() {
    if (!usuarioAtual) return;
    const q = query(transacoesRef, where("userId", "==", usuarioAtual.uid));
    
    onSnapshot(q, (snapshot) => {
        const corpoTabela = document.getElementById('corpo-tabela');
        if (!corpoTabela) return;

        corpoTabela.innerHTML = '';
        somaReceitas = 0; somaDespesas = 0; somaInvestimentos = 0;
        todasTransacoesGlobais = []; 

        if(snapshot.empty) {
            corpoTabela.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhum lançamento no momento.</td></tr>';
        }

        snapshot.forEach((documento) => {
            const transacao = documento.data();
            const id = documento.id;
            if(!transacao.data || transacao.valor === undefined) return; 

            todasTransacoesGlobais.push(transacao);
            const dataFormatada = transacao.data.split('-').reverse().join('/');
            
            let corTexto = ''; let tipoFormatado = '';
            if(transacao.tipo === 'receita') { corTexto = 'receita-texto'; tipoFormatado = 'Receita'; somaReceitas += parseFloat(transacao.valor); } 
            else if(transacao.tipo === 'despesa') { corTexto = 'despesa-texto'; tipoFormatado = 'Despesa'; somaDespesas += parseFloat(transacao.valor); } 
            else if(transacao.tipo === 'investimento') { corTexto = 'investimento-texto'; tipoFormatado = 'Investimento'; somaInvestimentos += parseFloat(transacao.valor); }

            // Layout Mobile otimizado para a tabela (usando Flexbox no CSS)
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${dataFormatada} • ${tipoFormatado}</td>
                <td>${transacao.descricao}</td>
                <td class="${corTexto}">R$ ${parseFloat(transacao.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                <td>
                    <button class="btn-acao btn-editar" data-id="${id}"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-acao btn-eliminar" data-id="${id}"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            corpoTabela.appendChild(tr);
        });

        // Atualiza Cards
        const formatBRL = (val) => `R$ ${val.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        const elReceitas = document.getElementById('resumo-receitas');
        const elDespesas = document.getElementById('resumo-despesas');
        const elInvestimentos = document.getElementById('resumo-investimentos');
        const elSaldo = document.getElementById('resumo-saldo');

        if (elReceitas) elReceitas.innerText = formatBRL(somaReceitas);
        if (elDespesas) elDespesas.innerText = formatBRL(somaDespesas);
        if (elInvestimentos) elInvestimentos.innerText = formatBRL(somaInvestimentos);
        
        const saldoLivre = somaReceitas - somaDespesas - somaInvestimentos;
        if (elSaldo) {
            elSaldo.innerText = formatBRL(saldoLivre);
        }
    });
}

function escutarFechamentos() {
    const q = query(fechamentosRef, where("userId", "==", usuarioAtual.uid));
    onSnapshot(q, (snapshot) => {
        const corpoTabelaFechamentos = document.getElementById('corpo-tabela-fechamentos');
        if(!corpoTabelaFechamentos) return;
        corpoTabelaFechamentos.innerHTML = '';
        
        if(snapshot.empty) {
            corpoTabelaFechamentos.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhum histórico registado.</td></tr>';
            return;
        }

        let listaFechamentos = [];
        snapshot.forEach(doc => listaFechamentos.push(doc.data()));
        listaFechamentos.sort((a, b) => b.mesReferencia.localeCompare(a.mesReferencia));

        listaFechamentos.forEach((fechamento) => {
            const partes = fechamento.mesReferencia.split('-');
            const mesAnoExibicao = `${partes[1]}/${partes[0]}`; 
            const corSaldo = fechamento.saldoFinal >= 0 ? 'receita-texto' : 'despesa-texto';
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>Ref: ${mesAnoExibicao}</td>
                <td style="font-size:0.8rem">Entrou: R$ ${fechamento.totalReceitas.toFixed(2)}<br>Saiu: R$ ${fechamento.totalDespesas.toFixed(2)}</td>
                <td class="${corSaldo}">Saldo: R$ ${fechamento.saldoFinal.toFixed(2)}</td>
            `;
            corpoTabelaFechamentos.appendChild(tr);
        });
    });
}

// ==========================================================
// CÉREBRO DO AMBOT (MENSAGENS PROGRAMADAS)
// ==========================================================
function atualizarDicasBot(receitas, despesas, investimentos, saldoLivre) {
    const textoBot = document.getElementById('texto-dica-bot');
    if (!textoBot) return;

    if (receitas === 0 && despesas === 0 && (investimentos || 0) === 0) {
        textoBot.innerHTML = `Nenhuma movimentação. Lance suas despesas para começarmos!`; return;
    }

    let mensagem = "";
    if (saldoLivre < 0) {
        mensagem += `O seu caixa está negativo em <strong>R$ ${Math.abs(saldoLivre).toFixed(2)}</strong>. Evite gastos desnecessários.`;
    } else if (saldoLivre > 0) {
        mensagem += `Ótimo! Tem <strong>R$ ${saldoLivre.toFixed(2)}</strong> livres.<br><br>Considere a regra 60/40:<br>• R$ ${(saldoLivre * 0.6).toFixed(2)} p/ Investir (CDB/FIIs).<br>• R$ ${(saldoLivre * 0.4).toFixed(2)} p/ Lazer e Recompensas.`;
    } else {
        mensagem += `As suas contas estão empatadas a R$ 0,00. Atenção para não entrar no vermelho.`;
    }
    textoBot.innerHTML = mensagem;
}

// ==========================================================
// GRÁFICOS E EVENTOS DE FORMULÁRIO
// ==========================================================
function atualizarGraficos(receitas, despesas, investimentos) {
    const canvas = document.getElementById('meuGraficoCircular');
    if (!canvas || canvas.offsetParent === null || typeof Chart === 'undefined') return;
    const contexto = canvas.getContext('2d');
    if(graficoInstancia) graficoInstancia.destroy();
    
    graficoInstancia = new Chart(contexto, {
        type: 'doughnut',
        data: {
            labels: ['Receitas', 'Despesas', 'Investimentos'],
            datasets: [{ 
                data: [receitas, despesas, investimentos || 0], 
                backgroundColor: ['#10b981', '#ef4444', '#8b5cf6'], 
                borderWidth: 0, hoverOffset: 4
            }]
        },
        options: { cutout: '75%', plugins: { legend: { position: 'bottom', labels: {usePointStyle: true} } } }
    });
}

const formTransacao = document.getElementById('form-transacao');
if (formTransacao) {
    formTransacao.addEventListener('submit', async function(e) {
        e.preventDefault(); 
        if (btnSalvarForm && btnSalvarForm.disabled) return;
        if (btnSalvarForm) { btnSalvarForm.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A guardar...'; btnSalvarForm.disabled = true; }

        const dataInput = document.getElementById('data').value;
        const valorInput = parseFloat(document.getElementById('valor').value);
        const descricaoInput = document.getElementById('descricao').value;
        const tipoInput = document.getElementById('tipo').value || 'despesa'; // Fallback de segurança

        try {
            if (idEdicaoAtual) {
                await updateDoc(doc(db, "transacoes", idEdicaoAtual), { data: dataInput, valor: valorInput, descricao: descricaoInput, tipo: tipoInput });
                mostrarNotificacao("Atualizado com sucesso!");
            } else {
                await addDoc(transacoesRef, { data: dataInput, valor: valorInput, descricao: descricaoInput, tipo: tipoInput, userId: usuarioAtual.uid });
                mostrarNotificacao("Lançamento guardado!");
            }
            formTransacao.reset(); setarDataAtualSegura(); idEdicaoAtual = null;
            if(selectTipo) selectTipo.value = 'despesa'; // Reseta o invisivel
            syncRadiosFromSelect(); // Atualiza a UI visual
            if (tituloPagina) tituloPagina.innerText = "Novo Lançamento";
        } catch (error) { 
            mostrarNotificacao("Erro ao guardar: " + error.message, "erro");
        } finally {
            if (btnSalvarForm) { btnSalvarForm.disabled = false; btnSalvarForm.innerHTML = 'Guardar Lançamento'; }
        }
    });
}

const corpoTabelaAction = document.getElementById('corpo-tabela');
if (corpoTabelaAction) {
    corpoTabelaAction.addEventListener('click', async (evento) => {
        if (evento.target.closest('.btn-eliminar')) {
            const idTransacao = evento.target.closest('.btn-eliminar').getAttribute('data-id');
            if(confirm("Deseja apagar esta transação?")) {
                try { await deleteDoc(doc(db, "transacoes", idTransacao)); mostrarNotificacao("Lançamento apagado.", "info"); } catch (erro) { mostrarNotificacao("Erro ao apagar", "erro"); }
            }
        }
        
        if (evento.target.closest('.btn-editar')) {
            const idTransacao = evento.target.closest('.btn-editar').getAttribute('data-id');
            try {
                const docSnap = await getDoc(doc(db, "transacoes", idTransacao));
                if (docSnap.exists()) {
                    const dados = docSnap.data();
                    document.getElementById('data').value = dados.data || "";
                    document.getElementById('valor').value = dados.valor || "";
                    document.getElementById('descricao').value = dados.descricao || "";
                    
                    if (selectTipo) {
                        selectTipo.value = dados.tipo || "";
                        syncRadiosFromSelect(); // Sincroniza as pílulas visuais
                    }
                    
                    idEdicaoAtual = idTransacao;
                    document.getElementById('menu-novo').click(); // Navega para o form
                    if (tituloPagina) tituloPagina.innerText = "Editar Transação";
                    if (btnSalvarForm) btnSalvarForm.innerHTML = 'Atualizar';
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
        
        const transacoesDoMes = todasTransacoesGlobais.filter(t => t.data.startsWith(mesInput));
        let cReceitas = 0, cDespesas = 0, cInvest = 0;
        transacoesDoMes.forEach(t => {
            if(t.tipo === 'receita') cReceitas += parseFloat(t.valor);
            else if(t.tipo === 'despesa') cDespesas += parseFloat(t.valor);
            else if(t.tipo === 'investimento') cInvest += parseFloat(t.valor);
        });

        btnFazerFechamento.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando...';
        try {
            await addDoc(fechamentosRef, {
                userId: usuarioAtual.uid, mesReferencia: mesInput, totalReceitas: cReceitas, 
                totalDespesas: cDespesas, totalInvestimentos: cInvest, saldoFinal: (cReceitas - cDespesas - cInvest), 
                dataRegistro: new Date().toISOString()
            });
            mostrarNotificacao("Fechamento salvo!"); document.getElementById('mes-fechamento').value = ''; 
        } catch (error) { mostrarNotificacao("Erro", "erro"); } 
        finally { btnFazerFechamento.innerHTML = 'Gravar Fechamento'; }
    });
}

if (btnLimpar) btnLimpar.addEventListener('click', () => {
    if (formTransacao) formTransacao.reset(); setarDataAtualSegura(); idEdicaoAtual = null;
    if(selectTipo) selectTipo.value = 'despesa'; syncRadiosFromSelect();
    if (tituloPagina) tituloPagina.innerText = "Novo Lançamento";
    if (btnSalvarForm) btnSalvarForm.innerHTML = 'Guardar Lançamento';
});

if (btnSair) btnSair.addEventListener('click', () => signOut(auth).then(() => window.location.href = "login.html"));

// Configura PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}
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
        const ano = hoje.getFullYear();
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        const dia = String(hoje.getDate()).padStart(2, '0');
        dataInput.value = `${ano}-${mes}-${dia}`;
    }
}

const dataAtualSpan = document.getElementById('data-atual');
if (dataAtualSpan) {
    dataAtualSpan.innerHTML = `<i class="fa-regular fa-calendar"></i> ${new Date().toLocaleDateString('pt-BR')}`;
}
setarDataAtualSegura();

// ==========================================================
// SISTEMA DE NOTIFICAÇÕES (BLINDADO)
// ==========================================================
function mostrarNotificacao(mensagem, tipo = 'sucesso') {
    try {
        let container = document.getElementById('amtech-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'amtech-toast-container';
            document.body.appendChild(container);
        }
        
        let corDestaque = '#10b981'; 
        let iconeClass = 'fa-circle-check';
        
        if (tipo === 'info') { corDestaque = '#2cb3e5'; iconeClass = 'fa-circle-info'; } 
        if (tipo === 'erro') { corDestaque = '#ef4444'; iconeClass = 'fa-circle-exclamation'; } 
        
        const toast = document.createElement('div');
        toast.className = 'amtech-toast';
        toast.style.cssText = `
            background-color: #ffffff;
            min-width: 290px;
            padding: 16px 20px;
            border-radius: 6px;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
            display: flex;
            align-items: center;
            gap: 15px;
            transform: translateX(120%);
            opacity: 0;
            transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            pointer-events: auto;
            border-left: 6px solid ${corDestaque};
            margin-top: 10px;
        `;
        toast.innerHTML = `<i class="fa-solid ${iconeClass}" style="color: ${corDestaque}; font-size: 24px;"></i><span style="color: #444; font-weight: 500; font-size: 15px;">${mensagem}</span>`;
        
        container.appendChild(toast);
        
        requestAnimationFrame(() => { 
            requestAnimationFrame(() => { 
                toast.style.transform = 'translateX(0)';
                toast.style.opacity = '1';
            }); 
        });
        
        setTimeout(() => { 
            toast.style.transform = 'translateX(120%)';
            toast.style.opacity = '0';
            setTimeout(() => { toast.remove(); }, 400); 
        }, 3000);
    } catch (err) { alert(mensagem); }
}

// ==========================================================
// NAVEGAÇÃO ENTRE TELAS E PROTEÇÃO DAS ABAS
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
    
    if (btnMenuNovo) btnMenuNovo.classList.remove('active');
    if (btnMenuConsulta) btnMenuConsulta.classList.remove('active');
    if (btnMenuGraficos) btnMenuGraficos.classList.remove('active');
    if (btnMenuFechamento) btnMenuFechamento.classList.remove('active');
}

if (btnMenuNovo) {
    btnMenuNovo.addEventListener('click', () => {
        esconderTodosEcras(); 
        if (ecraNovo) ecraNovo.style.display = 'block'; 
        btnMenuNovo.classList.add('active');
        
        if (btnLimpar) btnLimpar.click(); 
        else resetarFormulario();

        if (tituloPagina) tituloPagina.innerText = "Novo Lançamento"; 
        if (subtituloPagina) subtituloPagina.innerText = "Registre uma nova transação financeira";
    });
}

if (btnMenuConsulta) {
    btnMenuConsulta.addEventListener('click', () => {
        esconderTodosEcras(); 
        if (ecraConsulta) ecraConsulta.style.display = 'block'; 
        btnMenuConsulta.classList.add('active'); 
        if (tituloPagina) tituloPagina.innerText = "Consulta / Edição"; 
        if (subtituloPagina) subtituloPagina.innerText = "Filtre, edite e elimine transações";
    });
}

if (btnMenuGraficos) {
    btnMenuGraficos.addEventListener('click', () => {
        esconderTodosEcras(); 
        if (ecraGraficos) ecraGraficos.style.display = 'block'; 
        btnMenuGraficos.classList.add('active'); 
        if (tituloPagina) tituloPagina.innerText = "Gráficos & Relatórios"; 
        if (subtituloPagina) subtituloPagina.innerText = "Visualize a saúde financeira e receba dicas";
        
        if (typeof atualizarGraficos === 'function') {
            atualizarGraficos(somaReceitas, somaDespesas, somaInvestimentos);
        }
        if (typeof atualizarDicasBot === 'function') {
            const saldoLivre = somaReceitas - somaDespesas - (somaInvestimentos || 0);
            atualizarDicasBot(somaReceitas, somaDespesas, somaInvestimentos, saldoLivre);
        }
    });
}

if (btnMenuFechamento) {
    btnMenuFechamento.addEventListener('click', () => {
        esconderTodosEcras(); 
        if (ecraFechamento) ecraFechamento.style.display = 'block'; 
        btnMenuFechamento.classList.add('active'); 
        if (tituloPagina) tituloPagina.innerText = "Fechamento Mensal"; 
        if (subtituloPagina) subtituloPagina.innerText = "Gere e guarde o histórico do seu caixa";
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
        somaReceitas = 0;
        somaDespesas = 0;
        somaInvestimentos = 0;
        todasTransacoesGlobais = []; 

        if(snapshot.empty) {
            corpoTabela.innerHTML = '<tr><td colspan="5" style="text-align: center;">Nenhuma transação registada ainda.</td></tr>';
        }

        snapshot.forEach((documento) => {
            const transacao = documento.data();
            const id = documento.id;
            
            if(!transacao.data || transacao.valor === undefined) return; 

            todasTransacoesGlobais.push(transacao);
            
            const dataFormatada = transacao.data.split('-').reverse().join('/');
            
            let corTexto = '';
            let tipoFormatado = '';
            
            if(transacao.tipo === 'receita') {
                corTexto = 'receita-texto';
                tipoFormatado = 'Receita';
                somaReceitas += parseFloat(transacao.valor);
            } else if(transacao.tipo === 'despesa') {
                corTexto = 'despesa-texto';
                tipoFormatado = 'Despesa';
                somaDespesas += parseFloat(transacao.valor);
            } else if(transacao.tipo === 'investimento') {
                corTexto = 'investimento-texto';
                tipoFormatado = 'Investimento';
                somaInvestimentos += parseFloat(transacao.valor);
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${dataFormatada}</td>
                <td>${transacao.descricao}</td>
                <td>${tipoFormatado}</td>
                <td class="${corTexto}">R$ ${parseFloat(transacao.valor).toFixed(2)}</td>
                <td>
                    <button class="btn-acao btn-editar" data-id="${id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-acao btn-eliminar" data-id="${id}" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            corpoTabela.appendChild(tr);
        });

        const elReceitas = document.getElementById('resumo-receitas');
        const elDespesas = document.getElementById('resumo-despesas');
        const elInvestimentos = document.getElementById('resumo-investimentos');
        const elSaldo = document.getElementById('resumo-saldo');

        if (elReceitas) elReceitas.innerText = `R$ ${somaReceitas.toFixed(2)}`;
        if (elDespesas) elDespesas.innerText = `R$ ${somaDespesas.toFixed(2)}`;
        if (elInvestimentos) elInvestimentos.innerText = `R$ ${somaInvestimentos.toFixed(2)}`;
        
        const saldoLivre = somaReceitas - somaDespesas - somaInvestimentos;
        if (elSaldo) {
            elSaldo.innerText = `R$ ${saldoLivre.toFixed(2)}`;
            elSaldo.style.color = saldoLivre >= 0 ? '#3b82f6' : '#ef4444';
        }
        
        if(ecraGraficos && ecraGraficos.style.display === 'block') {
             if (typeof atualizarGraficos === 'function') {
                atualizarGraficos(somaReceitas, somaDespesas, somaInvestimentos);
            }
            if (typeof atualizarDicasBot === 'function') {
                atualizarDicasBot(somaReceitas, somaDespesas, somaInvestimentos, saldoLivre);
            }
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
            corpoTabelaFechamentos.innerHTML = '<tr><td colspan="5" style="text-align: center;">Nenhum fechamento registado ainda.</td></tr>';
            return;
        }

        let listaFechamentos = [];
        snapshot.forEach(doc => listaFechamentos.push(doc.data()));
        listaFechamentos.sort((a, b) => b.mesReferencia.localeCompare(a.mesReferencia));

        listaFechamentos.forEach((fechamento) => {
            const partes = fechamento.mesReferencia.split('-');
            const mesAnoExibicao = `${partes[1]}/${partes[0]}`; 
            
            const valorInvestido = fechamento.totalInvestimentos || 0; 
            const corSaldo = fechamento.saldoFinal >= 0 ? 'receita-texto' : 'despesa-texto';
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: bold; color: var(--amtech-azul);">${mesAnoExibicao}</td>
                <td class="receita-texto">R$ ${fechamento.totalReceitas.toFixed(2)}</td>
                <td class="despesa-texto">R$ ${fechamento.totalDespesas.toFixed(2)}</td>
                <td class="investimento-texto">R$ ${valorInvestido.toFixed(2)}</td>
                <td class="${corSaldo}">R$ ${fechamento.saldoFinal.toFixed(2)}</td>
            `;
            corpoTabelaFechamentos.appendChild(tr);
        });
    });
}

// ==========================================================
// CÉREBRO DO AMBOT (MENSAGENS PROGRAMADAS COM DICAS REAIS DE INVESTIMENTO)
// ==========================================================
function atualizarDicasBot(receitas, despesas, investimentos, saldoLivre) {
    const textoBot = document.getElementById('texto-dica-bot');
    if (!textoBot) return;

    if (receitas === 0 && despesas === 0 && (investimentos || 0) === 0) {
        textoBot.innerHTML = `Olá! Parece que ainda não temos lançamentos para analisar. Registre suas vendas e gastos para eu poder te dar dicas de ouro!`; 
        return;
    }

    let mensagem = "";

    // Analisa a situação do caixa livre
    if (saldoLivre < 0) {
        mensagem += `Ops! Analisando seus números, vejo que seu caixa livre está negativo em <strong>R$ ${Math.abs(saldoLivre).toFixed(2)}</strong>.<br><br>
        <strong>Minha dica:</strong> Este é o momento de segurar as pontas. Revise o histórico, veja de onde o dinheiro está saindo e evite novos gastos desnecessários. Foco total em aumentar suas vendas e virar o jogo!`;
    } else if (saldoLivre > 0) {
        const proporcaoNegocio = saldoLivre * 0.60;
        const proporcaoLazer = saldoLivre * 0.40;
        
        mensagem += `Excelente trabalho! Você está no verde e sobrou <strong>R$ ${saldoLivre.toFixed(2)}</strong> na sua conta.<br><br>
        Sua estratégia com esse dinheiro solto pode ser:<br>
        <i class="fa-solid fa-money-bill-trend-up" style="color: #10b981;"></i> <strong>Crescimento / Investimento (60% = R$ ${proporcaoNegocio.toFixed(2)}):</strong><br>
        A poupança perde para a inflação. Considere investir em:<br>
        - <strong>Renda Fixa:</strong> Opções como CDBs atrelados ao CDI, Tesouro Selic, LCIs e LCAs rendem mais que a poupança e são muito seguros.<br>
        - <strong>Fundos Imobiliários (FIIs):</strong> Para gerar renda passiva (aluguel na conta todo mês), fundos como o KNCR11 (focado em juros) e o TRXF11 (focado em imóveis de varejo) são grandes destaques do mercado imobiliário em 2026.<br><br>
        <i class="fa-solid fa-umbrella-beach" style="color: #8b5cf6;"></i> <strong>Lazer (40% = R$ ${proporcaoLazer.toFixed(2)}):</strong><br>
        Pague um jantar bacana, dê um upgrade no seu setup ou compre algo para você. Aproveite os frutos do seu trabalho!`;
    } else {
        mensagem += `Suas contas estão empatadas (Caixa R$ 0,00). O que entrou, saiu. Fique atento no próximo mês para não entrar no vermelho!`;
    }

    // O Robô dá parabéns se você já investiu
    if (investimentos > 0) {
        mensagem += `<div style="background: rgba(139, 92, 246, 0.1); padding: 10px; border-radius: 8px; border-left: 4px solid #8b5cf6; margin-top: 15px;">
            <i class="fa-solid fa-star" style="color: #8b5cf6;"></i> <strong>Visão de Futuro!</strong> Você já guardou/investiu <strong>R$ ${investimentos.toFixed(2)}</strong> este mês. Isso é inteligência financeira pura! Continue criando esse hábito.
        </div>`;
    } else if (saldoLivre > 0) {
        mensagem += `<div style="background: rgba(239, 68, 68, 0.1); padding: 10px; border-radius: 8px; border-left: 4px solid #ef4444; margin-top: 15px;">
            <i class="fa-solid fa-circle-exclamation" style="color: #ef4444;"></i> <strong>Atenção:</strong> Notei que você não fez nenhum "Investimento" ainda. Pegue uma parte desse caixa livre e comece a investir para o seu dinheiro trabalhar para você!
        </div>`;
    }

    textoBot.innerHTML = mensagem;
}

// ==========================================================
// GRÁFICOS (Chart.js)
// ==========================================================
function atualizarGraficos(receitas, despesas, investimentos) {
    const canvas = document.getElementById('meuGraficoCircular');
    if (!canvas || canvas.offsetParent === null) return;
    
    if (typeof Chart === 'undefined') {
        console.warn("Chart.js não carregado.");
        return;
    }

    const contexto = canvas.getContext('2d');
    if(graficoInstancia) graficoInstancia.destroy();
    
    const valInvestimentos = investimentos || 0;

    graficoInstancia = new Chart(contexto, {
        type: 'pie',
        data: {
            labels: ['Receitas', 'Despesas', 'Investimentos'],
            datasets: [{ 
                data: [receitas, despesas, valInvestimentos], 
                backgroundColor: ['#10b981', '#ef4444', '#8b5cf6'], 
                borderWidth: 2, 
                borderColor: '#ffffff' 
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
}

// ==========================================================
// ROTINAS DE INSERÇÃO, EDIÇÃO E FECHAMENTO
// ==========================================================
const formTransacao = document.getElementById('form-transacao');
const btnFazerFechamento = document.getElementById('btn-fazer-fechamento');

if (btnFazerFechamento) {
    btnFazerFechamento.addEventListener('click', async () => {
        const mesInput = document.getElementById('mes-fechamento').value; 
        if (!mesInput) { mostrarNotificacao("Selecione um mês para fechar.", "erro"); return; }

        const transacoesDoMes = todasTransacoesGlobais.filter(t => t.data.startsWith(mesInput));
        if (transacoesDoMes.length === 0) { mostrarNotificacao("Nenhum lançamento encontrado neste mês.", "info"); return; }

        let calcReceitas = 0; let calcDespesas = 0; let calcInvestimentos = 0;
        
        transacoesDoMes.forEach(t => {
            if(t.tipo === 'receita') calcReceitas += parseFloat(t.valor);
            else if(t.tipo === 'despesa') calcDespesas += parseFloat(t.valor);
            else if(t.tipo === 'investimento') calcInvestimentos += parseFloat(t.valor);
        });
        
        const calcSaldo = calcReceitas - calcDespesas - calcInvestimentos;
        
        btnFazerFechamento.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando...';
        btnFazerFechamento.disabled = true;

        try {
            await addDoc(fechamentosRef, {
                userId: usuarioAtual.uid, 
                mesReferencia: mesInput, 
                totalReceitas: calcReceitas, 
                totalDespesas: calcDespesas,
                totalInvestimentos: calcInvestimentos,
                saldoFinal: calcSaldo, 
                dataRegistro: new Date().toISOString()
            });
            mostrarNotificacao("Fechamento salvo com sucesso!", "sucesso");
            document.getElementById('mes-fechamento').value = ''; 
        } catch (error) { 
            mostrarNotificacao("Erro Firebase: " + error.message, "erro");
        } finally { 
            btnFazerFechamento.innerHTML = '<i class="fa-solid fa-box-archive"></i> Gravar Fechamento'; 
            btnFazerFechamento.disabled = false; 
        }
    });
}

if (formTransacao) {
    formTransacao.addEventListener('submit', async function(e) {
        e.preventDefault(); 
        
        if (!usuarioAtual) {
            mostrarNotificacao("Precisa de estar logado para salvar.", "erro");
            return;
        }

        if (btnSalvarForm && btnSalvarForm.disabled) return;
        
        if (btnSalvarForm) {
            btnSalvarForm.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
            btnSalvarForm.disabled = true;
        }

        const dataInput = document.getElementById('data').value;
        const valorInput = parseFloat(document.getElementById('valor').value);
        const descricaoInput = document.getElementById('descricao').value;
        const tipoInput = document.getElementById('tipo').value;

        try {
            if (idEdicaoAtual) {
                await updateDoc(doc(db, "transacoes", idEdicaoAtual), { 
                    data: dataInput, valor: valorInput, descricao: descricaoInput, tipo: tipoInput 
                });
                mostrarNotificacao("Lançamento atualizado com sucesso!", "sucesso");
            } else {
                await addDoc(transacoesRef, { 
                    data: dataInput, valor: valorInput, descricao: descricaoInput, tipo: tipoInput, userId: usuarioAtual.uid 
                });
                mostrarNotificacao("Novo lançamento guardado com sucesso!", "sucesso");
            }
            
            formTransacao.reset();
            setarDataAtualSegura(); 
            idEdicaoAtual = null;
            if (tituloPagina) tituloPagina.innerText = "Novo Lançamento";
            if (subtituloPagina) subtituloPagina.innerText = "Registre uma nova transação financeira";

        } catch (error) { 
            console.error("ERRO FIREBASE DETECTADO:", error);
            mostrarNotificacao("Atenção! Erro ao guardar: " + error.message, "erro");
        } finally {
            if (btnSalvarForm) {
                btnSalvarForm.disabled = false;
                btnSalvarForm.innerHTML = '<i class="fa-solid fa-check"></i> Guardar Lançamento';
            }
        }
    });
}

// Botões de Ação na Tabela (Editar / Excluir)
const corpoTabelaAction = document.getElementById('corpo-tabela');
if (corpoTabelaAction) {
    corpoTabelaAction.addEventListener('click', async (evento) => {
        if (evento.target.closest('.btn-eliminar')) {
            const botao = evento.target.closest('.btn-eliminar');
            const idTransacao = botao.getAttribute('data-id');
            if(confirm("Tem certeza que deseja excluir esta transação?")) {
                try { 
                    await deleteDoc(doc(db, "transacoes", idTransacao)); 
                    mostrarNotificacao("Lançamento apagado.", "info");
                } catch (erro) { 
                    mostrarNotificacao("Erro ao apagar: " + erro.message, "erro");
                }
            }
        }
        
        if (evento.target.closest('.btn-editar')) {
            const botao = evento.target.closest('.btn-editar');
            const idTransacao = botao.getAttribute('data-id');
            try {
                const docSnap = await getDoc(doc(db, "transacoes", idTransacao));
                if (docSnap.exists()) {
                    const dados = docSnap.data();
                    
                    const elData = document.getElementById('data');
                    const elValor = document.getElementById('valor');
                    const elDescricao = document.getElementById('descricao');
                    const elTipo = document.getElementById('tipo');

                    if (elData) elData.value = dados.data || "";
                    if (elValor) elValor.value = dados.valor || "";
                    if (elDescricao) elDescricao.value = dados.descricao || "";
                    if (elTipo) elTipo.value = dados.tipo || "";
                    
                    idEdicaoAtual = idTransacao;
                    
                    esconderTodosEcras();
                    if (ecraNovo) ecraNovo.style.display = 'block';
                    if (btnMenuNovo) btnMenuNovo.classList.add('active');
                    if (tituloPagina) tituloPagina.innerText = "Editar Lançamento";
                    if (subtituloPagina) subtituloPagina.innerText = "Atualize os dados da sua transação";
                    if (btnSalvarForm) btnSalvarForm.innerHTML = '<i class="fa-solid fa-pen"></i> Atualizar Transação';
                    
                    mostrarNotificacao("Pronto para editar.", "info");
                }
            } catch (erro) { console.error(erro); }
        }
    });
}

function resetarFormulario() {
    if (formTransacao) formTransacao.reset();
    setarDataAtualSegura(); 
    idEdicaoAtual = null;
    if (tituloPagina) tituloPagina.innerText = "Novo Lançamento";
    if (subtituloPagina) subtituloPagina.innerText = "Registre uma nova transação financeira";
    if (btnSalvarForm) {
        btnSalvarForm.disabled = false;
        btnSalvarForm.innerHTML = '<i class="fa-solid fa-check"></i> Guardar Lançamento';
    }
}

if (btnLimpar) btnLimpar.addEventListener('click', resetarFormulario);
if (btnSair) {
    btnSair.addEventListener('click', () => { 
        signOut(auth).then(() => { window.location.href = "login.html"; }); 
    });
}
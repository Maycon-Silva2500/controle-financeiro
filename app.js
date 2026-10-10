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
let somaInvestimentos = 0; // NOVA VARIÁVEL GLOBAL
let todasTransacoesGlobais = []; 

// Função segura para inserir a data sem falhas
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

document.getElementById('data-atual').innerHTML = `<i class="fa-regular fa-calendar"></i> ${new Date().toLocaleDateString('pt-BR')}`;
setarDataAtualSegura();

// ==========================================================
// SISTEMA DE NOTIFICAÇÕES
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
        toast.style.borderLeft = `6px solid ${corDestaque}`;
        toast.innerHTML = `<i class="fa-solid ${iconeClass}" style="color: ${corDestaque}; font-size: 24px;"></i><span style="color: #444; font-weight: 500; font-size: 15px;">${mensagem}</span>`;
        
        container.appendChild(toast);
        
        requestAnimationFrame(() => { 
            requestAnimationFrame(() => { toast.classList.add('show'); }); 
        });
        
        setTimeout(() => { 
            toast.classList.remove('show'); 
            setTimeout(() => { toast.remove(); }, 400); 
        }, 3000);
    } catch (err) { alert(mensagem); }
}

// ==========================================================
// NAVEGAÇÃO ENTRE TELAS
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

function esconderTodosEcras() {
    ecraNovo.style.display = 'none';
    ecraConsulta.style.display = 'none';
    ecraGraficos.style.display = 'none';
    ecraFechamento.style.display = 'none';
    
    btnMenuNovo.classList.remove('active');
    btnMenuConsulta.classList.remove('active');
    btnMenuGraficos.classList.remove('active');
    btnMenuFechamento.classList.remove('active');
}

btnMenuNovo.addEventListener('click', () => {
    esconderTodosEcras(); 
    ecraNovo.style.display = 'block'; 
    btnMenuNovo.classList.add('active');
    document.getElementById('btn-limpar').click(); 
});

btnMenuConsulta.addEventListener('click', () => {
    esconderTodosEcras(); 
    ecraConsulta.style.display = 'block'; 
    btnMenuConsulta.classList.add('active'); 
    tituloPagina.innerText = "Consulta / Edição"; 
    subtituloPagina.innerText = "Filtre, edite e elimine transações";
});

btnMenuGraficos.addEventListener('click', () => {
    esconderTodosEcras(); 
    ecraGraficos.style.display = 'block'; 
    btnMenuGraficos.classList.add('active'); 
    tituloPagina.innerText = "Gráficos & Relatórios"; 
    subtituloPagina.innerText = "Visualize a saúde financeira e receba dicas";
    
    const saldoLivre = somaReceitas - somaDespesas - somaInvestimentos;
    atualizarGraficos(somaReceitas, somaDespesas, somaInvestimentos);
    atualizarDicasBot(somaReceitas, somaDespesas, somaInvestimentos, saldoLivre);
});

btnMenuFechamento.addEventListener('click', () => {
    esconderTodosEcras(); 
    ecraFechamento.style.display = 'block'; 
    btnMenuFechamento.classList.add('active'); 
    tituloPagina.innerText = "Fechamento Mensal"; 
    subtituloPagina.innerText = "Gere e guarde o histórico do seu caixa";
});

// ==========================================================
// CONEXÃO COM BANCO DE DADOS FIREBASE
// ==========================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioAtual = user;
        escutarBancoDeDados();
        escutarFechamentos(); 
    } else {
        window.location.href = "login.html";
    }
});

function escutarBancoDeDados() {
    const q = query(transacoesRef, where("userId", "==", usuarioAtual.uid));
    onSnapshot(q, (snapshot) => {
        const corpoTabela = document.getElementById('corpo-tabela');
        corpoTabela.innerHTML = '';
        
        somaReceitas = 0;
        somaDespesas = 0;
        somaInvestimentos = 0;
        todasTransacoesGlobais = []; 

        if(snapshot.empty) {
            corpoTabela.innerHTML = '<tr><td colspan="5" style="text-align: center;">Nenhuma transação registrada ainda.</td></tr>';
        }

        snapshot.forEach((documento) => {
            const transacao = documento.data();
            const id = documento.id;
            
            if(!transacao.data || transacao.valor === undefined) return; 

            todasTransacoesGlobais.push(transacao);
            
            const dataFormatada = transacao.data.split('-').reverse().join('/');
            
            let corTexto = '';
            let tipoFormatado = '';
            
            // Lógica de Cores e Soma para os 3 tipos
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

        // Atualizando os Cards Visuais
        document.getElementById('resumo-receitas').innerText = `R$ ${somaReceitas.toFixed(2)}`;
        document.getElementById('resumo-despesas').innerText = `R$ ${somaDespesas.toFixed(2)}`;
        document.getElementById('resumo-investimentos').innerText = `R$ ${somaInvestimentos.toFixed(2)}`;
        
        // Caixa Livre = Tudo que entrou - O que gastou - O que separou pra investir
        const saldoLivre = somaReceitas - somaDespesas - somaInvestimentos;
        document.getElementById('resumo-saldo').innerText = `R$ ${saldoLivre.toFixed(2)}`;
        document.getElementById('resumo-saldo').style.color = saldoLivre >= 0 ? '#3b82f6' : '#ef4444';
        
        if(ecraGraficos.style.display === 'block') {
            atualizarGraficos(somaReceitas, somaDespesas, somaInvestimentos);
            atualizarDicasBot(somaReceitas, somaDespesas, somaInvestimentos, saldoLivre);
        }
    });
}

function escutarFechamentos() {
    const q = query(fechamentosRef, where("userId", "==", usuarioAtual.uid));
    onSnapshot(q, (snapshot) => {
        const corpoTabelaFechamentos = document.getElementById('corpo-tabela-fechamentos');
        corpoTabelaFechamentos.innerHTML = '';
        
        if(snapshot.empty) {
            corpoTabelaFechamentos.innerHTML = '<tr><td colspan="5" style="text-align: center;">Nenhum fechamento registrado ainda.</td></tr>';
            return;
        }

        let listaFechamentos = [];
        snapshot.forEach(doc => listaFechamentos.push(doc.data()));
        listaFechamentos.sort((a, b) => b.mesReferencia.localeCompare(a.mesReferencia));

        listaFechamentos.forEach((fechamento) => {
            const partes = fechamento.mesReferencia.split('-');
            const mesAnoExibicao = `${partes[1]}/${partes[0]}`; 
            
            // Caso seja um fechamento antigo sem investimento
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
// CÉREBRO DO AMBOT (AGORA COM GOOGLE GEMINI IA - GRATUITO)
// ==========================================================

// ⚠️ ATENÇÃO: Cole sua chave do Google AI Studio aqui dentro das aspas:
const GEMINI_API_KEY = "AQ.Ab8RN6KmMmWsfNd0CaAAVX8O6FrpAkSMe1t3w1NIc8917Z28Nw"; 

async function atualizarDicasBot(receitas, despesas, investimentos, saldoLivre) {
    const textoBot = document.getElementById('texto-dica-bot');
    
    // Se não tiver dados, mostra a mensagem padrão e não gasta a API
    if (receitas === 0 && despesas === 0 && investimentos === 0) {
        textoBot.innerHTML = `Olá! Parece que ainda não temos lançamentos para analisar. Registre suas vendas e gastos para eu poder ligar minha Inteligência Artificial e te dar dicas de ouro!`; 
        return;
    }

    // Mostra que a IA está pensando...
    textoBot.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color: #3b82f6;"></i> O AMBot está analisando seu caixa com Inteligência Artificial. Aguarde um instante...`;

    // 1. Montamos a "ordem" que vamos dar para a Inteligência Artificial
    const promptParaIA = `
    Você é o AMBot, um conselheiro financeiro extremamente inteligente, direto ao ponto e encorajador. 
    Analise o fechamento financeiro deste mês do seu cliente. Não use formatação em markdown (asteriscos, hashtags), escreva em texto simples, mas você pode usar tags HTML básicas como <strong> e <br> para organizar as ideias. Seja conciso, dê uma resposta de no máximo 2 ou 3 parágrafos curtos.

    DADOS DO MÊS:
    - Receitas totais: R$ ${receitas.toFixed(2)}
    - Despesas totais: R$ ${despesas.toFixed(2)}
    - Total Investido: R$ ${investimentos.toFixed(2)}
    - Saldo Livre (O que sobrou no caixa): R$ ${saldoLivre.toFixed(2)}

    Com base nesses números exatos, faça uma análise da saúde financeira atual e dê uma dica prática e acionável do que ele deve fazer agora com esse saldo livre ou como melhorar a situação se estiver no vermelho.
    `;

    try {
        // 2. Fazemos a chamada para a API Gratuita do Gemini 1.5 Flash
        const resposta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptParaIA }] }]
            })
        });

        // 3. Lemos a resposta que a IA mandou de volta
        const dadosIA = await resposta.json();
        
        if (dadosIA.error) {
            throw new Error(dadosIA.error.message);
        }

        const conselhoDaIA = dadosIA.candidates[0].content.parts[0].text;
        
        // 4. Mostramos a resposta mágica na tela!
        textoBot.innerHTML = conselhoDaIA.replace(/\n/g, '<br>'); // Troca quebras de linha normais por quebras do HTML

    } catch (erro) {
        console.error("Erro na IA do Gemini:", erro);
        // Fallback: Se a internet cair ou a API falhar, ele mostra o texto padrão para não deixar a tela vazia
        textoBot.innerHTML = `Ops! Minha conexão neural falhou um instante. Mas a matemática não mente: seu saldo livre é de <strong>R$ ${saldoLivre.toFixed(2)}</strong>. Cuide bem desse valor!`;
    }
}

function atualizarGraficos(receitas, despesas, investimentos) {
    const canvas = document.getElementById('meuGraficoCircular');
    if (canvas.offsetParent === null) return;
    const contexto = canvas.getContext('2d');
    if(graficoInstancia) graficoInstancia.destroy();
    graficoInstancia = new Chart(contexto, {
        type: 'pie',
        data: {
            labels: ['Receitas', 'Despesas', 'Investimentos'],
            datasets: [{ 
                data: [receitas, despesas, investimentos], 
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
const btnSalvarForm = document.getElementById('btn-salvar-form');

// 1. Fechar Mês (Agora com Investimentos)
document.getElementById('btn-fazer-fechamento').addEventListener('click', async () => {
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
    
    const botaoFechar = document.getElementById('btn-fazer-fechamento');
    botaoFechar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando...';
    botaoFechar.disabled = true;

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
        botaoFechar.innerHTML = '<i class="fa-solid fa-box-archive"></i> Gravar Fechamento'; 
        botaoFechar.disabled = false; 
    }
});

// 2. Enviar Formulário
formTransacao.addEventListener('submit', async function(e) {
    e.preventDefault(); 
    
    if (btnSalvarForm.disabled) return;
    
    btnSalvarForm.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
    btnSalvarForm.disabled = true;

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
        tituloPagina.innerText = "Novo Lançamento";
        subtituloPagina.innerText = "Registre uma nova transação financeira";

    } catch (error) { 
        console.error("ERRO FIREBASE DETECTADO:", error);
        mostrarNotificacao("Atenção! Erro: " + error.message, "erro");
    } finally {
        btnSalvarForm.disabled = false;
        btnSalvarForm.innerHTML = '<i class="fa-solid fa-check"></i> Guardar Lançamento';
    }
});

// 3. Botões de Ação na Tabela (Editar / Excluir)
document.getElementById('corpo-tabela').addEventListener('click', async (evento) => {
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
                document.getElementById('data').value = dados.data || "";
                document.getElementById('valor').value = dados.valor || "";
                document.getElementById('descricao').value = dados.descricao || "";
                document.getElementById('tipo').value = dados.tipo || "";
                idEdicaoAtual = idTransacao;
                
                esconderTodosEcras();
                ecraNovo.style.display = 'block';
                btnMenuNovo.classList.add('active');
                tituloPagina.innerText = "Editar Lançamento";
                subtituloPagina.innerText = "Atualize os dados da sua transação";
                btnSalvarForm.innerHTML = '<i class="fa-solid fa-pen"></i> Atualizar Transação';
            }
        } catch (erro) { console.error(erro); }
    }
});

// 4. Botão Limpar Formulário
document.getElementById('btn-limpar').addEventListener('click', () => {
    formTransacao.reset();
    setarDataAtualSegura(); 
    idEdicaoAtual = null;
    tituloPagina.innerText = "Novo Lançamento";
    subtituloPagina.innerText = "Registre uma nova transação financeira";
    btnSalvarForm.disabled = false;
    btnSalvarForm.innerHTML = '<i class="fa-solid fa-check"></i> Guardar Lançamento';
});

// Sair do sistema
document.getElementById('btn-sair').addEventListener('click', () => { 
    signOut(auth).then(() => { window.location.href = "login.html"; }); 
});
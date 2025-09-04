/* INSTRUÇÃO: Apague todo o conteúdo do seu arquivo `src/taskpane/taskpane.js` e cole este código.
*/

// Importa o arquivo CSS para que o Webpack o inclua no pacote final.
import "./taskpane.css";

// --- INICIALIZAÇÃO DO SUPLEMENTO ---
Office.onReady(info => {
    initializeApp(info);
});

async function initializeApp(info) {
    try {
        // 1. CARREGAR A BASE DE CONHECIMENTO DO ARQUIVO EXTERNO
        // O Webpack irá servir o normativos.json a partir da mesma pasta.
        const response = await fetch('normativos.json');
        if (!response.ok) {
            throw new Error(`Erro HTTP! Status: ${response.status}`);
        }
        const baseDeNormativos = await response.json();
        console.log("Base de conhecimento (normativos.json) carregada com sucesso!");

        // 2. INICIAR A LÓGICA DO SUPLEMENTO APÓS O CARREGAMENTO
        if (info.host === Office.HostType.Word) {
            console.log("Modo Word: Suplemento carregado!");
            setupWordListeners(baseDeNormativos);
        } else {
            // Este modo é para a pré-visualização ou ambientes fora do Word.
            console.log("Modo Navegador (Simulação): Carregado!");
            setupBrowserSimulation(baseDeNormativos);
        }
    } catch (error) {
        console.error("Falha ao carregar ou processar 'normativos.json':", error);
        const appContainer = document.getElementById('app');
        appContainer.innerHTML = `
            <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md relative" role="alert">
                <strong class="font-bold">Erro Crítico!</strong>
                <span class="block sm:inline">Não foi possível carregar o arquivo 'normativos.json'. Verifique o console para mais detalhes.</span>
            </div>`;
    }
}

// --- LÓGICA PARA O MODO WORD ---
function setupWordListeners(baseDeNormativos) {
    const loadingMessage = document.getElementById('loading-message');
    const suggestionsContainer = document.getElementById('suggestions-container');
    Office.context.document.addHandlerAsync(Office.EventType.SelectionChanged, () => getWordContextAndCheck(loadingMessage, suggestionsContainer, baseDeNormativos));
    // Faz uma checagem inicial quando o suplemento carrega.
    getWordContextAndCheck(loadingMessage, suggestionsContainer, baseDeNormativos);
}

async function getWordContextAndCheck(loadingEl, containerEl, baseDeNormativos) {
    try {
        await Word.run(async (context) => {
            const paragraph = context.document.getSelection().paragraphs.getFirst();
            paragraph.load("text");
            await context.sync();
            const suggestions = encontrarSugestoes(paragraph.text, baseDeNormativos);
            updateSuggestionsUI(suggestions, loadingEl, containerEl, true);
        });
    } catch (error) {
        console.error("Erro ao interagir com o documento do Word:", error);
    }
}

// --- LÓGICA PARA O MODO DE SIMULAÇÃO (NAVEGADOR) ---
function setupBrowserSimulation(baseDeNormativos) {
    document.getElementById('browser-simulation-area').classList.remove('hidden');
    document.getElementById('subtitle').textContent = "Use a caixa abaixo para testar as sugestões.";
    
    const simulator = document.getElementById('text-simulator');
    const loadingMessage = document.getElementById('loading-message');
    const suggestionsContainer = document.getElementById('suggestions-container');

    simulator.addEventListener('input', () => {
        const suggestions = encontrarSugestoes(simulator.value, baseDeNormativos);
        updateSuggestionsUI(suggestions, loadingMessage, suggestionsContainer, false);
    });
    // Força uma verificação inicial para mostrar a UI corretamente
    updateSuggestionsUI([], loadingMessage, suggestionsContainer, false);
}

// --- MOTOR DE SUGESTÃO (NÍVEL 1) ---
function encontrarSugestoes(textoDoParagrafo, baseDeNormativos) {
  const sugestoesEncontradas = [];
  if (!textoDoParagrafo) return [];
  const textoMinusculo = textoDoParagrafo.toLowerCase();
  if (textoMinusculo.trim().length < 3) return [];

  for (const normativo of baseDeNormativos) {
    for (const palavraChave of normativo.palavrasChave) {
      if (textoMinusculo.includes(palavraChave.toLowerCase())) {
        if (!sugestoesEncontradas.some(s => s.id === normativo.id)) {
          sugestoesEncontradas.push(normativo);
        }
        break; 
      }
    }
  }
  return sugestoesEncontradas;
}

// --- ATUALIZAÇÃO DA INTERFACE ---
function updateSuggestionsUI(suggestions, loadingEl, containerEl, isWordMode) {
    containerEl.innerHTML = ''; 
    if (suggestions.length > 0) {
        loadingEl.style.display = 'none';
        suggestions.forEach(normativo => {
            const card = createSuggestionCard(normativo, isWordMode);
            containerEl.appendChild(card);
        });
    } else {
        loadingEl.style.display = 'block';
        loadingEl.textContent = "Nenhuma sugestão para o contexto atual.";
    }
}

function createSuggestionCard(normativo, isWordMode) {
    const card = document.createElement('div');
    card.className = "bg-white p-3 rounded-lg shadow-sm border border-gray-200 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all";
    card.innerHTML = `
        <p class="font-bold text-blue-700">${normativo.titulo}</p>
        <p class="text-sm text-gray-600 mt-1">${normativo.descricao}</p>
    `;
    card.onclick = () => {
        if (isWordMode) {
            insertNormativoTextIntoWord(normativo.texto);
        } else {
            alert(`Simulação: O texto abaixo seria inserido no Word:\n\n"${normativo.texto}"`);
        }
    };
    return card;
}

// --- AÇÃO DE INSERIR TEXTO (APENAS PARA O WORD) ---
async function insertNormativoTextIntoWord(textToInsert) {
    try {
        await Word.run(async (context) => {
            const selection = context.document.getSelection();
            selection.insertText(textToInsert + ' ', Word.InsertLocation.replace);
            await context.sync();
        });
    } catch (error) {
        console.error("Erro ao inserir texto no Word:", error);
    }
}

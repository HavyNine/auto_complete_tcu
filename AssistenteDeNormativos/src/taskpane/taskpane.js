/* global Word, Office, findSuggestionsWithIA */

// Array global para armazenar os normativos carregados
let normativos = [];

// --- FUNÇÃO DE CONTROLO PRINCIPAL ---
async function findSuggestions(text, apiKey) {
    showLoading("Analisando...");

    if (!text || text.trim().length < 10) {
        renderSuggestions([]);
        hideLoading("Texto selecionado é muito curto para análise.");
        return;
    }

    const metodo = document.getElementById('metodoBusca').value;

    if (metodo === 'ia') {
        try {
            console.log("-> Tentando busca com IA...");
            await findSuggestionsWithIA(text, apiKey, showLoading, hideLoading, renderSuggestions);
        } catch (error) {
            console.error("FALHA NA BUSCA COM IA! Ativando fallback para Palavra-Chave.", error);
            showLoading("Falha na IA. Usando busca por Palavra-Chave...");
            findSuggestionsWithKeywords(text);
        }
    } else {
        console.log("-> Buscando por Palavra-Chave...");
        findSuggestionsWithKeywords(text);
    }
}

// --- LÓGICAS DE BUSCA ---
// Lógica de busca por palavra-chave com sistema de pontuação para relevância.
function findSuggestionsWithKeywords(text) {
    const lowerCaseText = text.toLowerCase();
    console.log('Buscando por palavras-chave no texto:', `"${lowerCaseText.substring(0, 100)}..."`);

    const suggestionsWithScores = [];

    normativos.forEach(normativo => {
        if (!normativo.palavrasChave || !Array.isArray(normativo.palavrasChave)) {
            return; // Pula este normativo se não tiver palavras-chave válidas
        }

        let bestScoreForThisNormativo = 0;

        // Itera sobre cada frase-chave do normativo
        normativo.palavrasChave.forEach(keyword => {
            const lowerCaseKeyword = keyword.toLowerCase();
            // Evita keywords muito curtas e genéricas que podem causar falsos positivos
            if (lowerCaseKeyword.length < 4) return;

            const subKeywords = lowerCaseKeyword.split(' ').filter(k => k.length > 0);
            
            // Verifica se TODAS as palavras da frase-chave estão no texto do usuário
            const allSubKeywordsMatch = subKeywords.every(sub => lowerCaseText.includes(sub));
            
            if (allSubKeywordsMatch) {
                // A pontuação é o quadrado do comprimento da palavra-chave.
                // Isso dá um peso muito maior para correspondências mais longas e específicas.
                const score = Math.pow(lowerCaseKeyword.length, 2);
                
                // Se esta correspondência for melhor que a anterior para o mesmo normativo, atualiza a pontuação.
                if (score > bestScoreForThisNormativo) {
                    bestScoreForThisNormativo = score;
                }
            }
        });

        // Se o normativo teve alguma correspondência, adiciona à lista com sua melhor pontuação
        if (bestScoreForThisNormativo > 0) {
            suggestionsWithScores.push({ ...normativo, score: bestScoreForThisNormativo });
        }
    });

    // Ordena as sugestões pela pontuação, da maior para a menor
    suggestionsWithScores.sort((a, b) => b.score - a.score);

    // Pega apenas as 10 melhores sugestões para não poluir a interface
    const suggestions = suggestionsWithScores.slice(0, 10);

    console.log(`Encontradas ${suggestions.length} sugestões relevantes (de ${suggestionsWithScores.length} correspondências totais).`);
    renderSuggestions(suggestions);
    hideLoading();
}


// --- INTERAÇÃO COM O WORD ---
Office.onReady((info) => {
    if (info.host === Office.HostType.Word) {
        console.log("Suplemento pronto para uso no Word!");
        loadNormativos();

        const analisarBtn = document.getElementById('analisarBtn');
        analisarBtn.onclick = () => {
            const apiKey = document.getElementById('apiKeyInput').value;
            if (document.getElementById('metodoBusca').value === 'ia' && !apiKey) {
                alert("Por favor, insira sua chave de API do Gemini.");
                return;
            }
            getCurrentSelectionText(apiKey);
        };
    }
});

async function getCurrentSelectionText(apiKey) {
    Word.run(async (context) => {
        const range = context.document.getSelection();
        range.load("text");
        await context.sync();
        
        console.log("Texto capturado da seleção:", `"${range.text}"`);
        findSuggestions(range.text, apiKey);
    }).catch(errorHandler);
}

// --- FUNÇÕES AUXILIARES ---
async function loadNormativos() {
    const files = ['normativos.json', 'normativos_lgpd.json'];
    showLoading("Carregando base de conhecimento...");
    try {
        const responses = await Promise.all(files.map(file => fetch(file).catch(e => {
            console.error(`Falha ao carregar ${file}`, e);
            return null;
        })));
        
        const validResponses = responses.filter(res => res && res.ok);
        const jsonDataArrays = await Promise.all(validResponses.map(res => res.json()));
        
        normativos = [].concat(...jsonDataArrays);
        console.log(`Base de conhecimento carregada com ${normativos.length} normativos.`);
        if (normativos.length === 0) {
            hideLoading("Aviso: Nenhum normativo foi carregado.");
        } else {
             hideLoading();
        }
    } catch (error) {
        console.error("Erro ao carregar arquivos JSON:", error);
        hideLoading("Erro ao carregar a base de conhecimento.");
    }
}

// CORREÇÃO: Renderização das sugestões com toggle e botão de inserção de título.
function renderSuggestions(suggestions) {
    const container = document.getElementById('suggestions');
    if (!suggestions || suggestions.length === 0) {
        // A mensagem de "nenhuma sugestão" será definida por hideLoading
        return;
    }
    container.innerHTML = suggestions.map(s => `
        <div class="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <details class="group">
                <summary class="p-4 cursor-pointer flex justify-between items-center group-hover:bg-gray-700 transition-colors">
                    <h3 class="font-bold text-blue-400 pr-2">${s.titulo}</h3>
                    <span class="text-xs text-gray-500 transform transition-transform duration-200 group-open:rotate-90">&#9654;</span>
                </summary>
                <div class="p-4 border-t border-gray-700 bg-gray-900">
                    <p class="text-sm text-gray-300 whitespace-pre-wrap">${s.texto}</p>
                </div>
            </details>
            <div class="p-2 bg-gray-800 border-t border-gray-700 text-right">
                <button class="insert-title-btn bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1 px-3 rounded-md transition-colors" data-title="${escape(s.titulo)}">
                    Inserir Título
                </button>
            </div>
        </div>
    `).join('');

    // Event listener para os novos botões de inserção
    document.querySelectorAll('.insert-title-btn').forEach(button => {
        button.onclick = () => {
            const titleToInsert = unescape(button.dataset.title);
            insertTextIntoWord(titleToInsert);
        };
    });
}

function insertTextIntoWord(text) {
    Word.run(async (context) => {
        const range = context.document.getSelection();
        // Insere o texto (que agora é o título) e um espaço depois.
        range.insertText(text + " ", Word.InsertLocation.after);
        await context.sync();
    }).catch(errorHandler);
}

function showLoading(message) {
    const container = document.getElementById('suggestions');
    container.innerHTML = `<p class="p-4 text-gray-400 animate-pulse text-center">${message}</p>`;
}

function hideLoading(message = "Nenhuma sugestão encontrada.") {
    const container = document.getElementById('suggestions');
    if (container.querySelector('.bg-gray-800') === null) {
        container.innerHTML = `<p class="p-4 text-gray-500 text-center">${message}</p>`;
    }
}

function errorHandler(error) {
    console.error("Error Office.js: " + error);
    if (error instanceof Office.Error) {
        console.error("Debug info: " + JSON.stringify(error.debugInfo));
    }
}



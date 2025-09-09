/*
 * Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
 * See LICENSE in the project root for license information.
 */

import { callGeminiAPI } from "./gemini-logic";

// Variáveis Globais
let baseDeNormativos = [];
let eventContext;
let debounceTimer;

/**
 * Inicializa a lógica do suplemento quando o Office estiver pronto.
 */
Office.onReady((info) => {
  if (info.host === Office.HostType.Word) {
    document.getElementById("app-body").style.display = "flex";
    
    // Carrega a base de conhecimento de múltiplos arquivos
    loadKnowledgeBase()
      .then(data => {
        baseDeNormativos = data;
        console.log(`Base de conhecimento carregada com ${baseDeNormativos.length} normativos.`);
      })
      .catch(error => {
        console.error("Falha ao carregar a base de conhecimento:", error);
        displayMessage("Erro ao carregar normativos. Verifique o console.");
      });

    // Registra o handler para o evento de mudança de seleção
    Office.context.document.addHandlerAsync(Office.EventType.SelectionChanged, onSelectionChanged, (asyncResult) => {
      if (asyncResult.status === Office.AsyncResultStatus.Failed) {
        console.error("Falha ao registrar o handler de evento: " + asyncResult.error.message);
      }
    });

    // Configura os listeners da UI
    setupUIListeners();
  }
});

/**
 * Carrega e combina os dados de múltiplos arquivos JSON.
 */
async function loadKnowledgeBase() {
  const fileNames = ["normativos.json", "normativos_lgpd.json"]; // Adicione mais arquivos aqui
  const fetchPromises = fileNames.map(fileName => 
    fetch(fileName).then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} for file ${fileName}`);
      }
      return response.json();
    })
  );
  
  const allNormativosArrays = await Promise.all(fetchPromises);
  // Concatena todos os arrays em um único array
  return [].concat(...allNormativosArrays);
}


/**
 * Configura os listeners para os elementos da UI (seletor de modo, campo de API).
 */
function setupUIListeners() {
  const modeSelector = document.getElementById("suggestion-mode");
  const apiKeyContainer = document.getElementById("gemini-api-key-container");
  const apiKeyInput = document.getElementById("gemini-api-key");

  // Tenta carregar a chave de API salva
  apiKeyInput.value = localStorage.getItem("geminiApiKey") || "";

  modeSelector.addEventListener("change", () => {
    if (modeSelector.value === "gemini") {
      apiKeyContainer.style.display = "block";
    } else {
      apiKeyContainer.style.display = "none";
    }
    // Dispara uma nova análise ao mudar de modo
    onSelectionChanged(); 
  });

  apiKeyInput.addEventListener("input", () => {
    localStorage.setItem("geminiApiKey", apiKeyInput.value);
  });
}

/**
 * Handler que é chamado quando a seleção no documento muda.
 */
function onSelectionChanged() {
  // Limpa o timer anterior para evitar múltiplas execuções
  clearTimeout(debounceTimer);

  // Usa um debounce para esperar o usuário parar de digitar
  debounceTimer = setTimeout(() => {
    Word.run(async (context) => {
      eventContext = context;
      const range = context.document.getSelection();
      // Pega o parágrafo inteiro para dar mais contexto
      const paragraph = range.paragraphs.getFirst();
      paragraph.load("text");
      await context.sync();
      
      const text = paragraph.text.trim();
      
      if (text.length > 10) { // Só busca se o parágrafo tiver um tamanho mínimo
        findSuggestions(text);
      } else {
        clearSuggestions();
        displayMessage("Digite um texto com mais de 10 caracteres para obter sugestões.");
      }
    }).catch(errorHandler);
  }, 750); // Atraso de 750ms
}


/**
 * Direciona a busca de sugestões para o modo selecionado (Palavra-Chave ou Gemini).
 * @param {string} text O texto do parágrafo atual.
 */
async function findSuggestions(text) {
  clearSuggestions();
  const mode = document.getElementById("suggestion-mode").value;
  let suggestions = [];

  if (mode === "keyword") {
    suggestions = findSuggestionsByKeyword(text);
    renderSuggestions(suggestions);
  } else if (mode === "gemini") {
    const apiKey = document.getElementById("gemini-api-key").value;
    if (!apiKey) {
      displayMessage("Por favor, insira sua chave de API do Gemini para usar a análise com IA.");
      return;
    }
    
    setLoading(true);
    try {
      const relevantIds = await callGeminiAPI(text, baseDeNormativos, apiKey);
      // Filtra os normativos com base nos IDs retornados pela IA
      suggestions = baseDeNormativos.filter(normativo => relevantIds.includes(normativo.id));
    } catch(error) {
      console.error("Erro na chamada da API Gemini:", error);
      displayMessage(`Erro da IA: ${error.message}`);
    } finally {
      setLoading(false);
      renderSuggestions(suggestions);
    }
  }
}

/**
 * Busca por normativos usando a lógica de palavras-chave.
 * @param {string} paragraphText O texto do parágrafo.
 * @returns {Array} Um array com os normativos encontrados.
 */
function findSuggestionsByKeyword(paragraphText) {
    const suggestionsFound = [];
    const lowerText = paragraphText.toLowerCase();

    for (const normativo of baseDeNormativos) {
        for (const keyword of normativo.palavrasChave) {
            if (lowerText.includes(keyword.toLowerCase())) {
                if (!suggestionsFound.some(s => s.id === normativo.id)) {
                    suggestionsFound.push(normativo);
                }
                break;
            }
        }
    }
    return suggestionsFound;
}

/**
 * Renderiza os cartões de sugestão na UI.
 * @param {Array} suggestions Array de objetos de normativos para exibir.
 */
function renderSuggestions(suggestions) {
  const container = document.getElementById("suggestions-container");
  
  if (suggestions.length === 0) {
    displayMessage("Nenhuma sugestão encontrada para o contexto atual.");
    return;
  }

  suggestions.forEach((normativo) => {
    const card = document.createElement("div");
    card.className = "bg-white p-4 rounded-lg shadow-md mb-3 border border-gray-200 hover:border-indigo-500 hover:shadow-lg transition-all cursor-pointer";
    card.innerHTML = `
      <h3 class="font-bold text-gray-800 text-sm">${normativo.titulo}</h3>
      <p class="text-xs text-gray-600 mt-1 truncate">${normativo.texto}</p>
    `;
    card.onclick = () => insertNormativoText(normativo.texto);
    container.appendChild(card);
  });
}

/**
 * Insere o texto do normativo selecionado no documento do Word.
 * @param {string} text O texto completo a ser inserido.
 */
function insertNormativoText(text) {
  Word.run(async (context) => {
    const range = context.document.getSelection();
    range.insertText(`\n${text}\n`, Word.InsertLocation.after);
    await context.sync();
  }).catch(errorHandler);
}

// Funções Auxiliares da UI

function clearSuggestions() {
  document.getElementById("suggestions-container").innerHTML = "";
  document.getElementById("message-container").innerHTML = "";
  document.getElementById("message-container").style.display = "none";
}

function displayMessage(message) {
  const container = document.getElementById("message-container");
  container.innerHTML = `<p>${message}</p>`;
  container.style.display = "block";
}

function setLoading(isLoading) {
  const spinner = document.getElementById("loading-spinner");
  spinner.style.display = isLoading ? "block" : "none";
  if (isLoading) {
    displayMessage(""); // Limpa outras mensagens
  }
}

function errorHandler(error) {
  console.log("Error: " + error);
  if (error instanceof OfficeExtension.Error) {
    console.log("Debug info: " + JSON.stringify(error.debugInfo));
  }
}


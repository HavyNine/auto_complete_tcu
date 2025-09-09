/**
 * Lida com a comunicação com a API do Google Gemini.
 */

const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=";

/**
 * Chama a API Gemini para obter sugestões de normativos baseadas no contexto.
 * @param {string} contextText O texto do parágrafo do documento.
 * @param {Array} knowledgeBase A base de conhecimento completa com todos os normativos.
 * @param {string} apiKey A chave de API do usuário.
 * @returns {Promise<Array<string>>} Uma promessa que resolve para um array de IDs de normativos relevantes.
 */
export async function callGeminiAPI(contextText, knowledgeBase, apiKey) {
  // 1. Constrói o prompt para o modelo
  const prompt = buildPrompt(contextText, knowledgeBase);
  
  // 2. Define o schema da resposta esperada (JSON)
  const schema = {
    type: "OBJECT",
    properties: {
      "relevantIDs": {
        type: "ARRAY",
        items: { "type": "STRING" }
      }
    },
    required: ["relevantIDs"]
  };
  
  // 3. Monta o payload da requisição
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.2, // Baixa temperatura para respostas mais consistentes
    },
    // Instruções de sistema para guiar o comportamento do modelo
    systemInstruction: {
        parts: [{ text: "Você é um assistente especialista em auditoria e conformidade. Sua tarefa é identificar os normativos mais relevantes de uma lista fornecida, com base no texto de um relatório de auditoria." }]
    },
  };

  // 4. Faz a chamada à API com lógica de retentativa (exponential backoff)
  const response = await fetchWithRetry(`${API_URL}${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.json();
    console.error("Erro da API Gemini:", errorBody);
    throw new Error(`API Error: ${errorBody.error?.message || response.statusText}`);
  }

  const result = await response.json();
  
  // 5. Extrai e processa a resposta
  try {
    const jsonText = result.candidates[0].content.parts[0].text;
    const parsedJson = JSON.parse(jsonText);
    
    if (parsedJson && parsedJson.relevantIDs && Array.isArray(parsedJson.relevantIDs)) {
        return parsedJson.relevantIDs;
    } else {
        console.warn("Resposta da IA não continha um array 'relevantIDs' válido.", parsedJson);
        return [];
    }
  } catch (e) {
    console.error("Falha ao processar a resposta JSON da IA:", e, result);
    throw new Error("A resposta da IA não estava no formato JSON esperado.");
  }
}

/**
 * Constrói o prompt detalhado para enviar à API Gemini.
 * @param {string} contextText O texto do parágrafo do usuário.
 * @param {Array} knowledgeBase A base de conhecimento completa.
 * @returns {string} O prompt formatado.
 */
function buildPrompt(contextText, knowledgeBase) {
  // Transforma a base de conhecimento em um formato de texto simples para o prompt
  const normativosParaPrompt = knowledgeBase.map(n => 
    `- ID: ${n.id}\n  Título: ${n.titulo}\n  Descrição: ${n.texto.substring(0, 150)}...`
  ).join('\n');

  return `
    Com base no seguinte parágrafo de um relatório de auditoria, analise a lista de normativos e retorne os IDs daqueles que são MAIS RELEVANTES para o contexto.

    **Parágrafo do Relatório:**
    "${contextText}"

    **Lista de Normativos Disponíveis:**
    ${normativosParaPrompt}

    Sua resposta DEVE ser um objeto JSON contendo APENAS a chave "relevantIDs", que é um array de strings com os IDs dos normativos mais relevantes.
    Exemplo de resposta: { "relevantIDs": ["iso_27001_a5_1", "lgpd_art_7"] }
    Se nenhum for relevante, retorne um array vazio: { "relevantIDs": [] }
  `;
}


/**
 * Executa uma chamada fetch com retentativas em caso de falha (exponential backoff).
 * @param {string} url O URL da requisição.
 * @param {object} options As opções da requisição fetch.
 * @param {number} retries O número de tentativas.
 * @returns {Promise<Response>} A resposta da requisição.
 */
async function fetchWithRetry(url, options, retries = 3) {
  let attempt = 0;
  while (attempt < retries) {
    try {
      const response = await fetch(url, options);
      // Sucesso na primeira tentativa ou em uma retentativa
      if (response.ok || response.status < 500) {
        return response;
      }
      // Erro de servidor, vamos tentar novamente
      console.warn(`Tentativa ${attempt + 1} falhou com status ${response.status}. Tentando novamente...`);
    } catch (error) {
      console.warn(`Tentativa ${attempt + 1} falhou com erro de rede: ${error.message}. Tentando novamente...`);
    }
    attempt++;
    if (attempt < retries) {
      // Espera exponencial: 1s, 2s, 4s...
      const delay = Math.pow(2, attempt -1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error(`Falha na chamada à API após ${retries} tentativas.`);
}

// Esta função agora é 'async' e vai propagar erros se algo falhar.
async function findSuggestionsWithIA(text, apiKey, showLoading, hideLoading, renderSuggestions) {
    showLoading("Analisando com IA...");

    // Passo 1: Buscar candidatos no backend local (pré-filtragem)
    console.log("Passo 1: Buscando candidatos no backend local...");
    const response = await fetch('http://127.0.0.1:5000/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text, num_results: 15 })
    });

    if (!response.ok) {
        // Se o servidor local falhar, lança um erro que será capturado no taskpane.js
        throw new Error(`Falha ao conectar ao servidor local: ${response.statusText}`);
    }

    const candidates = await response.json();
    console.log("Candidatos recebidos:", candidates);

    if (!candidates || candidates.length === 0) {
        renderSuggestions([]); // Renderiza uma lista vazia se não houver candidatos
        hideLoading();
        return;
    }

    // Passo 2: Enviar para a API do Gemini para a seleção final
    console.log("Passo 2: Enviando para a API do Gemini para seleção final...");
    const prompt = `
        Contexto do relatório de auditoria: "${text}"

        Lista de normativos pré-selecionados:
        ${JSON.stringify(candidates, null, 2)}

        Instrução: Analise o contexto do relatório e retorne um array JSON com os 3 normativos MAIS RELEVANTES da lista fornecida.
        O formato de saída deve ser um array JSON válido, contendo os objetos completos dos normativos escolhidos.
        Não adicione nenhum texto ou explicação fora do JSON.
    `;

    const model = "gemini-1.5-flash-latest"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const geminiResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
            }
        })
    });

    if (!geminiResponse.ok) {
        // Se a API do Gemini falhar, lança um erro
        throw new Error(`Erro na API do Gemini: ${geminiResponse.statusText}`);
    }

    const result = await geminiResponse.json();
    const jsonText = result.candidates[0].content.parts[0].text;
    const finalSuggestions = JSON.parse(jsonText);
    
    console.log("Sugestões finais do Gemini:", finalSuggestions);
    renderSuggestions(finalSuggestions);
    hideLoading();
}


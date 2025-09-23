# Assistente de Normativos para Microsoft Word

Este projeto é um suplemento (Add-in) para o Microsoft Word que funciona como um assistente inteligente para a redação de relatórios de auditoria e documentos técnicos. Ele analisa o texto que o usuário está a escrever e sugere normativos, acórdãos e jurisprudências relevantes de uma vasta base de conhecimento, otimizando drasticamente o tempo e a precisão do trabalho.

A ferramenta opera com uma **busca rápida e precisa por palavras-chave**. Uma evolução futura planeada é a inclusão de uma **análise semântica avançada com Inteligência Artificial**, utilizando um modelo de linguagem da Google (Gemini) e uma arquitetura RAG (Retrieval-Augmented Generation).

## Arquitetura do Projeto

O sistema é dividido em duas partes principais que trabalham em conjunto:

1.  **Frontend (Suplemento do Word):** Construído com `HTML`, `CSS` e `JavaScript` puro, utilizando a biblioteca `Office.js` para interagir com o documento do Word. Ele é responsável pela interface do usuário no painel lateral, pela captura do texto e pela execução da busca por palavras-chave.

2.  **Backend (Servidor Local Python):** Um servidor web local construído com `Flask` e `Waitress`. A sua função principal é **suportar a futura funcionalidade de Análise com IA**. Ele expõe um endpoint `/search` que realiza uma busca semântica ultrarrápida numa base de dados vetorial (ChromaDB). Na versão atual, este backend é parte da preparação para a evolução do projeto e não é utilizado pela busca por palavra-chave.

## Funcionalidades Principais

* **Busca por Palavra-Chave:** Um sistema de pontuação inteligente que encontra correspondências exatas de frases-chave, priorizando as mais longas e específicas para garantir alta relevância e mostrando apenas os 10 resultados mais fortes.
* **Análise com IA (Evolução Futura):** A arquitetura do projeto já está preparada para uma futura integração com IA. O plano é utilizar o servidor local para encontrar os normativos mais relevantes semanticamente e, em seguida, enviar essa lista para a API do Gemini para uma seleção final e contextualizada. **Esta funcionalidade não está ativa na versão atual.**
* **Interface Interativa:** As sugestões são apresentadas em formato de caixa expansiva (toggle), permitindo ao usuário visualizar o texto completo do normativo sem poluir a interface.
* **Inserção Simplificada:** Com um clique, o usuário pode inserir apenas o título do normativo no documento, mantendo o relatório limpo.
* **Processamento de Dados:** Inclui scripts para converter e limpar múltiplos arquivos `.csv` numa base de conhecimento unificada em formato `.json`.

---

## Como Replicar e Rodar Localmente

Siga estes passos para configurar e executar o projeto na sua máquina.

### Pré-requisitos

* **Node.js e npm:** Necessário para o frontend do suplemento. [Faça o download aqui](https://nodejs.org/).
* **Python 3.8+ e pip:** Necessário para os scripts de processamento de dados. [Faça o download aqui](https://www.python.org/).
* **Microsoft Word:** Versão que suporte suplementos (Microsoft 365 ou Word 2016+), preferencialmente para testar no **Word Online**.

### Passo 1: Preparar a Base de Conhecimento (Dados)

Esta etapa descreve como construir a base de dados vetorial a partir dos dados brutos.

1.  **Download os Dados:** A base de conhecimento é construída a partir dos dados abertos do Tribunal de Contas da União (TCU). Faça o download dos arquivos `.csv` relevantes a partir deste link:
    * **Fonte de Dados:** [https://sites.tcu.gov.br/dados-abertos/](https://sites.tcu.gov.br/dados-abertos/)

2.  **Organizar os arquivos:** Crie uma pasta chamada `base_de_dados` na raiz do projeto e coloque todos os arquivos `.csv` baixados dentro dela.

3.  **Dividir Arquivos Grandes (se necessário):** Alguns arquivos podem ser muito grandes. O script `split_arquivos.py` divide-os em partes menores para facilitar o processamento.
    ```bash
    python split_arquivos.py
    ```

4.  **Converter para JSON Unificado:** O script `converter_normativos.py` lê todos os arquivos `.csv` da pasta `base_de_dados`, limpa os dados e unifica tudo num único ficheiro `normativos.json`. Este ficheiro deve ser colocado na pasta `AssistenteDeNormativos/src/taskpane/`.
    ```bash
    python converter_normativos.py
    ```

5.  **Gerar a Base de Dados Vetorial (Para Evolução Futura):**
    * O processo de "embedding" (converter o texto em vetores) é extremamente intensivo. É altamente recomendável usar um ambiente com GPU, como o Google Colab.
    * Faça o upload do ficheiro `normativos.json` gerado e do notebook `Script_de_Pré_processamento_Embeddings.ipynb` para o Google Colab com um ambiente de execução com GPU.
    * Execute o notebook no Colab. Ele irá gerar uma pasta chamada `normativos_db`. No final, compacte e faça o download para a sua máquina local para uso futuro.

### Passo 2: Configuração do Backend (Para Evolução Futura)

1.  **Coloque a Base de Dados Vetorial:** Descompacte o ficheiro `normativos_db.zip` e coloque a pasta `normativos_db` na raiz do projeto.

2.  **Crie um Ambiente Virtual (Recomendado):**
    ```bash
    python -m venv .venv
    source .venv/bin/activate  # No macOS/Linux
    .venv\Scripts\activate     # No Windows
    ```

3.  **Instale as Dependências Python:** As dependências Python são para o servidor de backend da Análise com IA. Embora não seja necessário para a funcionalidade atual, você pode instalá-las para preparar o ambiente:
    ```bash
    pip install Flask Flask-Cors chromadb sentence-transformers torch waitress
    ```

### Passo 3: Configuração do Frontend (Suplemento)

1.  **Navegue até à Pasta do Suplemento:**
    ```bash
    cd AssistenteDeNormativos
    ```

2.  **Instale as Dependências do Node.js:**
    ```bash
    npm install
    ```

### Passo 4: Executar o Projeto

Na versão atual, apenas o servidor do frontend (suplemento) é necessário.

1.  **Navegue até a pasta `AssistenteDeNormativos`**.

2.  **Inicie o servidor de desenvolvimento:**
    ```bash
    npm start
    ```

### Passo 5: Testar no Word Online

1.  Acesse ao [Word Online](https://www.office.com/launch/word) e crie um documento em branco.
2.  Vá ao menu **Suplementos > MEUS SUPLEMENTOS**.
3.  Clique em **"Carregar o Meu Suplemento"** e selecione o local do projeto e selecione `manifest.xml` localizado na pasta `AssistenteDeNormativos`.
4.  O "Assistente de Normativos" irá aparecer no painel lateral.





# Guia de Implantação em Ambiente de Produção

## Etapa 1: Preparação do Ambiente de Produção

Antes de publicar, precisamos ajustar algumas configurações nos seus arquivos para que apontem para os endereços corretos na internet, em vez dos endereços locais de desenvolvimento.

### 1.1. Configurar a URL de Produção do Frontend

**Arquivo para editar:** `Projeto Final/AssistenteDeNormativos/webpack.config.js`

**O que fazer:**

Localize a linha que define `urlProd` e substitua `"https://www.contoso.com/"` pela URL real onde os arquivos do seu suplemento ficarão hospedados. Lembre-se que a URL deve ser HTTPS.

```js
// Linha original
const urlProd = "https://www.contoso.com/";

// Exemplo de como deve ficar
const urlProd = "https://sua-empresa.com/suplemento-normativos/";

```

### 1.2. Configurar a URL de Produção do Backend

Seu suplemento precisa se comunicar com o servidor Python para usar a busca com IA. Vamos atualizar o endereço desse servidor.

**Arquivo para editar:**  
`./AssistenteDeNormativos/src/taskpane/gemini-logic.js`

**O que fazer:**  
Encontre a linha que contém o endereço `http://127.0.0.1:5000/search` e altere para a URL pública onde seu backend Python será hospedado.

```javascript
// Linha original
const response = await fetch('http://127.0.0.1:5000/search', { /* ... */ });

// Exemplo de como deve ficar
const response = await fetch('https://api.sua-empresa.com/buscar-normativos', { /* ... */ });
```

---

### 1.3. Gerar os Arquivos Finais para Produção

Agora que as configurações estão corretas, vamos gerar a versão final e otimizada do seu suplemento.

**Ação:**  
Abra o terminal, navegue até a pasta `Projeto Final/AssistenteDeNormativos` e execute o seguinte comando:

```bash
npm run build
```

**Resultado:**  
Este comando criará uma pasta chamada `dist`. Dentro dela, estarão todos os arquivos do seu suplemento, prontos para serem publicados na web.

---

## Etapa 2: Hospedagem da Aplicação

Com os arquivos prontos, o próximo passo é colocá-los em servidores acessíveis pela internet.

### 2.1. Hospedar o Frontend (Arquivos da pasta dist)

Os arquivos da pasta `dist` (HTML, CSS, JS, imagens) precisam ser hospedados em um servidor web.

**O que fazer:**  
Faça o upload de todo o conteúdo da pasta `dist` para um serviço de hospedagem estática.


> **Importante:** A URL que você receber do serviço de hospedagem deve ser a mesma que você configurou no passo 1.1.

---

### 2.2. Hospedar o Backend (Servidor Python)

Seu servidor `backend_server.py` precisa ser executado em um ambiente que suporte Python.

**O que fazer:**  
Implante seu servidor Python e a base de dados vetorial (`normativos_db`) em um serviço de hospedagem de aplicações.


> **Importante:** A URL que você receber para sua API deve ser a mesma que você configurou no passo 1.2.

---

## Etapa 3: Implantação do Manifesto

O `manifest.xml` é o arquivo que diz ao Microsoft 365 como encontrar e carregar seu suplemento.

### 3.1. Disponibilizar o Arquivo manifest.xml

O arquivo `manifest.xml` gerado dentro da pasta `dist` já está configurado com as URLs de produção. Ele precisa estar acessível publicamente via **HTTPS**. A maneira mais fácil é hospedá-lo junto com os outros arquivos do frontend (passo 2.1).

**URL de Exemplo:**  
`https://sua-empresa.com/suplemento-normativos/manifest.xml`

---

### 3.2. Publicar o Suplemento para os Usuários

Para que as pessoas na sua organização possam usar o suplemento, um administrador do Microsoft 365 precisa adicioná-lo ao catálogo central de suplementos.

**Passos para o Administrador:**
1. Acesse o **Centro de administração do Microsoft 365**.
2. Navegue até **Configurações > Aplicativos integrados**.
3. Clique na opção **Carregar aplicativos personalizados**.
4. Escolha uma das opções:
   - **Fornecer link para o arquivo de manifesto:** Insira a URL pública do seu `manifest.xml`. *(Recomendado)*
   - **Carregar arquivo de manifesto (.xml) do computador):** Faça o upload do arquivo `manifest.xml` da sua pasta `dist`.
5. Siga as instruções para definir quem terá acesso ao suplemento (usuários específicos, grupos ou toda a organização).

---

**Resultado Final:**  
Depois de concluído, o suplemento **"Assistente de Normativos"** aparecerá na guia **"Página Inicial"** do Word para os usuários selecionados.


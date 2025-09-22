import json
import os
import chromadb
from chromadb.utils import embedding_functions
import time

# --- CONFIGURAÇÃO ---
JSON_FILE_PATH = "AssistenteDeNormativos/src/taskpane/normativos.json"
COLLECTION_NAME = "normativos_collection"
LOCAL_EMBEDDING_MODEL = "all-MiniLM-L6-v2"
# AJUSTADO: Um tamanho de lote menor é mais seguro para a memória RAM e evita travamentos.
# Valores entre 100 e 500 são geralmente bons para processamento em CPU.
BATCH_SIZE = 256
# --- FIM DA CONFIGURAÇÃO ---

print("Iniciando o pré-processamento dos normativos...")

# 1. Carregar o arquivo JSON
try:
    with open(JSON_FILE_PATH, 'r', encoding='utf-8') as f:
        normativos = json.load(f)
    print(f"Arquivo JSON '{JSON_FILE_PATH}' carregado com {len(normativos)} documentos.")
except FileNotFoundError:
    print(f"ERRO: O arquivo '{JSON_FILE_PATH}' não foi encontrado.")
    exit()
except json.JSONDecodeError:
    print(f"ERRO: O arquivo '{JSON_FILE_PATH}' não é um JSON válido.")
    exit()

# 2. Preparar o cliente do ChromaDB
client = chromadb.PersistentClient(path="./normativos_db")

def init_google_embedding_function():
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        return None
    try:
        ef = embedding_functions.GoogleGenerativeAiEmbeddingFunction(api_key=api_key, model_name="text-embedding-004")
        print("Usando Google Generative AI para embeddings (via GOOGLE_API_KEY).")
        return ef
    except Exception as e:
        print(f"Falha ao inicializar Google embedding function: {e}")
        return None

def init_local_embedding_function():
    try:
        ef = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name=LOCAL_EMBEDDING_MODEL
        )
        print(f"Usando embeddings locais com modelo: {LOCAL_EMBEDDING_MODEL}")
        return ef
    except ImportError:
        print("ERRO: A biblioteca 'sentence-transformers' não está instalada.")
        return None
    except Exception as e:
        print(f"Falha ao inicializar embeddings locais: {e}")
        return None

# Tentar Google primeiro, senão fallback para local
embedding_function_in_use = init_google_embedding_function()
if embedding_function_in_use is None:
    embedding_function_in_use = init_local_embedding_function()

if embedding_function_in_use is None:
    print("Nenhuma função de embedding disponível.")
    exit()

# 3. Criar ou obter a coleção
print(f"Criando/acessando a coleção '{COLLECTION_NAME}'...")
collection = client.get_or_create_collection(
    name=COLLECTION_NAME,
    embedding_function=embedding_function_in_use
)

def embed_and_add_batch(batch, start_index):
    ids = [str(doc.get("id", f"doc_{start_index + j}")) for j, doc in enumerate(batch)]
    documents_to_embed = [f"{doc.get('titulo', '')}: {doc.get('texto', '')}" for doc in batch]
    metadatas = [{"titulo": doc.get("titulo", ""), "texto": doc.get("texto", "")} for doc in batch]

    try:
        print(f"  - Lote {start_index // BATCH_SIZE + 1}: Gerando embeddings para {len(batch)} documentos...", end="", flush=True)
        collection.add(
            ids=ids,
            documents=documents_to_embed,
            metadatas=metadatas
        )
        print(" OK.")
        if isinstance(collection.embedding_function, embedding_functions.GoogleGenerativeAiEmbeddingFunction):
            time.sleep(1)
        return True
    except Exception as e:
        print("\nERRO!")
        print(f"Erro ao adicionar lote começando em {start_index}: {e}")
        return False

# 4. Adicionar os documentos à coleção em lotes (batches)
print("Iniciando a adição de documentos ao banco de dados vetorial...")
total_normativos = len(normativos)

# Para testes rápidos, você pode descomentar as linhas abaixo
# test_limit = 500 # Processa apenas os primeiros 500 documentos
# total_normativos = min(total_normativos, test_limit)
# print(f"TEST_LIMIT ativo: processando apenas {total_normativos} documentos.")

# ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
# CORREÇÃO APLICADA AQUI
# ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
existing_ids_count = collection.count()
if existing_ids_count > 0:
    print(f"Coleção já contém {existing_ids_count} documentos. Continuando a partir daí.")

# Esta linha garante que o processo continue de onde parou, em vez de começar do zero.
start_index = existing_ids_count
# ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
# FIM DA CORREÇÃO
# ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

for i in range(start_index, total_normativos, BATCH_SIZE):
    batch = normativos[i:i + BATCH_SIZE]
    if not embed_and_add_batch(batch, i):
        print(f"Falha crítica no lote. Interrompendo processo.")
        break
    
    print(f"  Progresso: {min(i + BATCH_SIZE, total_normativos)} de {total_normativos} documentos processados.")

print("\nPré-processamento concluído.")
print(f"O banco de dados vetorial foi salvo na pasta './normativos_db'.")
print(f"Total de documentos na coleção: {collection.count()}")
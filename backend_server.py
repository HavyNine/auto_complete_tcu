from flask import Flask, request, jsonify
from flask_cors import CORS
import chromadb
from chromadb.utils import embedding_functions
from waitress import serve


COLLECTION_NAME = "normativos_collection"
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"


app = Flask(__name__)
CORS(app) 

# Inicializa o cliente do ChromaDB e a função de embedding
collection = None
try:
    print("Iniciando o servidor e carregando a base de dados vetorial...")
    client = chromadb.PersistentClient(path="./normativos_db")
    
    sentence_transformer_ef = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=EMBEDDING_MODEL_NAME
    )
    
    collection = client.get_collection(
        name=COLLECTION_NAME,
        embedding_function=sentence_transformer_ef
    )
    print(f"-> Coleção '{COLLECTION_NAME}' com {collection.count()} documentos carregada com sucesso!")

except Exception as e:
    print(f"--- ERRO CRÍTICO AO CARREGAR A COLEÇÃO ---")
    print(f"  -> Erro: {e}")


@app.route('/search', methods=['POST'])
def search():
    if not collection:
        return jsonify({"error": "A coleção de normativos não foi carregada. Verifique os logs do servidor."}), 500

    data = request.get_json()
    query_text = data.get('text')
    num_results = data.get('num_results', 15)

    if not query_text:
        return jsonify({"error": "O corpo da requisição precisa de um campo 'text'."}), 400

    try:
        results = collection.query(
            query_texts=[query_text],
            n_results=num_results
        )
        
        formatted_results = []
        ids = results['ids'][0]
        metadatas = results['metadatas'][0]
        
        for i, doc_id in enumerate(ids):
            meta = metadatas[i]
            formatted_results.append({
                "id": doc_id,
                "titulo": meta.get("titulo"),
                "texto": meta.get("texto")
            })

        return jsonify(formatted_results)

    except Exception as e:
        print(f"Erro durante a query: {e}")
        return jsonify({"error": f"Ocorreu um erro durante a busca: {e}"}), 500


if __name__ == '__main__':
    print(f"Iniciando o servidor de backend na porta 5000 com Waitress...")
    serve(app, host='127.0.0.1', port=5000)


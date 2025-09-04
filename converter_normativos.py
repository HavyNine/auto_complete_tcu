import pandas as pd
import os
import json
import re

def clean_text(text):
    """Remove tags HTML e espaços extras do texto."""
    if isinstance(text, str):
        clean = re.compile('<.*?>')
        text = re.sub(clean, '', text)
        return ' '.join(text.split())
    return ''

def extract_keywords(row, columns):
    """Extrai e limpa palavras-chave das colunas especificadas."""
    keywords = set()
    for col in columns:
        if col in row and isinstance(row[col], str):
            words = re.split(r'[,;]\s*|\[|\]|\s*;\s*', row[col])
            for word in words:
                cleaned_word = clean_text(word).strip()
                if cleaned_word:
                    keywords.add(cleaned_word.lower())
    return list(keywords)

def get_mapping_for_file(filename, mappings):
    """Encontra o mapeamento de colunas correto para um arquivo com base em seu prefixo."""
    for prefix, mapping in mappings.items():
        if filename.startswith(prefix):
            return mapping
    return None

def processar_arquivos_para_json(pasta_origem, arquivo_saida='normativos.json'):
    """
    Lê arquivos CSV de uma pasta, processa os dados e gera um arquivo JSON unificado.
    Identifica os arquivos por prefixos para lidar com nomes de arquivos divididos (splits).

    :param pasta_origem: Caminho para a pasta contendo os arquivos CSV.
    :param arquivo_saida: Nome do arquivo JSON a ser gerado.
    """
    all_data = []

    # Mapeamento de colunas baseado nos prefixos dos nomes dos arquivos
    column_mappings = {
        'acordao-completo-': {'id': 'KEY', 'titulo': 'TITULO', 'texto': 'SUMARIO', 'palavrasChave': ['ASSUNTO', 'TIPOPROCESSO']},
        'boletim-jurisprudencia.csv': {'id': 'KEY', 'titulo': 'TITULO', 'texto': 'ENUNCIADO', 'palavrasChave': ['ENUNCIADO']},
        'boletim-pessoal.csv': {'id': 'KEY', 'titulo': 'TITULO', 'texto': 'ENUNCIADO', 'palavrasChave': ['ENUNCIADO']},
        'boletim-informativo-lc.csv': {'id': 'KEY', 'titulo': 'TITULO', 'texto': 'ENUNCIADO', 'palavrasChave': ['ENUNCIADO']},
        'inabilitados-funcao-publica.csv': {'id': 'CPF', 'titulo': 'NOME', 'texto': 'PROCESSO', 'palavrasChave': ['NOME', 'PROCESSO', 'DELIBERACAO']},
        'jurisprudencia-selecionada': {'id': 'KEY', 'titulo': 'TEMA', 'texto': 'ENUNCIADO', 'palavrasChave': ['TEMA', 'SUBTEMA', 'INDEXACAO']},
        'licitantes-inidoneos.csv': {'id': 'CPF_CNPJ', 'titulo': 'NOME', 'texto': 'PROCESSO', 'palavrasChave': ['NOME', 'PROCESSO', 'DELIBERACAO']},
        'norma_': {'id': 'KEY', 'titulo': 'TITULO', 'texto': 'TEXTONORMA', 'palavrasChave': ['TEMA', 'ASSUNTO']},
        'resp-contas-julgadas-irreg-implicacao-eleitoral.csv': {'id': 'CPF', 'titulo': 'NOME', 'texto': 'PROCESSO', 'palavrasChave': ['NOME', 'PROCESSO', 'CARGO/FUNCAO']},
        'resp-contas-julgadas-irregulares.csv': {'id': 'CPF_CNPJ', 'titulo': 'NOME', 'texto': 'PROCESSO', 'palavrasChave': ['NOME', 'PROCESSO']},
        'resposta-consulta.csv': {'id': 'KEY', 'titulo': 'TEMA', 'texto': 'ENUNCIADO', 'palavrasChave': ['TEMA', 'SUBTEMA', 'INDEXACAO']},
        'sumula.csv': {'id': 'KEY', 'titulo': 'TEMA', 'texto': 'ENUNCIADO', 'palavrasChave': ['TEMA', 'SUBTEMA', 'INDEXACAO']},
    }

    files_in_folder = os.listdir(pasta_origem)
    
    for filename in files_in_folder:
        if filename.endswith('.csv'):
            mapping = get_mapping_for_file(filename, column_mappings)
            
            if mapping:
                filepath = os.path.join(pasta_origem, filename)
                try:
                    df = pd.read_csv(filepath, delimiter='|', on_bad_lines='skip', low_memory=False)
                    print(f"Processando arquivo: {filename}...")

                    id_col = mapping.get('id')
                    titulo_col = mapping.get('titulo')
                    texto_col = mapping.get('texto')

                    for index, row in df.iterrows():
                        if id_col in row and titulo_col in row and texto_col in row:
                            texto_limpo = clean_text(row[texto_col])
                            titulo_limpo = clean_text(row[titulo_col])

                            if texto_limpo:
                                entry = {
                                    'id': str(row[id_col]),
                                    'titulo': titulo_limpo,
                                    'texto': texto_limpo,
                                    'palavrasChave': extract_keywords(row, mapping['palavrasChave'])
                                }
                                all_data.append(entry)
                except Exception as e:
                    print(f"Erro ao processar o arquivo {filename}: {e}")
            else:
                print(f"Aviso: Nenhum mapeamento encontrado para o arquivo '{filename}'. O arquivo será ignorado.")

    with open(arquivo_saida, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)

    print(f"\nProcesso concluído!")
    print(f"Arquivo '{arquivo_saida}' criado com sucesso, contendo {len(all_data)} registros.")

# --- INÍCIO DA EXECUÇÃO ---
if __name__ == "__main__":
    # Coloque o caminho para a pasta onde seus arquivos CSV estão localizados.
    # Usar '.' significa que o script procurará os arquivos na mesma pasta onde ele for executado.
    pasta_dos_normativos = 'base_de_dados' 

    processar_arquivos_para_json(pasta_dos_normativos)
import os
import pandas as pd

def dividir_csv_grandes(pasta_entrada, tamanho_maximo_mb=90):
    """
    Verifica e divide arquivos CSV grandes, garantindo que os arquivos resultantes
    tenham o tamanho controlado diretamente no disco. Esta versão corrige um bug de
    loop infinito que ocorria se um único bloco fosse maior que o limite de tamanho.

    :param pasta_entrada: O caminho para a pasta contendo os arquivos CSV.
    :param tamanho_maximo_mb: O tamanho máximo em megabytes para cada arquivo dividido.
    """
    CODIFICACAO_ENTRADA = 'utf-8'
    DELIMITADOR = '|'
    # Um chunksize menor dá mais granularidade e ajuda a evitar o problema do bloco único gigante
    TAMANHO_BLOCO = 1000 
    
    tamanho_maximo_bytes = tamanho_maximo_mb * 1024 * 1024

    if not os.path.exists(pasta_entrada):
        print(f"Erro: A pasta '{pasta_entrada}' não foi encontrada.")
        return

    for nome_arquivo in os.listdir(pasta_entrada):
        if nome_arquivo.endswith('.csv') and '_parte_' not in nome_arquivo:
            caminho_completo = os.path.join(pasta_entrada, nome_arquivo)
            
            if os.path.getsize(caminho_completo) <= tamanho_maximo_bytes:
                print(f"O arquivo '{nome_arquivo}' ({(os.path.getsize(caminho_completo) / (1024 * 1024)):.2f} MB) não precisa ser dividido.")
                continue

            print(f"O arquivo '{nome_arquivo}' ({(os.path.getsize(caminho_completo) / (1024 * 1024)):.2f} MB) será dividido.")
            
            try:
                leitor_blocos = pd.read_csv(
                    caminho_completo,
                    chunksize=TAMANHO_BLOCO,
                    encoding=CODIFICACAO_ENTRADA,
                    delimiter=DELIMITADOR,
                    low_memory=False
                )

                contador_parte = 1
                # Transforma o leitor em um iterador que podemos controlar manualmente
                bloco_iterator = iter(leitor_blocos)

                # Loop principal que continua enquanto houver blocos no iterador
                while True:
                    try:
                        # Pega o primeiro bloco que iniciará um novo arquivo
                        bloco_inicial = next(bloco_iterator)
                    except StopIteration:
                        # Se não há mais blocos, o trabalho terminou.
                        break

                    nome_saida = f"{os.path.splitext(nome_arquivo)[0]}_parte_{contador_parte}.csv"
                    caminho_saida = os.path.join(pasta_entrada, nome_saida)
                    print(f"  -> Criando arquivo '{nome_saida}'...")

                    # Escreve o bloco inicial com cabeçalho
                    bloco_inicial.to_csv(caminho_saida, index=False, sep=DELIMITADOR, encoding='utf-8')

                    # Continua adicionando blocos no mesmo arquivo até atingir o tamanho
                    while os.path.getsize(caminho_saida) < tamanho_maximo_bytes:
                        try:
                            bloco_seguinte = next(bloco_iterator)
                            bloco_seguinte.to_csv(caminho_saida, mode='a', header=False, index=False, sep=DELIMITADOR, encoding='utf-8')
                        except StopIteration:
                            # Se não há mais blocos, termina o loop interno
                            break
                    
                    tamanho_salvo = os.path.getsize(caminho_saida)
                    print(f"     -> Arquivo '{nome_saida}' finalizado com {tamanho_salvo / (1024*1024):.2f} MB")
                    contador_parte += 1
            
            except Exception as e:
                print(f"  -> ERRO ao processar o arquivo '{nome_arquivo}': {e}")



if __name__ == '__main__':
    caminho_da_pasta = './'
    # Usar um valor ligeiramente menor que 100 dá uma margem de segurança
    dividir_csv_grandes(caminho_da_pasta, tamanho_maximo_mb=60)
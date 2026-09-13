import os
import sys
from datetime import datetime
from playwright.sync_api import sync_playwright

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

def parse_eventos(texto_bruto):
    blocos = texto_bruto.split("====")
    eventos = []
    
    for bloco in blocos:
        linhas = [l.strip() for l in bloco.strip().split("\n") if l.strip() and "====" not in l]
        if not linhas:
            continue
            
        dados = {}
        for linha in linhas:
            if ":" in linha:
                chave, valor = linha.split(":", 1)
                dados[chave.strip()] = valor.strip()
                
        if "Evento" in dados or "Convênio" in dados:
            eventos.append(dados)
            
    return eventos

def gerar_pdf_comprovante(texto_eventos, caminho_pdf="comprovantes/comprovante_vagas.pdf", cpf="", page=None):
    eventos = parse_eventos(texto_eventos)
    data_geracao = datetime.now().strftime("%d/%m/%Y às %H:%M:%S")
    
    linhas_html = ""
    for ev in eventos:
        nome_evento = ev.get("Evento", "-")
        convenio = ev.get("Convênio", "-")
        data_hora = ev.get("Data/Hora", "-")
        ponto = ev.get("Ponto Encontro", "-")
        endereco = ev.get("Endereço", "-")
        tipo = ev.get("Tipo de Vaga", "-")
        
        linhas_html += f"""
        <div class="card-evento">
            <div class="linha-destaque">
                <span class="evento-nome">{nome_evento}</span>
                <span class="badge-tipo {tipo.lower()}">{tipo}</span>
            </div>
            <table class="tabela-detalhes">
                <tr><td><strong>Convênio:</strong></td><td>{convenio}</td></tr>
                <tr><td><strong>Data e Hora:</strong></td><td>{data_hora}</td></tr>
                <tr><td><strong>Ponto de Encontro:</strong></td><td>{ponto}</td></tr>
                <tr><td><strong>Endereço:</strong></td><td>{endereco}</td></tr>
            </table>
        </div>
        """
        
    if not linhas_html:
        linhas_html = "<p style='text-align:center; padding: 20px; color: #555;'>Nenhum evento registrado encontrado.</p>"

    html_content = f"""
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <title>Comprovante CPROEIS</title>
        <style>
            body {{
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 30px;
                color: #222;
                background: #fff;
            }}
            .header {{
                border-bottom: 2px solid #0d47a1;
                padding-bottom: 15px;
                margin-bottom: 25px;
            }}
            .header h1 {{
                margin: 0;
                font-size: 20px;
                color: #0d47a1;
                text-transform: uppercase;
            }}
            .header h2 {{
                margin: 5px 0 0 0;
                font-size: 14px;
                color: #555;
                font-weight: normal;
            }}
            .meta-info {{
                margin-bottom: 20px;
                font-size: 12px;
                color: #444;
                display: flex;
                justify-content: space-between;
                border-bottom: 1px solid #ddd;
                padding-bottom: 10px;
            }}
            .card-evento {{
                border: 1px solid #ccc;
                border-left: 4px solid #0d47a1;
                padding: 15px;
                margin-bottom: 15px;
                page-break-inside: avoid;
            }}
            .linha-destaque {{
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
                border-bottom: 1px dashed #ddd;
                padding-bottom: 8px;
            }}
            .evento-nome {{
                font-size: 15px;
                font-weight: bold;
                color: #111;
            }}
            .badge-tipo {{
                font-size: 11px;
                padding: 3px 8px;
                border-radius: 3px;
                font-weight: bold;
                text-transform: uppercase;
            }}
            .badge-tipo.titular {{
                background-color: #e8f5e9;
                color: #1b5e20;
                border: 1px solid #c8e6c9;
            }}
            .badge-tipo.reserva {{
                background-color: #fff3e0;
                color: #e65100;
                border: 1px solid #ffe0b2;
            }}
            .tabela-detalhes {{
                width: 100%;
                font-size: 12px;
                border-collapse: collapse;
            }}
            .tabela-detalhes td {{
                padding: 4px 0;
                vertical-align: top;
            }}
            .tabela-detalhes td:first-child {{
                width: 140px;
                color: #444;
            }}
            .footer {{
                margin-top: 30px;
                font-size: 10px;
                color: #777;
                text-align: center;
                border-top: 1px solid #eee;
                padding-top: 10px;
            }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>CPROEIS - Governo do Estado do Rio de Janeiro</h1>
            <h2>Coordenadoria do Programa Estadual de Integração na Segurança</h2>
        </div>
        <div class="meta-info">
            <div><strong>Documento (CPF):</strong> {cpf if cpf else '-'}</div>
            <div><strong>Emissão:</strong> {data_geracao}</div>
        </div>
        <div>
            {linhas_html}
        </div>
        <div class="footer">
            Comprovante gerado automaticamente pelo assistente de automação CPROEIS.
        </div>
    </body>
    </html>
    """

    caminho_absoluto = os.path.abspath(caminho_pdf)
    pasta_destino = os.path.dirname(caminho_absoluto)
    if pasta_destino and not os.path.exists(pasta_destino):
        os.makedirs(pasta_destino, exist_ok=True)

    if page:
        pdf_page = page.context.new_page()
        pdf_page.set_content(html_content)
        pdf_page.pdf(path=caminho_absoluto, format="A4", print_background=True)
        pdf_page.close()
    else:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            pdf_page = browser.new_page()
            pdf_page.set_content(html_content)
            pdf_page.pdf(path=caminho_absoluto, format="A4", print_background=True)
            browser.close()
        
    print(f"Comprovante PDF salvo em: {caminho_pdf}")
    return caminho_pdf

if __name__ == "__main__":
    exemplo_texto = """
    ====
    Convênio: HCPM - RAS
    Evento: ENFERMAGEM CARDIOLOGIA
    Data/Hora: 19/09/2026 07:00:00
    Ponto Encontro: SUPERVISÃO DE ENFERMAGEM
    Endereço: RUA ESTÁCIO DE SÁ , Numero: 20
    Tipo de Vaga: RESERVA
    ====================================================
    """
    gerar_pdf_comprovante(exemplo_texto, "teste_comprovante.pdf", "000.000.000-00")

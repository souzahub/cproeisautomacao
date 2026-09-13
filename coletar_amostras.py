import base64
import re
import os
import sys
import time
from playwright.sync_api import sync_playwright

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

def coletar_captchas(quantidade=50):
    pasta_destino = os.path.join(os.path.dirname(__file__), "dataset_captchas")
    os.makedirs(pasta_destino, exist_ok=True)
    
    print(f"Iniciando coleta de {quantidade} imagens de captcha do CPROEIS...")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("https://proeis.rj.gov.br", wait_until="networkidle")
        page.select_option("#ddlTipoAcesso", "CPF")
        page.wait_for_selector("#txtLogin", state="visible")
        time.sleep(1)

        salvos = 0
        while salvos < quantidade:
            html = page.content()
            m = re.search(r"data:image/[^;]+;base64,([a-zA-Z0-9+/=]+)", html)
            if m:
                b64 = m.group(1)
                img_bytes = base64.b64decode(b64)
                nome_arquivo = os.path.join(pasta_destino, f"captcha_{salvos+1:03d}.png")
                with open(nome_arquivo, "wb") as f:
                    f.write(img_bytes)
                salvos += 1
                print(f"[{salvos}/{quantidade}] Imagem salva: captcha_{salvos:03d}.png")
            
            link_nova = page.query_selector("a:has-text('Gerar Nova Imagem')")
            if link_nova:
                link_nova.click()
                time.sleep(0.5)
                page.wait_for_load_state("networkidle")
            else:
                page.reload()
                page.select_option("#ddlTipoAcesso", "CPF")
                page.wait_for_selector("#txtLogin", state="visible")
                time.sleep(0.5)

        browser.close()
        print("\nColeta concluida com sucesso na pasta 'dataset_captchas'.")

if __name__ == "__main__":
    qtd = 50
    if len(sys.argv) > 1:
        try:
            qtd = int(sys.argv[1])
        except ValueError:
            pass
    coletar_captchas(qtd)

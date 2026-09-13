import os
import sys
import time
from playwright.sync_api import sync_playwright
import ddddocr
from bot import carregar_configuracao, realizar_login
from gerar_pdf import gerar_pdf_comprovante

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

def consultar():
    cfg = carregar_configuracao()
    ocr = ddddocr.DdddOcr(show_ad=False)
    
    print("Acessando o portal CPROEIS para consultar suas vagas cadastradas...")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=not cfg.get("modo_visivel", True),
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--start-maximized"
            ]
        )
        context = browser.new_context(
            no_viewport=True,
            ignore_https_errors=True,
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
        )
        page = context.new_page()
        page.set_default_timeout(60000)
        page.set_default_navigation_timeout(60000)
        
        try:
            if not realizar_login(page, ocr, cfg):
                print("Nao foi possivel efetuar login. Verifique suas credenciais.")
                return

            print("Carregando lista de eventos cadastrados...")
            btn_vol = page.query_selector("a:has-text('Voluntários'), a:has-text('Voluntarios')")
            if btn_vol:
                btn_vol.click()
                try:
                    page.wait_for_load_state("domcontentloaded", timeout=15000)
                except Exception:
                    pass
            elif "FrmMenuVoluntario.aspx" not in page.url:
                try:
                    page.goto("https://proeis.rj.gov.br/FrmMenuVoluntario.aspx", wait_until="domcontentloaded", timeout=60000)
                except Exception:
                    page.goto("https://proeis.rj.gov.br/FrmMenuVoluntario.aspx", timeout=60000)
            time.sleep(2)

            chk_mes = page.query_selector("#chkEveMes")
            if chk_mes:
                chk_mes.click()
                try:
                    page.wait_for_load_state("domcontentloaded", timeout=15000)
                except Exception:
                    pass
                time.sleep(2)

            textarea = page.query_selector("#txtEveVoluntario")
            conteudo = textarea.input_value() if textarea else ""
            
            if conteudo.strip():
                print("\n" + "="*60)
                print("          VAGAS CONFIRMADAS NO CPROEIS")
                print("="*60 + "\n")
                
                linhas = [l.strip() for l in conteudo.split("\n") if l.strip()]
                for linha in linhas:
                    if "====" in linha:
                        print("-" * 60)
                    else:
                        print(linha)
                print("\n" + "="*60)
            else:
                print("Nenhum evento registrado encontrado no periodo.")

            caminho_pdf = gerar_pdf_comprovante(conteudo, "comprovantes/comprovante_vagas.pdf", cfg.get("documento", ""), page=page)
            print(f"Comprovante PDF salvo em: {caminho_pdf}")

        except Exception as e:
            print(f"Ocorreu um erro na consulta: {str(e)}")
        finally:
            print("\nConsulta finalizada.")
            time.sleep(3)
            browser.close()

if __name__ == "__main__":
    consultar()


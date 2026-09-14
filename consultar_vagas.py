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
    
    launch_options = {
        "headless": not cfg.get("modo_visivel", True),
        "args": [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--start-maximized"
        ]
    }
    if cfg.get("proxy"):
        launch_options["proxy"] = {"server": cfg["proxy"]}

    def executar_consulta(usar_proxy=True):
        opts = dict(launch_options)
        if not usar_proxy and "proxy" in opts:
            del opts["proxy"]

        with sync_playwright() as p:
            browser = p.chromium.launch(**opts)
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
                    browser.close()
                    return False

                print("Carregando lista de eventos cadastrados...")
                btn_vol = page.query_selector("a:has-text('Voluntários'), a:has-text('Voluntarios')")
                if btn_vol:
                    btn_vol.click()
                    time.sleep(2)
                    try:
                        page.wait_for_load_state("networkidle", timeout=15000)
                    except Exception:
                        pass

                btn_meus = page.query_selector("a:has-text('Meus Eventos')")
                if btn_meus:
                    btn_meus.click()
                    time.sleep(2)
                    try:
                        page.wait_for_load_state("networkidle", timeout=15000)
                    except Exception:
                        pass

                chk_mes = page.query_selector("#chkEveMes")
                if chk_mes:
                    chk_mes.click()
                    time.sleep(2)
                    try:
                        page.wait_for_load_state("domcontentloaded", timeout=15000)
                    except Exception:
                        pass

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

                caminho_pdf = gerar_pdf_comprovante(page, cfg)
                if caminho_pdf:
                    print(f"Comprovante PDF gerado com sucesso: {caminho_pdf}")
                else:
                    print("Consulta finalizada.")

                browser.close()
                return True

            except Exception as e:
                if "ERR_PROXY" in str(e) or "proxy" in str(e).lower():
                    print("Proxy offline ou recusado. Tentando conexao direta...")
                    try:
                        browser.close()
                    except Exception:
                        pass
                    return "retry_direct"
                print(f"Ocorreu um erro na consulta: {str(e)}")
                try:
                    browser.close()
                except Exception:
                    pass
                return False

    res = executar_consulta(usar_proxy=bool(cfg.get("proxy")))
    if res == "retry_direct":
        executar_consulta(usar_proxy=False)

if __name__ == "__main__":
    consultar()

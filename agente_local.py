import os
import sys
import time
import requests
from dotenv import load_dotenv
from bot import carregar_configuracao, buscar_e_candidatar, navegar_para_inscricao, realizar_login
from consultar_vagas import consultar
from gerar_pdf import gerar_pdf_comprovante
from playwright.sync_api import sync_playwright
import ddddocr

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

load_dotenv()

SERVER_URL = os.getenv("SERVER_URL", "https://cprsautomacao.devsouza.online").rstrip("/")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "luansouza88@gmail.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Souz@199133")

def autenticar():
    email = ADMIN_EMAIL
    senha = ADMIN_PASSWORD
    
    url = f"{SERVER_URL}/api/auth/login"
    try:
        resp = requests.post(url, json={"email": email, "password": senha}, timeout=15)
        if resp.status_code == 200:
            return resp.json().get("access_token")
    except Exception as e:
        print(f"erro ao conectar no servidor {SERVER_URL}: {str(e)}")
        return None

    print(f"\ncredenciais automaticas ({email}) nao foram aceitas pelo servidor.")
    for tentativa in range(3):
        print(f"\ntentativa {tentativa + 1}/3:")
        email_digitado = input("digite seu email do painel web: ").strip()
        senha_digitada = input("digite sua senha do painel web: ").strip()
        
        try:
            resp = requests.post(url, json={"email": email_digitado, "password": senha_digitada}, timeout=15)
            if resp.status_code == 200:
                print("login efetuado com sucesso.")
                return resp.json().get("access_token")
            else:
                print(f"email ou senha incorretos ({resp.text}).")
        except Exception as e:
            print(f"erro ao autenticar: {str(e)}")
            
    return None

def listar_clientes(token):
    url = f"{SERVER_URL}/api/clients"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        if resp.status_code == 200:
            return resp.json()
        print(f"falha ao buscar clientes: {resp.text}")
    except Exception as e:
        print(f"erro ao listar clientes: {str(e)}")
    return []

def montar_config_cliente(cliente, modo="homologacao"):
    cfg = carregar_configuracao()
    cfg["tipo_documento"] = cliente.get("document_type") or "CPF"
    cfg["documento"] = cliente.get("document") or ""
    cfg["senha"] = cliente.get("password") or ""
    cfg["convenio"] = cliente.get("convenio") or "HCPM - RAS"
    cfg["tipo_data"] = cliente.get("tipo_data") or "dias_frente"
    cfg["data_inicio"] = cliente.get("data_inicio") or ""
    cfg["data_fim"] = cliente.get("data_fim") or ""
    cfg["meta_vagas"] = cliente.get("meta_vagas") if cliente.get("meta_vagas") is not None else 1
    cfg["dias_inicial"] = cliente.get("days_forward_initial") or 6
    cfg["dias_maximo"] = cliente.get("days_forward_max") or 7
    
    eventos_str = cliente.get("preferred_events") or ""
    cfg["eventos_preferidos"] = [e.strip() for e in eventos_str.replace(";", ",").split(",") if e.strip()]
    cfg["apenas_eventos_listados"] = bool(cliente.get("only_listed_events", False))
    cfg["apenas_titular"] = bool(cliente.get("only_titular", False))
    cfg["intervalo_segundos"] = cliente.get("interval_seconds") or 6
    cfg["tentativas_maximas"] = cliente.get("max_attempts") or 120
    cfg["modo_homologacao"] = modo == "homologacao"
    cfg["modo_visivel"] = False
    return cfg

def executar_bot_cliente(cliente, modo="homologacao"):
    print(f"\niniciando automacao para: {cliente.get('name')} ({cliente.get('document')})")
    print(f"modo: {modo} | convenio: {cliente.get('convenio')} | meta: {cliente.get('meta_vagas', 1)} vaga(s)")
    
    cfg = montar_config_cliente(cliente, modo)
    ocr = ddddocr.DdddOcr(show_ad=False)
    
    launch_options = {
        "headless": True,
        "args": ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
    }
    
    with sync_playwright() as p:
        browser = p.chromium.launch(**launch_options)
        context = browser.new_context(ignore_https_errors=True)
        page = context.new_page()
        page.set_default_timeout(60000)
        page.set_default_navigation_timeout(60000)
        
        try:
            sucesso = realizar_login(page, ocr, cfg)
            if not sucesso:
                print("falha no login. verifique as credenciais do cliente.")
                return False
            
            navegar_para_inscricao(page)
            resultado = buscar_e_candidatar(page, ocr, cfg)
            return resultado
        except Exception as e:
            print(f"ocorreu um erro durante a execucao: {str(e)}")
            return False
        finally:
            time.sleep(3)
            browser.close()

def executar_consulta_cliente(cliente):
    print(f"\niniciando consulta de vagas para: {cliente.get('name')} ({cliente.get('document')})")
    
    cfg = montar_config_cliente(cliente)
    ocr = ddddocr.DdddOcr(show_ad=False)
    
    launch_options = {
        "headless": True,
        "args": ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
    }
    
    with sync_playwright() as p:
        browser = p.chromium.launch(**launch_options)
        context = browser.new_context(ignore_https_errors=True)
        page = context.new_page()
        page.set_default_timeout(60000)
        page.set_default_navigation_timeout(60000)
        
        try:
            if not realizar_login(page, ocr, cfg):
                print("nao foi possivel efetuar login. verifique as credenciais.")
                return False
            
            print("carregando lista de eventos cadastrados...")
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
                    pass
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
                print("          vagas confirmadas no cproeis")
                print("="*60 + "\n")
                linhas = [l.strip() for l in conteudo.split("\n") if l.strip()]
                for linha in linhas:
                    if "====" in linha:
                        print("-" * 60)
                    else:
                        print(linha)
                print("\n" + "="*60)
            else:
                print("nenhum evento registrado encontrado no periodo.")
            
            nome_arq = f"comprovantes/comprovante_{cliente.get('document', 'cliente').replace('.', '').replace('-', '')}.pdf"
            caminho_pdf = gerar_pdf_comprovante(conteudo, nome_arq, cliente.get("document", ""), page=page)
            print(f"comprovante pdf salvo em: {caminho_pdf}")
            return True
        except Exception as e:
            print(f"ocorreu um erro na consulta: {str(e)}")
            return False
        finally:
            time.sleep(3)
            browser.close()

def menu_principal():
    print("=" * 60)
    print("   agente local cproeis (consumo de dados da nuvem)")
    print(f"   servidor: {SERVER_URL}")
    print("=" * 60)
    
    print("\nconectando ao servidor online...")
    token = autenticar()
    if not token:
        print("nao foi possivel conectar ao servidor online. verifique sua conexao e credenciais.")
        input("\npressione enter para fechar...")
        return
    
    print("autenticado no servidor online com sucesso.")
    
    while True:
        clientes = listar_clientes(token)
        print("\n" + "-" * 60)
        print("clientes disponiveis no servidor:")
        if not clientes:
            print("  (nenhum cliente cadastrado no servidor online)")
        else:
            for idx, c in enumerate(clientes, 1):
                status_str = "ativo" if c.get("is_active") else "inativo"
                print(f"  [{idx}] {c.get('name')} - {c.get('document')} ({c.get('convenio')}) [{status_str}]")
        print("-" * 60)
        print("opcoes:")
        print("  [1] executar automacao para um cliente (homologacao)")
        print("  [2] executar automacao para um cliente (producao)")
        print("  [3] consultar vagas confirmadas e gerar pdf para um cliente")
        print("  [4] executar todos os clientes ativos em sequencia")
        print("  [5] atualizar lista de clientes")
        print("  [0] sair")
        
        opcao = input("\nescolha uma opcao: ").strip()
        
        if opcao == "0":
            print("encerrando agente.")
            break
        elif opcao == "5":
            continue
        elif opcao in ["1", "2", "3"]:
            if not clientes:
                print("cadastre clientes no painel web primeiro.")
                continue
            num_cli = input(f"digite o numero do cliente (1 a {len(clientes)}): ").strip()
            try:
                idx_sel = int(num_cli) - 1
                if 0 <= idx_sel < len(clientes):
                    cliente_sel = clientes[idx_sel]
                    if opcao == "1":
                        executar_bot_cliente(cliente_sel, modo="homologacao")
                    elif opcao == "2":
                        executar_bot_cliente(cliente_sel, modo="producao")
                    elif opcao == "3":
                        executar_consulta_cliente(cliente_sel)
                else:
                    print("numero de cliente invalido.")
            except ValueError:
                print("valor digitado invalido.")
        elif opcao == "4":
            ativos = [c for c in clientes if c.get("is_active")]
            if not ativos:
                print("nenhum cliente ativo encontrado.")
                continue
            modo_rodar = input("modo para todos (1 para homologacao, 2 para producao): ").strip()
            modo_str = "producao" if modo_rodar == "2" else "homologacao"
            print(f"\niniciando execucao em lote para {len(ativos)} cliente(s) ativo(s) em modo {modo_str}...")
            for c in ativos:
                executar_bot_cliente(c, modo=modo_str)
                time.sleep(3)
        else:
            print("opcao invalida.")

if __name__ == "__main__":
    menu_principal()

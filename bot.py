import os
import sys
import time
import base64
import json
import urllib.request
import re
from datetime import date, timedelta, datetime
import cv2
import numpy as np
import ddddocr
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

def carregar_configuracao():
    load_dotenv()
    
    url = os.getenv("PROEIS_URL", "https://www.proeis.rj.gov.br/")
    tipo_doc = os.getenv("TIPO_DOCUMENTO", "CPF")
    cpf = os.getenv("CPF", "")
    senha = os.getenv("SENHA", "")
    convenio = os.getenv("CONVENIO", "HCPM - RAS")
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    gemini_model = os.getenv("GEMINI_MODEL", "antigravity99").strip()
    
    tipo_data = os.getenv("TIPO_DATA", "dias_frente").strip()
    data_inicio = os.getenv("DATA_INICIO", "").strip()
    data_fim = os.getenv("DATA_FIM", "").strip()
    meta_vagas = int(os.getenv("META_VAGAS", "1"))
    
    dias_ini = int(os.getenv("DIAS_A_FRENTE_INICIAL", os.getenv("DIAS_A_FRENTE", "5")))
    dias_max = int(os.getenv("DIAS_A_FRENTE_MAXIMO", str(dias_ini + 2)))
    
    eventos_raw = os.getenv("EVENTOS_PREFERIDOS", os.getenv("NOME_EVENTO", ""))
    eventos_lista = [e.strip() for e in re.split(r"[,;]", eventos_raw) if e.strip()]
    
    horarios_raw = os.getenv("HORARIOS_PREFERIDOS", "")
    horarios_lista = [h.strip() for h in re.split(r"[,;]", horarios_raw) if h.strip()]
    
    apenas_listados = os.getenv("APENAS_EVENTOS_LISTADOS", "false").lower() == "true"
    apenas_titular = os.getenv("APENAS_TITULAR", "false").lower() == "true"
    intervalo = int(os.getenv("INTERVALO_SEGUNDOS", "5"))
    tentativas = int(os.getenv("TENTATIVAS_MAXIMAS", "120"))
    modo_visivel = os.getenv("MODO_VISIVEL", "true").lower() == "true"
    modo_homologacao = os.getenv("MODO_HOMOLOGACAO", "false").lower() == "true"
    
    proxy = os.getenv("PROXY_SERVER", os.getenv("HTTP_PROXY", "")).strip()
    ai_base_url = os.getenv("AI_BASE_URL", "").strip()
    
    return {
        "url": url,
        "tipo_documento": tipo_doc,
        "documento": cpf,
        "senha": senha,
        "convenio": convenio,
        "tipo_data": tipo_data,
        "data_inicio": data_inicio,
        "data_fim": data_fim,
        "meta_vagas": meta_vagas,
        "dias_inicial": dias_ini,
        "dias_maximo": dias_max,
        "eventos_preferidos": eventos_lista,
        "horarios_preferidos": horarios_lista,
        "apenas_eventos_listados": apenas_listados,
        "apenas_titular": apenas_titular,
        "intervalo_segundos": intervalo,
        "tentativas_maximas": tentativas,
        "modo_visivel": modo_visivel,
        "modo_homologacao": modo_homologacao,
        "gemini_api_key": gemini_key,
        "gemini_model": gemini_model,
        "ai_base_url": ai_base_url,
        "proxy": proxy
    }

def resolver_captcha_gemini(img_bytes, api_key, modelo_preferido, ai_base_url=""):
    if not api_key:
        return ""
    b64_img = base64.b64encode(img_bytes).decode("utf-8")
    clean_key = api_key.strip()
    base_url = (ai_base_url or os.getenv("AI_BASE_URL", "") or "https://9router.devsouza.online/v1").strip().rstrip("/")

    def extrair_codigo(texto):
        if not texto:
            return ""
        limpo = re.sub(r"[^a-zA-Z0-9]", "", texto).upper().strip()
        if len(limpo) == 6:
            return limpo
        m = re.search(r"[A-Za-z0-9]{6}", texto)
        return m.group(0).upper() if m else (limpo[:6] if len(limpo) >= 6 else "")

    if base_url:
        target_url = base_url if base_url.endswith("/chat/completions") else f"{base_url}/chat/completions"
        candidate_models = []
        if modelo_preferido and modelo_preferido.strip():
            candidate_models.append(modelo_preferido.strip())
        for fallback_m in ["antigravity99", "myCombo", "gpt1", "ag/gemini-3.7-flash", "ag/gemini-3.8-flash"]:
            if fallback_m not in candidate_models:
                candidate_models.append(fallback_m)

        for chosen_model in candidate_models:
            try:
                payload = {
                    "model": chosen_model,
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": "Retorne estritamente apenas os 6 caracteres alfanumericos do captcha desta imagem, em maiusculo, sem espacos e sem pontuacao."},
                                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64_img}"}}
                            ]
                        }
                    ],
                    "temperature": 0.0,
                    "stream": False
                }
                req_headers = {"Content-Type": "application/json"}
                if clean_key:
                    req_headers["Authorization"] = f"Bearer {clean_key}"
                req = urllib.request.Request(
                    target_url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers=req_headers
                )
                with urllib.request.urlopen(req, timeout=15) as resp:
                    resp_raw = resp.read().decode("utf-8")
                    texto = ""
                    try:
                        data = json.loads(resp_raw)
                        texto = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                    except Exception:
                        for line in resp_raw.splitlines():
                            line = line.strip()
                            if line.startswith("data:"):
                                chunk_str = line[5:].strip()
                                if chunk_str and chunk_str != "[DONE]":
                                    try:
                                        chunk_data = json.loads(chunk_str)
                                        delta = chunk_data.get("choices", [{}])[0].get("delta", {})
                                        content_part = delta.get("content", "")
                                        if content_part:
                                            texto += content_part
                                    except Exception:
                                        pass
                    codigo = extrair_codigo(texto)
                    if len(codigo) == 6:
                        return codigo
            except Exception:
                continue

    if clean_key.startswith("sk-or-"):
        try:
            chosen_model = modelo_preferido.strip() if (modelo_preferido and "/" in modelo_preferido) else "google/gemini-2.5-flash"
            payload = {
                "model": chosen_model,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "Retorne estritamente apenas os 6 caracteres alfanumericos do captcha desta imagem, em maiusculo, sem espacos e sem pontuacao."},
                            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64_img}"}}
                        ]
                    }
                ],
                "temperature": 0.0
            }
            req = urllib.request.Request(
                "https://openrouter.ai/api/v1/chat/completions",
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {clean_key}",
                    "Content-Type": "application/json"
                }
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                texto = data["choices"][0]["message"]["content"]
                codigo = extrair_codigo(texto)
                if len(codigo) == 6:
                    return codigo
        except Exception:
            pass
        return ""

    if clean_key.startswith("sk-"):
        try:
            chosen_model = modelo_preferido.strip() if (modelo_preferido and "/" not in modelo_preferido) else "gpt-4o-mini"
            payload = {
                "model": chosen_model,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "Retorne estritamente apenas os 6 caracteres alfanumericos do captcha desta imagem, em maiusculo, sem espacos e sem pontuacao."},
                            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64_img}"}}
                        ]
                    }
                ],
                "temperature": 0.0
            }
            req = urllib.request.Request(
                "https://api.openai.com/v1/chat/completions",
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {clean_key}",
                    "Content-Type": "application/json"
                }
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                texto = data["choices"][0]["message"]["content"]
                codigo = extrair_codigo(texto)
                if len(codigo) == 6:
                    return codigo
        except Exception:
            pass
        return ""

    candidate_models = []
    if modelo_preferido and modelo_preferido.strip():
        raw_m = modelo_preferido.strip().replace("models/", "")
        candidate_models.append(raw_m)

    for m in ["gemini-3.7-flash", "gemini-2.5-flash", "gemini-2.0-flash"]:
        if m not in candidate_models:
            candidate_models.append(m)

    payload = {
        "contents": [{
            "parts": [
                {"text": "Retorne estritamente apenas os 6 caracteres alfanumericos do captcha desta imagem, em maiusculo, sem espacos, sem pontuacao e sem qualquer outra palavra."},
                {"inlineData": {"mimeType": "image/png", "data": b64_img}}
            ]
        }],
        "generationConfig": {
            "temperature": 0.0,
            "thinkingConfig": {"thinkingBudget": 0}
        }
    }

    for target_model in candidate_models:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent"
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "x-goog-api-key": clean_key
                }
            )
            with urllib.request.urlopen(req, timeout=35) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                texto = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                codigo = extrair_codigo(texto)
                if len(codigo) == 6:
                    return codigo
        except Exception:
            continue

    return ""

def resolver_captcha_local(img_bytes, ocr):
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
    if img is None:
        return ""

    if len(img.shape) == 3 and img.shape[2] == 4:
        bg = np.ones((img.shape[0], img.shape[1], 3), dtype=np.uint8) * 255
        alpha = img[:, :, 3] / 255.0
        for c in range(3):
            bg[:, :, c] = (alpha * img[:, :, c] + (1 - alpha) * 255).astype(np.uint8)
        img = bg

    denoised = cv2.fastNlMeansDenoisingColored(img, None, 10, 10, 7, 21)
    gray = cv2.cvtColor(denoised, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(denoised, cv2.COLOR_BGR2HSV)

    candidatos_seis = []
    outros_candidatos = []

    for th in [215, 205, 195, 185, 175]:
        _, thresh = cv2.threshold(gray, th, 255, cv2.THRESH_BINARY_INV)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        clean = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
        clean = cv2.morphologyEx(clean, cv2.MORPH_DILATE, kernel)
        
        _, buf = cv2.imencode(".png", clean)
        raw = ocr.classification(buf.tobytes())
        txt = re.sub(r"[^a-zA-Z0-9]", "", str(raw)).upper()
        if len(txt) == 6:
            candidatos_seis.append(txt)
        elif len(txt) >= 4:
            outros_candidatos.append(txt)

    s = hsv[:, :, 1]
    for s_th in [30, 45, 60]:
        _, s_mask = cv2.threshold(s, s_th, 255, cv2.THRESH_BINARY)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        s_clean = cv2.morphologyEx(s_mask, cv2.MORPH_OPEN, kernel)
        _, buf = cv2.imencode(".png", s_clean)
        raw = ocr.classification(buf.tobytes())
        txt = re.sub(r"[^a-zA-Z0-9]", "", str(raw)).upper()
        if len(txt) == 6:
            candidatos_seis.append(txt)
        elif len(txt) >= 4:
            outros_candidatos.append(txt)

    if candidatos_seis:
        from collections import Counter
        return Counter(candidatos_seis).most_common(1)[0][0]

    return outros_candidatos[0] if outros_candidatos else ""

def extrair_captcha_pagina(page):
    try:
        html = page.content()
        matches = re.findall(r"data:image/[^;]+;base64,([a-zA-Z0-9+/=]{100,})", html)
        if matches:
            return base64.b64decode(matches[-1])
    except Exception:
        pass

    elementos = []
    for _ in range(3):
        try:
            elementos = page.query_selector_all("img[src*='data:image'], div[style*='data:image'], img[id*='Captcha'], img[src*='Captcha'], #imgCaptcha, div[id*='Captcha'] img")
            if elementos:
                break
        except Exception:
            time.sleep(0.5)

    for el in reversed(elementos):
        try:
            box = el.bounding_box()
            if box and box["width"] > 40 and box["height"] > 20:
                style = el.get_attribute("style") or ""
                m_style = re.search(r"data:image/[^;]+;base64,([a-zA-Z0-9+/=]+)", style)
                if m_style:
                    return base64.b64decode(m_style.group(1))
                
                src = el.get_attribute("src") or ""
                m_src = re.search(r"data:image/[^;]+;base64,([a-zA-Z0-9+/=]+)", src)
                if m_src:
                    return base64.b64decode(m_src.group(1))
                
                return el.screenshot()
        except Exception:
            continue

    try:
        fallback_el = page.query_selector("#divCaptcha, div[id*='Captcha'], #lnkNewCaptcha")
        if fallback_el:
            return fallback_el.screenshot()
    except Exception:
        pass
            
    return None

def garantir_formulario_login(page, tipo_doc="CPF"):
    try:
        if not page.is_visible("#txtSenha"):
            page.wait_for_selector("#ddlTipoAcesso", timeout=15000)
            page.select_option("#ddlTipoAcesso", tipo_doc)
            page.wait_for_selector("#txtSenha", state="visible", timeout=15000)
            time.sleep(1)
        return True
    except Exception:
        return False

def obter_captcha(page, ocr, cfg, tipo_doc="CPF"):
    def regenerar_imagem():
        try:
            link_nova_img = page.query_selector("#lnkNewCaptcha, a:has-text('Gerar Nova Imagem')")
            if link_nova_img:
                link_nova_img.click()
                time.sleep(1.5)
                page.wait_for_load_state("networkidle")
                return True
        except Exception:
            pass
        return False

    garantir_formulario_login(page, tipo_doc)
    captcha_bytes = extrair_captcha_pagina(page)
    if not captcha_bytes:
        for _ in range(2):
            if not regenerar_imagem():
                break
            captcha_bytes = extrair_captcha_pagina(page)
            if captcha_bytes:
                break
    if not captcha_bytes:
        return ""

    def resolver_com_gemini(captcha_bytes):
        if cfg.get("gemini_api_key"):
            codigo = resolver_captcha_gemini(
                captcha_bytes,
                cfg["gemini_api_key"],
                cfg.get("gemini_model", "antigravity99"),
                ai_base_url=cfg.get("ai_base_url", "")
            )
            if len(codigo) == 6:
                return codigo
        return ""

    ultimo_local = ""
    for _ in range(3):
        codigo = resolver_com_gemini(captcha_bytes)
        if codigo:
            return codigo

        codigo = resolver_captcha_local(captcha_bytes, ocr)
        if len(codigo) == 6:
            return codigo
        elif codigo:
            ultimo_local = codigo

        if not regenerar_imagem():
            break
        captcha_bytes = extrair_captcha_pagina(page)
        if not captcha_bytes:
            break
        time.sleep(1)

    codigo = resolver_com_gemini(captcha_bytes)
    if codigo:
        return codigo

    return ultimo_local if len(ultimo_local) == 6 else ""

def realizar_login(page, ocr, cfg):
    print("Iniciando acesso ao portal CPROEIS...")
    url = cfg.get("url", "https://www.proeis.rj.gov.br/").strip()
    if not url:
        url = "https://www.proeis.rj.gov.br/"
    
    if "proeis.rj.gov.br" in url and "www.proeis.rj.gov.br" not in url:
        url = url.replace("proeis.rj.gov.br", "www.proeis.rj.gov.br")
    if not url.startswith("http"):
        url = f"https://{url}"

    def on_dialog(dialog):
        print(f"Alerta do portal: {dialog.message}")
        try:
            dialog.accept()
        except Exception:
            pass

    try:
        page.on("dialog", on_dialog)
    except Exception:
        pass

    try:
        page.goto(url, wait_until="domcontentloaded", timeout=25000)
    except Exception as e:
        print(f"Tentando conexao direta com login: {str(e)}")
        try:
            page.goto("https://www.proeis.rj.gov.br/", wait_until="commit", timeout=20000)
        except Exception:
            pass
    try:
        page.wait_for_load_state("domcontentloaded", timeout=10000)
    except Exception:
        pass
    
    tipo_doc = cfg.get("tipo_documento", "CPF")
    garantir_formulario_login(page, tipo_doc)

    max_login = max(1, int(cfg.get("tentativas_maximas", 10)))
    for tentativa in range(1, max_login + 1):
        print(f"\nTentativa de login {tentativa}/{max_login}...")
        garantir_formulario_login(page, tipo_doc)
        time.sleep(1)

        try:
            page.fill("#txtLogin", cfg.get("documento", ""))
            page.fill("#txtSenha", cfg.get("senha", ""))
            try:
                page.fill("#TextCaptcha", "")
            except Exception:
                pass
        except Exception as e:
            print(f"Erro ao preencher credenciais: {str(e)}")
            time.sleep(2)
            continue

        try:
            texto_captcha = obter_captcha(page, ocr, cfg, tipo_doc)
        except Exception as e:
            txt_erro = str(e)
            if "Execution context was destroyed" in txt_erro or "navigation" in txt_erro:
                print("Navegacao em andamento, aguardando estabilizar...")
                time.sleep(3)
                continue
            print(f"Erro ao obter captcha: {txt_erro}")
            time.sleep(2)
            continue
        print(f"Captcha do login decodificado: {texto_captcha}")

        if len(texto_captcha) != 6:
            print("Captcha invalido, gerando nova imagem...")
            try:
                link = page.query_selector("#lnkNewCaptcha, a:has-text('Gerar Nova Imagem')")
                if link:
                    link.click()
                    page.wait_for_load_state("networkidle")
                    time.sleep(1.5)
            except Exception:
                pass
            continue

        try:
            page.fill("#TextCaptcha", texto_captcha)
            page.click("#btnEntrar")
        except Exception as e:
            print(f"Erro ao enviar login: {str(e)}")
            time.sleep(2)
            continue

        try:
            page.wait_for_load_state("load", timeout=25000)
        except Exception:
            try:
                page.wait_for_load_state("domcontentloaded", timeout=15000)
            except Exception:
                pass
        time.sleep(2)

        url_atual = page.url
        if "FrmMenuVoluntario.aspx" in url_atual or "Menu" in url_atual:
            print("Login efetuado com sucesso.")
            return True

        try:
            erro_elem = page.query_selector("#lblMsg, .alert, font[color='Red'], span[id*='lbl']")
        except Exception:
            erro_elem = None
        if erro_elem:
            try:
                msg_erro = erro_elem.inner_text().strip()
            except Exception:
                msg_erro = ""
            if msg_erro and "sucesso" not in msg_erro.lower():
                print(f"Mensagem do portal: {msg_erro}")

    return False

def navegar_para_inscricao(page):
    print("Navegando para o modulo de inscricao...")
    botao_escala = page.query_selector("a:has-text('Escala'), input[value*='Escala'], button:has-text('Escala')")
    if botao_escala:
        botao_escala.click()
    else:
        page.goto("https://www.proeis.rj.gov.br/FrmMenuVoluntario.aspx", wait_until="networkidle")
    
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    
    botao_nova = page.query_selector("a:has-text('Nova Inscrição'), input[value*='Nova Inscrição'], button:has-text('Nova Inscrição'), a:has-text('Nova Inscricao')")
    if botao_nova:
        botao_nova.click()
    else:
        page.goto("https://www.proeis.rj.gov.br/FrmEscalaAssociar.aspx", wait_until="networkidle")
        
    page.wait_for_load_state("networkidle")
    time.sleep(1)

from gerar_pdf import gerar_pdf_comprovante

def exibir_vagas_confirmadas(page, cfg):
    print("\nVerificando vagas cadastradas no portal...")
    btn_vol = page.query_selector("a:has-text('Voluntários'), a:has-text('Voluntarios')")
    if btn_vol:
        btn_vol.click()
        page.wait_for_load_state("networkidle")
    elif "FrmMenuVoluntario.aspx" not in page.url:
        page.goto("https://www.proeis.rj.gov.br/FrmMenuVoluntario.aspx", wait_until="networkidle")
    time.sleep(2)

    chk_mes = page.query_selector("#chkEveMes")
    if chk_mes:
        chk_mes.click()
        page.wait_for_load_state("networkidle")
        time.sleep(2)

    textarea = page.query_selector("#txtEveVoluntario")
    conteudo = textarea.input_value() if textarea else ""
    
    if conteudo.strip():
        print("\n" + "="*60)
        print("          COMPROVANTE DE VAGAS CADASTRADAS NO CPROEIS")
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
    print(f"Arquivo PDF gerado: {caminho_pdf}")

def gerar_datas_alvo(cfg):
    tipo_data = cfg.get("tipo_data", "dias_frente")
    data_ini_str = (cfg.get("data_inicio") or "").strip()
    data_fim_str = (cfg.get("data_fim") or "").strip()
    
    if tipo_data == "intervalo" and data_ini_str and data_fim_str:
        try:
            if "/" in data_ini_str:
                d_i = datetime.strptime(data_ini_str, "%d/%m/%Y").date()
            else:
                d_i = datetime.strptime(data_ini_str, "%Y-%m-%d").date()
                
            if "/" in data_fim_str:
                d_f = datetime.strptime(data_fim_str, "%d/%m/%Y").date()
            else:
                d_f = datetime.strptime(data_fim_str, "%Y-%m-%d").date()
                
            if d_i > d_f:
                d_i, d_f = d_f, d_i
                
            datas = []
            cur = d_i
            while cur <= d_f:
                datas.append(cur)
                cur += timedelta(days=1)
            if datas:
                return datas
        except Exception as e:
            print(f"Aviso no intervalo de datas: {e}. Usando modo dias a frente.")

    dias_ini = cfg.get("dias_inicial", 6)
    dias_fim = max(dias_ini, cfg.get("dias_maximo", 7))
    today = date.today()
    return [today + timedelta(days=d) for d in range(dias_ini, dias_fim + 1)]

def buscar_e_candidatar(page, ocr, cfg):
    convenio_alvo = cfg.get("convenio", "")
    eventos_pref = [e.upper() for e in cfg.get("eventos_preferidos", [])]
    horarios_pref = [h.upper() for h in cfg.get("horarios_preferidos", [])]
    apenas_listados = cfg.get("apenas_eventos_listados", False)
    apenas_titular = cfg.get("apenas_titular", False)
    intervalo = cfg.get("intervalo_segundos", 5)
    max_tentativas = cfg.get("tentativas_maximas", 120)
    meta_vagas = max(1, int(cfg.get("meta_vagas", 1)))
    
    datas_alvo = gerar_datas_alvo(cfg)
    indice_dia = 0
    vagas_agendadas = 0

    if eventos_pref:
        print(f"Eventos prioritarios: {', '.join(eventos_pref)}")
    if horarios_pref:
        print(f"Horarios/Turnos prioritarios: {', '.join(horarios_pref)}")
        
    print(f"Meta de vagas configurada: {meta_vagas} vaga(s)")
    if len(datas_alvo) > 1:
        print(f"Periodo de busca: {datas_alvo[0].strftime('%d/%m/%Y')} ate {datas_alvo[-1].strftime('%d/%m/%Y')} ({len(datas_alvo)} dias no ciclo)")
    else:
        print(f"Data de busca: {datas_alvo[0].strftime('%d/%m/%Y')}")

    for ciclo in range(1, max_tentativas + 1):
        data_obj = datas_alvo[indice_dia % len(datas_alvo)]
        data_iso = data_obj.strftime("%Y-%m-%d")
        data_br = data_obj.strftime("%d/%m/%Y")
        indice_dia += 1

        print(f"\n--- Ciclo {ciclo}/{max_tentativas} | Data: {data_br} ({data_iso}) | Progresso: {vagas_agendadas}/{meta_vagas} vaga(s) ---")
        
        try:
            select_conv = page.query_selector("#ddlConvenios, select[name*='Convenio']")
            if select_conv and convenio_alvo:
                opcoes = select_conv.query_selector_all("option")
                valor_selecionar = None
                for op in opcoes:
                    texto = op.inner_text().strip()
                    if convenio_alvo.lower() in texto.lower():
                        valor_selecionar = op.get_attribute("value")
                        break
                if valor_selecionar:
                    select_conv.select_option(valor_selecionar)
                    page.wait_for_load_state("networkidle")
                    time.sleep(1)

            select_data = page.query_selector("#ddlDataEvento, select[name*='DataEvento'], select[id*='Data']")
            if select_data:
                opcoes_data = select_data.query_selector_all("option")
                valor_data = None
                for op in opcoes_data:
                    texto_op = op.inner_text().strip()
                    if data_iso in texto_op or data_br in texto_op:
                        valor_data = op.get_attribute("value")
                        break
                if valor_data:
                    select_data.select_option(valor_data)
                    page.wait_for_load_state("networkidle")
                    time.sleep(1)
                else:
                    print(f"Data {data_br} ainda nao disponivel no menu do portal.")
                    time.sleep(intervalo)
                    continue

            # Verificacao e preenchimento seguro de Captcha
            captcha_visivel = False
            try:
                captcha_visivel = page.locator("#TextCaptcha, input[name*='Captcha']").first.is_visible()
            except Exception:
                captcha_visivel = bool(page.query_selector("#TextCaptcha, input[name*='Captcha']"))

            if captcha_visivel:
                texto_c = obter_captcha(page, ocr, cfg)
                print(f"Captcha da busca decodificado: {texto_c}")
                if texto_c:
                    try:
                        page.locator("#TextCaptcha, input[name*='Captcha']").first.fill(texto_c)
                    except Exception:
                        try:
                            page.fill("#TextCaptcha", texto_c)
                        except Exception:
                            el_c = page.query_selector("#TextCaptcha, input[name*='Captcha']")
                            if el_c:
                                el_c.fill(texto_c)

            # Clique seguro no botao de filtrar/consultar
            try:
                page.locator("#btnConsultar, input[value*='Filtrar'], button:has-text('Filtrar'), input[value*='Consultar']").first.click()
            except Exception:
                btn_filtrar = page.query_selector("#btnConsultar, input[value*='Filtrar'], button:has-text('Filtrar'), input[value*='Consultar']")
                if btn_filtrar:
                    btn_filtrar.click()

            page.wait_for_load_state("networkidle")
            time.sleep(2)
        except Exception as e_busca:
            print(f"Aviso no ciclo {ciclo} ({data_br}): {str(e_busca)}. Reestabilizando pagina...")
            try:
                navegar_para_inscricao(page)
            except Exception:
                pass
            time.sleep(intervalo)
            continue

        linhas_tabela = page.query_selector_all("table tr")
        vagas_encontradas = []

        for linha in linhas_tabela:
            texto_linha = linha.inner_text()
            if "Nome Evento" in texto_linha or "Filtros" in texto_linha:
                continue
            
            botao_eu_vou = linha.query_selector("input[value*='Eu Vou'], button:has-text('Eu Vou'), a:has-text('Eu Vou')")
            if botao_eu_vou:
                colunas = linha.query_selector_all("td")
                nome_evento_linha = colunas[0].inner_text().strip().upper() if len(colunas) > 0 else texto_linha.upper()
                disp_coluna = colunas[4].inner_text().strip().upper() if len(colunas) > 4 else texto_linha.upper()

                is_titular = "RESERVA" not in disp_coluna
                
                # Checagem de Evento
                match_index = -1
                if eventos_pref:
                    for idx, pref in enumerate(eventos_pref):
                        if pref in nome_evento_linha or pref in texto_linha.upper():
                            match_index = idx
                            break
                    if apenas_listados and match_index == -1:
                        continue

                # Checagem de Horario / Turno (07 as 19, 19 as 07, etc.)
                match_horario = False
                if horarios_pref:
                    texto_linha_norm = texto_linha.upper().replace("À", "A").replace(":", "")
                    nome_evento_norm = nome_evento_linha.replace("À", "A").replace(":", "")
                    for hp in horarios_pref:
                        hp_clean = hp.strip().upper()
                        hp_norm = hp_clean.replace("À", "A").replace(":", "")
                        if hp_clean in texto_linha.upper() or hp_clean in nome_evento_linha or hp_norm in texto_linha_norm or hp_norm in nome_evento_norm:
                            match_horario = True
                            break
                        # Casos especiais de 07 as 19 e 19 as 07
                        if "07" in hp_clean and "19" in hp_clean:
                            if hp_clean.startswith("07") or hp_clean.startswith("7"):
                                if ("07" in texto_linha_norm and "19" in texto_linha_norm) or "0700" in texto_linha_norm or "07H" in texto_linha_norm or "07:00" in texto_linha.upper():
                                    match_horario = True
                                    break
                            elif hp_clean.startswith("19"):
                                if ("19" in texto_linha_norm and ("07" in texto_linha_norm or "7" in texto_linha_norm)) or "1900" in texto_linha_norm or "19H" in texto_linha_norm or "19:00" in texto_linha.upper():
                                    match_horario = True
                                    break
                        elif "07" in hp_clean or "7" in hp_clean:
                            if "07" in texto_linha.upper() or "7H" in texto_linha.upper() or "07:00" in texto_linha.upper():
                                match_horario = True
                                break
                        elif "19" in hp_clean:
                            if "19" in texto_linha.upper() or "19:00" in texto_linha.upper() or "19H" in texto_linha.upper():
                                match_horario = True
                                break
                    if apenas_listados and not match_horario:
                        continue

                pontuacao = 0
                if match_index != -1:
                    pontuacao += 1000 - (match_index * 50)
                if match_horario:
                    pontuacao += 500
                
                if is_titular:
                    pontuacao += 200

                vagas_encontradas.append({
                    "nome": nome_evento_linha,
                    "texto": texto_linha.replace("\n", " | ").strip(),
                    "botao": botao_eu_vou,
                    "is_titular": is_titular,
                    "pontuacao": pontuacao
                })

        if vagas_encontradas:
            vagas_encontradas.sort(key=lambda x: x["pontuacao"], reverse=True)
            
            for vaga in vagas_encontradas:
                if apenas_titular and not vaga["is_titular"]:
                    print(f"Vaga ignorada (apenas titular ativado): {vaga['nome']}")
                    continue
                
                if cfg.get("modo_homologacao", False):
                    vagas_agendadas += 1
                    print(f"[HOMOLOGACAO] Vaga compativel ({vagas_agendadas}/{meta_vagas}) identificada: {vaga['nome']}")
                    if vagas_agendadas >= meta_vagas:
                        print(f"[HOMOLOGACAO] Meta de {meta_vagas} vaga(s) atingida no teste.")
                        return True
                    else:
                        break

                print(f"Vaga selecionada para inscricao: {vaga['nome']}")
                vaga["botao"].click()
                page.wait_for_load_state("networkidle")
                time.sleep(2)
                
                confirm_btn = page.query_selector("input[value*='Confirmar'], button:has-text('Confirmar'), a:has-text('Confirmar')")
                if confirm_btn:
                    confirm_btn.click()
                    page.wait_for_load_state("networkidle")
                    time.sleep(1)
                    
                vagas_agendadas += 1
                print(f"Inscricao confirmada ({vagas_agendadas}/{meta_vagas} vagas agendadas): {vaga['nome']}")
                
                if vagas_agendadas >= meta_vagas:
                    print(f"Meta de {meta_vagas} vaga(s) atingida. Finalizando busca.")
                    exibir_vagas_confirmadas(page, cfg)
                    return True
                else:
                    navegar_para_inscricao(page)
                    time.sleep(intervalo)
                    break
        else:
            print(f"Nenhuma vaga compativel encontrada para o dia {data_br}. Passando para a proxima data...")

        time.sleep(intervalo)

    print(f"\nBusca finalizada: {vagas_agendadas} de {meta_vagas} vaga(s) agendada(s).")
    if vagas_agendadas > 0 and not cfg.get("modo_homologacao", False):
        exibir_vagas_confirmadas(page, cfg)
    return vagas_agendadas > 0

def main():
    cfg = carregar_configuracao()
    
    if not cfg.get("documento") or not cfg.get("senha"):
        print("Preencha as variaveis CPF e SENHA no arquivo .env antes de executar.")
        return

    ocr = ddddocr.DdddOcr(show_ad=False)

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
    def executar_bot(usar_proxy=True):
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
                sucesso_login = realizar_login(page, ocr, cfg)
                if not sucesso_login:
                    print("Falha no login. Verifique as credenciais no .env.")
                    browser.close()
                    return False

                navegar_para_inscricao(page)
                buscar_e_candidatar(page, ocr, cfg)
                
            except Exception as e:
                if "ERR_PROXY" in str(e) or "proxy" in str(e).lower():
                    print("Proxy offline ou recusado. Tentando conexao direta...")
                    browser.close()
                    return "retry_direct"
                print(f"Ocorreu um erro durante a execucao: {str(e)}")
            finally:
                print("\nExecucao finalizada.")
                time.sleep(2)
                try:
                    browser.close()
                except Exception:
                    pass
            return True

    res = executar_bot(usar_proxy=bool(cfg.get("proxy")))
    if res == "retry_direct":
        executar_bot(usar_proxy=False)

if __name__ == "__main__":
    main()

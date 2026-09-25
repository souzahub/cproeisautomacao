import os
import re
import time
import base64
import requests

def limpar_numero(numero: str) -> str:
    if not numero:
        return ""
    digits = re.sub(r"\D", "", str(numero))
    if not digits:
        return ""
    if len(digits) in (10, 11) and not digits.startswith("55"):
        digits = "55" + digits
    if len(digits) >= 10:
        return digits
    return ""

def extrair_lista_numeros(raw_numeros: str) -> list:
    if not raw_numeros:
        return []
    pedacos = re.split(r"[,;\n\r]+", str(raw_numeros))
    resultado = []
    vistos = set()
    for p in pedacos:
        num = limpar_numero(p)
        if num and num not in vistos:
            vistos.add(num)
            resultado.append(num)
    return resultado

def testar_conexao_evolution(api_url: str, instance: str, api_key: str) -> dict:
    url_base = (api_url or "").strip().rstrip("/")
    inst = (instance or "").strip()
    key = (api_key or "").strip()

    if not url_base:
        return {"success": False, "message": "url da evolution api nao informada"}
    if not inst:
        return {"success": False, "message": "nome da instancia nao informado"}
    if not key:
        return {"success": False, "message": "chave de api nao informada"}

    headers = {
        "apikey": key,
        "Content-Type": "application/json"
    }

    endpoint_estado = f"{url_base}/instance/connectionState/{inst}"
    try:
        resp = requests.get(endpoint_estado, headers=headers, timeout=12)
        if resp.status_code == 200:
            dados = resp.json() if resp.text else {}
            estado = "desconhecido"
            if isinstance(dados, dict):
                inst_data = dados.get("instance") or dados
                if isinstance(inst_data, dict):
                    estado = inst_data.get("state") or inst_data.get("connection") or "conectado"
            return {
                "success": True,
                "message": f"instancia '{inst}' conectada. estado: {estado}",
                "state": estado,
                "data": dados
            }
        elif resp.status_code == 404:
            return {
                "success": False,
                "message": f"instancia '{inst}' nao encontrada no servidor ({resp.status_code})"
            }
        elif resp.status_code in (401, 403):
            return {
                "success": False,
                "message": f"autenticacao recusada pela evolution api ({resp.status_code})"
            }
        else:
            return {
                "success": False,
                "message": f"resposta inesperada da evolution api: codigo {resp.status_code}"
            }
    except requests.exceptions.Timeout:
        return {"success": False, "message": "tempo limite esgotado ao conectar na evolution api"}
    except requests.exceptions.ConnectionError:
        return {"success": False, "message": "falha ao estabelecer conexao com a url informada"}
    except Exception as e:
        return {"success": False, "message": f"erro ao conectar: {str(e)}"}

def enviar_mensagem_whatsapp(numero: str, texto: str, api_url: str, instance: str, api_key: str) -> dict:
    num_limpo = limpar_numero(numero)
    if not num_limpo:
        return {"success": False, "message": "numero de telefone invalido"}

    url_base = (api_url or "").strip().rstrip("/")
    inst = (instance or "").strip()
    key = (api_key or "").strip()

    if not url_base or not inst or not key:
        return {"success": False, "message": "configuracao da evolution api incompleta"}

    endpoint = f"{url_base}/message/sendText/{inst}"
    headers = {
        "apikey": key,
        "Content-Type": "application/json"
    }

    payload = {
        "number": num_limpo,
        "text": texto
    }

    try:
        resp = requests.post(endpoint, json=payload, headers=headers, timeout=20)
        if resp.status_code in (200, 201):
            return {"success": True, "message": f"mensagem enviada para {num_limpo}"}
        
        payload_alt = {
            "number": num_limpo,
            "options": {"delay": 1200, "presence": "composing"},
            "textMessage": {"text": texto}
        }
        resp_alt = requests.post(endpoint, json=payload_alt, headers=headers, timeout=20)
        if resp_alt.status_code in (200, 201):
            return {"success": True, "message": f"mensagem enviada para {num_limpo}"}

        return {
            "success": False,
            "message": f"erro ao enviar para {num_limpo}: codigo {resp.status_code}"
        }
    except Exception as e:
        return {"success": False, "message": f"falha ao enviar para {num_limpo}: {str(e)}"}

def enviar_documento_whatsapp(numero: str, caminho_pdf: str, legenda: str, api_url: str, instance: str, api_key: str) -> dict:
    num_limpo = limpar_numero(numero)
    if not num_limpo:
        return {"success": False, "message": "numero de telefone invalido"}

    if not caminho_pdf or not os.path.exists(caminho_pdf):
        return {"success": False, "message": "arquivo de comprovante pdf nao encontrado"}

    url_base = (api_url or "").strip().rstrip("/")
    inst = (instance or "").strip()
    key = (api_key or "").strip()

    if not url_base or not inst or not key:
        return {"success": False, "message": "configuracao da evolution api incompleta"}

    try:
        with open(caminho_pdf, "rb") as f:
            pdf_bytes = f.read()
        b64_raw = base64.b64encode(pdf_bytes).decode("utf-8")
        b64_uri = f"data:application/pdf;base64,{b64_raw}"
        nome_arquivo = os.path.basename(caminho_pdf)
    except Exception as e:
        return {"success": False, "message": f"falha ao processar arquivo pdf: {str(e)}"}

    endpoint = f"{url_base}/message/sendMedia/{inst}"
    headers = {
        "apikey": key,
        "Content-Type": "application/json"
    }

    payloads = [
        {
            "number": num_limpo,
            "mediatype": "document",
            "mimetype": "application/pdf",
            "caption": legenda or "comprovante de inscricao cproeis",
            "media": b64_uri,
            "fileName": nome_arquivo
        },
        {
            "number": num_limpo,
            "mediaType": "document",
            "mimetype": "application/pdf",
            "caption": legenda or "comprovante de inscricao cproeis",
            "media": b64_uri,
            "fileName": nome_arquivo
        },
        {
            "number": num_limpo,
            "options": {"delay": 1200, "presence": "composing"},
            "mediaMessage": {
                "mediatype": "document",
                "caption": legenda or "comprovante de inscricao cproeis",
                "media": b64_uri,
                "fileName": nome_arquivo
            }
        },
        {
            "number": num_limpo,
            "mediatype": "document",
            "mimetype": "application/pdf",
            "caption": legenda or "comprovante de inscricao cproeis",
            "media": b64_raw,
            "fileName": nome_arquivo
        }
    ]

    last_error = ""
    for p in payloads:
        try:
            resp = requests.post(endpoint, json=p, headers=headers, timeout=30)
            if resp.status_code in (200, 201):
                return {"success": True, "message": f"comprovante enviado para {num_limpo}"}
            last_error = f"codigo {resp.status_code}: {resp.text[:120]}"
        except Exception as e:
            last_error = str(e)

    return {
        "success": False,
        "message": f"falha ao enviar documento para {num_limpo}: {last_error}"
    }

def disparar_notificacoes_whatsapp(
    numeros_raw: str,
    texto: str = "",
    caminho_pdf: str = None,
    legenda: str = None,
    api_url: str = None,
    instance: str = None,
    api_key: str = None,
    delay_segundos: int = 5
) -> dict:
    url_base = (api_url or os.getenv("EVOLUTION_API_URL") or "").strip()
    inst = (instance or os.getenv("EVOLUTION_INSTANCE") or "").strip()
    key = (api_key or os.getenv("EVOLUTION_API_KEY") or "").strip()

    if not url_base or not inst or not key:
        return {"success": False, "message": "credenciais evolution api nao configuradas", "enviados": 0}

    lista = extrair_lista_numeros(numeros_raw)
    if not lista:
        return {"success": False, "message": "nenhum numero valido informado", "enviados": 0}

    total = len(lista)
    enviados_sucesso = 0
    erros = []

    for idx, num in enumerate(lista):
        sucesso_num = True

        if texto and texto.strip():
            res_txt = enviar_mensagem_whatsapp(num, texto.strip(), url_base, inst, key)
            if not res_txt.get("success"):
                sucesso_num = False
                erros.append(f"{num}: {res_txt.get('message')}")

        if caminho_pdf and os.path.exists(caminho_pdf):
            if texto and texto.strip():
                time.sleep(2)
            res_doc = enviar_documento_whatsapp(num, caminho_pdf, legenda, url_base, inst, key)
            if not res_doc.get("success"):
                sucesso_num = False
                erros.append(f"{num} (pdf): {res_doc.get('message')}")

        if sucesso_num:
            enviados_sucesso += 1

        if idx < total - 1:
            time.sleep(max(1, delay_segundos))

    return {
        "success": enviados_sucesso > 0,
        "total": total,
        "enviados": enviados_sucesso,
        "erros": erros,
        "message": f"envio finalizado: {enviados_sucesso} de {total} destinatarios notificados"
    }

def parse_vagas_from_text(logs_or_text: str) -> list:
    if not logs_or_text or not isinstance(logs_or_text, str):
        return []

    lines = [re.sub(r"^\[\d{2}:\d{2}:\d{2}\]\s*", "", l).strip() for l in logs_or_text.split("\n")]
    
    events = []
    current = {}
    for line in lines:
        if "====" in line or "-----" in line:
            if current and ("evento" in current or "convenio" in current):
                if not any(e.get("evento") == current.get("evento") and e.get("data_hora") == current.get("data_hora") for e in events):
                    events.append(current)
                current = {}
            continue
        
        if ":" in line:
            parts = line.split(":", 1)
            k = parts[0].strip()
            v = parts[1].strip()
            
            k_norm = k.replace("ê", "e").replace("é", "e").lower()
            if k_norm in ("convenio", "convênio"):
                current["convenio"] = v
            elif k_norm == "evento":
                current["evento"] = v
            elif k_norm in ("data/hora", "data e hora", "data"):
                current["data_hora"] = v
            elif k_norm in ("ponto encontro", "ponto de encontro"):
                current["ponto"] = v
            elif k_norm in ("endereco", "endereço"):
                current["endereco"] = v
            elif k_norm in ("tipo de vaga", "tipo", "situacao", "situação"):
                current["tipo"] = v
    
    if current and ("evento" in current or "convenio" in current):
        if not any(e.get("evento") == current.get("evento") and e.get("data_hora") == current.get("data_hora") for e in events):
            events.append(current)

    if events:
        return events

    extracted = []
    current_data = ""
    current_conv = ""
    for l in lines:
        d_match = re.search(r"(?:Data:\s*|data:\s*|pesquisada:\s*)(\d{2}/\d{2}/\d{4})", l, re.IGNORECASE)
        if d_match:
            current_data = d_match.group(1)
        conv_match = re.search(r"Conv[eê]nio:\s*([^|\n]+)", l, re.IGNORECASE)
        if conv_match:
            current_conv = conv_match.group(1).strip()
            
        if any(pat in l.lower() for pat in ["vaga compatível", "inscrição confirmada", "vaga identificada", "vaga selecionada", "confirmada:"]):
            if any(ign in l for ign in ["Busca finalizada", "Meta de", "Execucao finalizada"]):
                continue
            ev_nome = l
            for token in ["identificada:", "agendadas):", "confirmada:", "selecionada:", "):"]:
                if token in ev_nome:
                    ev_nome = ev_nome.split(token, 1)[1]
                    break
            ev_nome = re.sub(r"^\[.*?\]\s*", "", ev_nome).strip()
            ev_nome = re.sub(r"\(teste.*?\)", "", ev_nome, flags=re.IGNORECASE).strip()
            if len(ev_nome) >= 3 and not any(x["evento"] == ev_nome and x.get("data_hora") == current_data for x in extracted):
                is_res = "reserva" in l.lower() or "reserva" in ev_nome.lower()
                extracted.append({
                    "evento": ev_nome,
                    "convenio": current_conv or "HCPM - RAS",
                    "data_hora": current_data or "-",
                    "tipo": "RESERVA" if is_res else "TITULAR"
                })
    return extracted

def formatar_resumo_vagas_wpp(vagas: list) -> str:
    if not vagas:
        return "Nenhuma vaga confirmada registrada nesta execução."
    
    total = len(vagas)
    titulares = sum(1 for v in vagas if (v.get("tipo") or "").upper() == "TITULAR")
    reservas = total - titulares

    linhas = [
        f"Total de vagas confirmadas: {total}",
        f"• Titulares: {titulares}",
        f"• Reservas: {reservas}",
        "",
        "Detalhamento das vagas:"
    ]

    for i, v in enumerate(vagas, 1):
        nome = v.get("evento") or "Evento CPROEIS"
        conv = v.get("convenio") or "-"
        dh = v.get("data_hora") or "-"
        tipo = (v.get("tipo") or "Titular").capitalize()
        linhas.append(f"{i}. *{nome}*")
        if conv and conv != "-":
            linhas.append(f"   • Convênio: {conv}")
        if dh and dh != "-":
            linhas.append(f"   • Data/Horário: {dh}")
        linhas.append(f"   • Situação: {tipo}")
        linhas.append("")

    return "\n".join(linhas).rstrip()

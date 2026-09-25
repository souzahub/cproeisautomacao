import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..config import ENV_PATH, BASE_DIR
from ..database import get_db
from ..models import User
from ..schemas import BotSettingsSchema
from ..security import get_current_user
from ..services.whatsapp import testar_conexao_evolution, disparar_notificacoes_whatsapp, extrair_lista_numeros

router = APIRouter(prefix="/api/settings", tags=["settings"])

def read_env_file():
    data = {}
    if ENV_PATH.exists():
        with open(ENV_PATH, "r", encoding="utf-8") as f:
            for line in f:
                stripped = line.strip()
                if stripped and not stripped.startswith("#") and "=" in stripped:
                    k, v = stripped.split("=", 1)
                    data[k.strip()] = v.strip()
    return data

def write_env_file(updates: dict):
    existing_lines = []
    keys_found = set()

    if ENV_PATH.exists():
        with open(ENV_PATH, "r", encoding="utf-8") as f:
            existing_lines = f.readlines()

    new_lines = []
    for line in existing_lines:
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and "=" in stripped:
            k, _ = stripped.split("=", 1)
            k = k.strip()
            if k in updates:
                new_lines.append(f"{k}={updates[k]}\n")
                keys_found.add(k)
            else:
                new_lines.append(line)
        else:
            new_lines.append(line)

    for k, v in updates.items():
        if k not in keys_found:
            new_lines.append(f"{k}={v}\n")

    with open(ENV_PATH, "w", encoding="utf-8") as f:
        f.writelines(new_lines)

@router.get("", response_model=BotSettingsSchema)
def get_settings(current_user: User = Depends(get_current_user)):
    env_data = read_env_file()
    return {
        "PROEIS_URL": env_data.get("PROEIS_URL", "https://www.proeis.rj.gov.br/"),
        "TIPO_DOCUMENTO": env_data.get("TIPO_DOCUMENTO", "CPF"),
        "CPF": env_data.get("CPF", ""),
        "SENHA": env_data.get("SENHA", ""),
        "CONVENIO": env_data.get("CONVENIO", "HCPM - RAS"),
        "EVENTOS_PREFERIDOS": env_data.get("EVENTOS_PREFERIDOS", ""),
        "APENAS_EVENTOS_LISTADOS": env_data.get("APENAS_EVENTOS_LISTADOS", "false").lower() == "true",
        "APENAS_TITULAR": env_data.get("APENAS_TITULAR", "false").lower() == "true",
        "TIPO_DATA": env_data.get("TIPO_DATA", "dias_frente"),
        "DATA_INICIO": env_data.get("DATA_INICIO", ""),
        "DATA_FIM": env_data.get("DATA_FIM", ""),
        "META_VAGAS": int(env_data.get("META_VAGAS", "1")),
        "DIAS_A_FRENTE_INICIAL": int(env_data.get("DIAS_A_FRENTE_INICIAL", "6")),
        "DIAS_A_FRENTE_MAXIMO": int(env_data.get("DIAS_A_FRENTE_MAXIMO", "7")),
        "INTERVALO_SEGUNDOS": int(env_data.get("INTERVALO_SEGUNDOS", "6")),
        "TENTATIVAS_MAXIMAS": int(env_data.get("TENTATIVAS_MAXIMAS", "120")),
        "MODO_VISIVEL": env_data.get("MODO_VISIVEL", "false").lower() == "true",
        "MODO_HOMOLOGACAO": env_data.get("MODO_HOMOLOGACAO", "true").lower() == "true",
        "GEMINI_MODEL": env_data.get("GEMINI_MODEL", "antigravity99"),
        "GEMINI_API_KEY": env_data.get("GEMINI_API_KEY", ""),
        "AI_BASE_URL": env_data.get("AI_BASE_URL", "https://9router.devsouza.online/v1"),
        "NOTIFICAR_WHATSAPP": env_data.get("NOTIFICAR_WHATSAPP", "false").lower() == "true",
        "EVOLUTION_API_URL": env_data.get("EVOLUTION_API_URL", ""),
        "EVOLUTION_INSTANCE": env_data.get("EVOLUTION_INSTANCE", ""),
        "EVOLUTION_API_KEY": env_data.get("EVOLUTION_API_KEY", ""),
        "WHATSAPP_NOTIFY_NUMBERS": env_data.get("WHATSAPP_NOTIFY_NUMBERS", "")
    }

@router.put("", response_model=BotSettingsSchema)
def update_settings(settings_in: BotSettingsSchema, current_user: User = Depends(get_current_user)):
    if current_user.role != "master":
        raise HTTPException(status_code=403, detail="Acesso restrito ao administrador.")
    updates = {
        "PROEIS_URL": settings_in.PROEIS_URL or "https://www.proeis.rj.gov.br/",
        "TIPO_DOCUMENTO": settings_in.TIPO_DOCUMENTO or "CPF",
        "CPF": settings_in.CPF or "",
        "CONVENIO": settings_in.CONVENIO or "",
        "EVENTOS_PREFERIDOS": settings_in.EVENTOS_PREFERIDOS or "",
        "APENAS_EVENTOS_LISTADOS": "true" if settings_in.APENAS_EVENTOS_LISTADOS else "false",
        "APENAS_TITULAR": "true" if settings_in.APENAS_TITULAR else "false",
        "TIPO_DATA": settings_in.TIPO_DATA or "dias_frente",
        "DATA_INICIO": settings_in.DATA_INICIO or "",
        "DATA_FIM": settings_in.DATA_FIM or "",
        "META_VAGAS": str(settings_in.META_VAGAS or 1),
        "DIAS_A_FRENTE_INICIAL": str(settings_in.DIAS_A_FRENTE_INICIAL or 6),
        "DIAS_A_FRENTE_MAXIMO": str(settings_in.DIAS_A_FRENTE_MAXIMO or 7),
        "INTERVALO_SEGUNDOS": str(settings_in.INTERVALO_SEGUNDOS or 6),
        "TENTATIVAS_MAXIMAS": str(settings_in.TENTATIVAS_MAXIMAS or 120),
        "MODO_VISIVEL": "true" if settings_in.MODO_VISIVEL else "false",
        "MODO_HOMOLOGACAO": "true" if settings_in.MODO_HOMOLOGACAO else "false",
        "GEMINI_MODEL": settings_in.GEMINI_MODEL or "gemini-3.7-flash",
        "GEMINI_API_KEY": settings_in.GEMINI_API_KEY or "",
        "AI_BASE_URL": settings_in.AI_BASE_URL or "https://9router.devsouza.online/v1",
        "NOTIFICAR_WHATSAPP": "true" if settings_in.NOTIFICAR_WHATSAPP else "false",
        "EVOLUTION_API_URL": settings_in.EVOLUTION_API_URL or "",
        "EVOLUTION_INSTANCE": settings_in.EVOLUTION_INSTANCE or "",
        "EVOLUTION_API_KEY": settings_in.EVOLUTION_API_KEY or "",
        "WHATSAPP_NOTIFY_NUMBERS": settings_in.WHATSAPP_NOTIFY_NUMBERS or ""
    }

    if settings_in.SENHA:
        updates["SENHA"] = settings_in.SENHA

    write_env_file(updates)

    for k, v in updates.items():
        os.environ[k] = v

    return get_settings(current_user)

@router.post("/test-ai")
def test_ai_key(payload: dict, current_user: User = Depends(get_current_user)):
    api_key = (payload.get("api_key") or "").strip()
    model = (payload.get("model") or "gemini-3.7-flash").strip()
    base_url = (payload.get("base_url") or payload.get("ai_base_url") or os.getenv("AI_BASE_URL") or "https://9router.devsouza.online/v1").strip()
    
    if not api_key:
        raise HTTPException(status_code=400, detail="Chave de API não informada.")
    
    from bot import resolver_captcha_gemini
    sample_path = os.path.join(BASE_DIR, "..", "test_captcha.png")
    if not os.path.exists(sample_path):
        sample_path = os.path.join(BASE_DIR, "test_captcha.png")
    
    if os.path.exists(sample_path):
        with open(sample_path, "rb") as f:
            sample_bytes = f.read()
    else:
        sample_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc\xf8\xff\xff?\x00\x05\xfe\x02\xfe\xdc\xccY\xe7\x00\x00\x00\x00IEND\xaeB`\x82"

    code = resolver_captcha_gemini(sample_bytes, api_key, model, ai_base_url=base_url)
    if code:
        return {"success": True, "message": f"Conexão bem sucedida. Captcha resolvido: {code}", "code": code}
    
    return {"success": False, "message": f"O provedor não retornou um código válido. Endpoint usado: {base_url} | modelo: {model}"}

@router.post("/test-whatsapp")
def test_whatsapp(payload: dict, current_user: User = Depends(get_current_user)):
    url = (payload.get("url") or payload.get("EVOLUTION_API_URL") or os.getenv("EVOLUTION_API_URL") or "").strip()
    instance = (payload.get("instance") or payload.get("EVOLUTION_INSTANCE") or os.getenv("EVOLUTION_INSTANCE") or "").strip()
    api_key = (payload.get("api_key") or payload.get("EVOLUTION_API_KEY") or os.getenv("EVOLUTION_API_KEY") or "").strip()
    numbers_raw = (payload.get("numbers") or payload.get("WHATSAPP_NOTIFY_NUMBERS") or payload.get("test_number") or "").strip()

    if not url:
        raise HTTPException(status_code=400, detail="endereço da evolution api não informado.")
    if not instance:
        raise HTTPException(status_code=400, detail="nome da instância não informado.")
    if not api_key:
        raise HTTPException(status_code=400, detail="chave de api da evolution não informada.")

    conn_res = testar_conexao_evolution(url, instance, api_key)
    if not conn_res.get("success"):
        return {
            "success": False,
            "message": conn_res.get("message") or "falha ao conectar na instância da evolution api",
            "state": conn_res.get("state")
        }

    numeros = extrair_lista_numeros(numbers_raw)
    if numeros:
        texto_teste = "teste de conexao cproeis: integracao com evolution api funcionando."
        send_res = disparar_notificacoes_whatsapp(
            numeros_raw=numbers_raw,
            texto=texto_teste,
            api_url=url,
            instance=instance,
            api_key=api_key,
            delay_segundos=5
        )
        return {
            "success": send_res.get("success", False),
            "message": f"instancia conectada ({conn_res.get('state', 'online')}). {send_res.get('message')}",
            "state": conn_res.get("state"),
            "details": send_res
        }

    return {
        "success": True,
        "message": f"instancia '{instance}' conectada ({conn_res.get('state', 'online')}).",
        "state": conn_res.get("state")
    }

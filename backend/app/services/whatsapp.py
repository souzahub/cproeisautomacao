import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from whatsapp_notifier import (
    limpar_numero,
    extrair_lista_numeros,
    testar_conexao_evolution,
    enviar_mensagem_whatsapp,
    enviar_documento_whatsapp,
    disparar_notificacoes_whatsapp,
    parse_vagas_from_text,
    formatar_resumo_vagas_wpp
)

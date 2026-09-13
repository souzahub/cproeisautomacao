import os
import sys
import glob
import json
import time
from dotenv import load_dotenv
from bot import resolver_captcha_gemini

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

def auto_rotular():
    load_dotenv()
    key = os.getenv("GEMINI_API_KEY", "").strip()
    modelo = os.getenv("GEMINI_MODEL", "gemini-3.7-flash").strip()
    
    if not key:
        print("Preencha a chave GEMINI_API_KEY no arquivo .env para rotulagem automatica.", flush=True)
        return

    pasta_img = os.path.join(os.path.dirname(__file__), "dataset_captchas")
    caminho_labels = os.path.join(os.path.dirname(__file__), "labels.json")

    labels = {}
    if os.path.exists(caminho_labels):
        with open(caminho_labels, "r", encoding="utf-8") as f:
            try:
                labels = json.load(f)
            except Exception:
                labels = {}

    arquivos = sorted(glob.glob(os.path.join(pasta_img, "*.png")))
    total = len(arquivos)
    print(f"Iniciando rotulagem automatica de {total} imagens com {modelo}...", flush=True)

    sucesso = 0
    for i, arq in enumerate(arquivos, 1):
        nome = os.path.basename(arq)
        if nome in labels and len(labels[nome]) == 6:
            sucesso += 1
            print(f"[{i}/{total}] {nome} ja rotulado -> {labels[nome]}", flush=True)
            continue

        with open(arq, "rb") as f:
            img_bytes = f.read()

        texto = resolver_captcha_gemini(img_bytes, key, modelo)
        if len(texto) == 6:
            labels[nome] = texto
            sucesso += 1
            print(f"[{i}/{total}] {nome} -> {texto}", flush=True)
            with open(caminho_labels, "w", encoding="utf-8") as f:
                json.dump(labels, f, indent=2)
        else:
            print(f"[{i}/{total}] {nome} -> Falha na leitura ({texto})", flush=True)

        time.sleep(0.5)

    with open(caminho_labels, "w", encoding="utf-8") as f:
        json.dump(labels, f, indent=2)

    print(f"\nRotulagem finalizada com sucesso: {sucesso}/{total} captchas prontos.", flush=True)

if __name__ == "__main__":
    auto_rotular()

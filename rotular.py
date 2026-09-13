import os
import sys
import json
import glob
import cv2

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

def rotular():
    pasta = os.path.join(os.path.dirname(__file__), "dataset_captchas")
    if not os.path.exists(pasta):
        print("Pasta dataset_captchas nao encontrada. Execute primeiro coletar_amostras.py.")
        return

    caminho_labels = os.path.join(os.path.dirname(__file__), "labels.json")
    labels = {}
    if os.path.exists(caminho_labels):
        with open(caminho_labels, "r", encoding="utf-8") as f:
            labels = json.load(f)

    arquivos = sorted(glob.glob(os.path.join(pasta, "*.png")))
    total = len(arquivos)
    print(f"Total de imagens encontradas: {total}")
    print("Digite o texto de 6 caracteres exibido na janela da imagem.")
    print("Comandos: 's' para pular, 'q' para salvar e sair.\n")

    for i, arq in enumerate(arquivos, 1):
        nome = os.path.basename(arq)
        if nome in labels:
            continue

        img = cv2.imread(arq)
        if img is None:
            continue

        cv2.imshow(f"Rotulando [{i}/{total}] - {nome}", img)
        cv2.waitKey(1)

        while True:
            resp = input(f"[{i}/{total}] Digite os caracteres de {nome}: ").strip().upper()
            if resp == "Q":
                cv2.destroyAllWindows()
                with open(caminho_labels, "w", encoding="utf-8") as f:
                    json.dump(labels, f, indent=2)
                print(f"Progresso salvo. Total rotulado ate o momento: {len(labels)}")
                return
            elif resp == "S":
                break
            elif len(resp) == 6:
                labels[nome] = resp
                with open(caminho_labels, "w", encoding="utf-8") as f:
                    json.dump(labels, f, indent=2)
                break
            else:
                print("O captcha precisa ter exatamente 6 caracteres (ou digite 's' para pular).")

        cv2.destroyAllWindows()

    with open(caminho_labels, "w", encoding="utf-8") as f:
        json.dump(labels, f, indent=2)
    print(f"\nRotulagem finalizada! Total de imagens rotuladas: {len(labels)}")

if __name__ == "__main__":
    rotular()

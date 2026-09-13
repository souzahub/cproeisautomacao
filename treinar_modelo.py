import os
import sys
import json
import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

CHAR_LIST = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
CHAR_TO_IDX = {c: i for i, c in enumerate(CHAR_LIST)}
IDX_TO_CHAR = {i: c for i, c in enumerate(CHAR_LIST)}

class CaptchaCNN(nn.Module):
    def __init__(self, num_classes=36):
        super(CaptchaCNN, self).__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.MaxPool2d(2, 2),
            
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.MaxPool2d(2, 2),
            
            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(),
            nn.MaxPool2d(2, 2)
        )
        self.classifier = nn.Sequential(
            nn.Dropout(0.25),
            nn.Linear(128 * 4 * 4, 128),
            nn.ReLU(),
            nn.Linear(128, num_classes)
        )

    def forward(self, x):
        x = self.features(x)
        x = x.view(x.size(0), -1)
        x = self.classifier(x)
        return x

def preprocess_and_slice(img_path):
    img = cv2.imread(img_path)
    if img is None:
        return []

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 210, 255, cv2.THRESH_BINARY_INV)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    clean = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
    clean = cv2.morphologyEx(clean, cv2.MORPH_DILATE, kernel)

    h, w = clean.shape
    slice_w = w // 6
    slices = []

    for i in range(6):
        x_start = max(0, i * slice_w - 3)
        x_end = min(w, (i + 1) * slice_w + 3)
        crop = clean[:, x_start:x_end]
        resized = cv2.resize(crop, (32, 32), interpolation=cv2.INTER_AREA)
        norm = resized.astype(np.float32) / 255.0
        slices.append(norm)

    return slices

class CaptchaDataset(Dataset):
    def __init__(self, pasta_imagens, labels_json):
        self.samples = []
        with open(labels_json, "r", encoding="utf-8") as f:
            data = json.load(f)

        for nome_arq, texto in data.items():
            caminho = os.path.join(pasta_imagens, nome_arq)
            if not os.path.exists(caminho) or len(texto) != 6:
                continue

            slices = preprocess_and_slice(caminho)
            if len(slices) == 6:
                for s, char in zip(slices, texto):
                    if char in CHAR_TO_IDX:
                        self.samples.append((s, CHAR_TO_IDX[char]))

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_np, label = self.samples[idx]
        tensor = torch.from_numpy(img_np).unsqueeze(0)
        return tensor, torch.tensor(label, dtype=torch.long)

def treinar():
    pasta_img = os.path.join(os.path.dirname(__file__), "dataset_captchas")
    caminho_labels = os.path.join(os.path.dirname(__file__), "labels.json")

    if not os.path.exists(caminho_labels):
        print("Arquivo labels.json nao encontrado. Execute rotular.py primeiro.")
        return

    dataset = CaptchaDataset(pasta_img, caminho_labels)
    if len(dataset) == 0:
        print("Nenhum dado valido para treino. Rotule as imagens antes de treinar.")
        return

    print(f"Total de caracteres para treinamento: {len(dataset)}")
    loader = DataLoader(dataset, batch_size=16, shuffle=True)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = CaptchaCNN(num_classes=len(CHAR_LIST)).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)

    print("Iniciando treinamento da rede neural...")
    for epoch in range(1, 31):
        model.train()
        total_loss = 0.0
        corretos = 0
        total = 0

        for images, labels in loader:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            total_loss += loss.item() * images.size(0)
            _, predicted = torch.max(outputs, 1)
            total += labels.size(0)
            corretos += (predicted == labels).sum().item()

        acc = (corretos / total) * 100 if total > 0 else 0
        loss_media = total_loss / total if total > 0 else 0
        if epoch % 5 == 0 or epoch == 1:
            print(f"Epoca [{epoch}/30] - Perda: {loss_media:.4f} - Acuracia: {acc:.2f}%")

    caminho_saida = os.path.join(os.path.dirname(__file__), "modelo_captcha.pth")
    torch.save(model.state_dict(), caminho_saida)
    print(f"\nModelo salvo com sucesso em: {caminho_saida}")

if __name__ == "__main__":
    treinar()

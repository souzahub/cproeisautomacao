import os
import sys
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from crnn_model import CRNN, BLANK_IDX, ctc_decode, NUM_CLASSES
from dataset import CaptchaCRNNDataset, pad_collate

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

def treinar(epochs=50, batch_size=8, lr=0.001):
    dataset = CaptchaCRNNDataset()
    if len(dataset) == 0:
        print("Nenhum dado com rotulo encontrado. Execute primeiro auto_rotular.py ou rotular.py.")
        return

    print(f"Total de amostras disponiveis para treino: {len(dataset)}")
    loader = DataLoader(dataset, batch_size=batch_size, shuffle=True, collate_fn=pad_collate)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = CRNN(num_classes=NUM_CLASSES).to(device)
    
    criterion = nn.CTCLoss(blank=BLANK_IDX, zero_infinity=True)
    optimizer = optim.Adam(model.parameters(), lr=lr)

    print("Iniciando treinamento da rede neural CRNN...")
    
    for epoch in range(1, epochs + 1):
        model.train()
        epoch_loss = 0.0
        
        for images, targets, target_lengths in loader:
            images = images.to(device)
            targets = targets.to(device)
            
            optimizer.zero_grad()
            preds = model(images)
            
            t, n, _ = preds.size()
            input_lengths = torch.full(size=(n,), fill_value=t, dtype=torch.long).to(device)
            
            loss = criterion(preds, targets, input_lengths, target_lengths)
            loss.backward()
            optimizer.step()
            
            epoch_loss += loss.item()

        loss_media = epoch_loss / len(loader)
        if epoch % 10 == 0 or epoch == 1:
            print(f"Epoca [{epoch}/{epochs}] - Perda media (CTC Loss): {loss_media:.4f}")

    caminho_pesos = os.path.join(os.path.dirname(__file__), "weights_crnn.pth")
    torch.save(model.state_dict(), caminho_pesos)
    print(f"\nPesos salvos com sucesso em: {caminho_pesos}")

if __name__ == "__main__":
    treinar()

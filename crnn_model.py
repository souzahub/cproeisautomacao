import torch
import torch.nn as nn

CHARACTERS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
NUM_CLASSES = len(CHARACTERS) + 1
BLANK_IDX = 0

CHAR_TO_IDX = {c: i + 1 for i, c in enumerate(CHARACTERS)}
IDX_TO_CHAR = {i + 1: c for i, c in enumerate(CHARACTERS)}

class CRNN(nn.Module):
    def __init__(self, num_classes=NUM_CLASSES):
        super(CRNN, self).__init__()
        
        self.cnn = nn.Sequential(
            nn.Conv2d(1, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.MaxPool2d(kernel_size=(2, 2)),
            
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.MaxPool2d(kernel_size=(2, 2)),
            
            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(),
            nn.MaxPool2d(kernel_size=(2, 1)),
            
            nn.Conv2d(128, 256, kernel_size=3, padding=1),
            nn.BatchNorm2d(256),
            nn.ReLU(),
            nn.MaxPool2d(kernel_size=(2, 1))
        )
        
        self.rnn = nn.GRU(
            input_size=256 * 3,
            hidden_size=128,
            num_layers=2,
            bidirectional=True,
            batch_first=True,
            dropout=0.2
        )
        
        self.fc = nn.Linear(128 * 2, num_classes)

    def forward(self, x):
        features = self.cnn(x)
        b, c, h, w = features.size()
        
        features = features.permute(0, 3, 1, 2)
        features = features.contiguous().view(b, w, c * h)
        
        recurrent, _ = self.rnn(features)
        output = self.fc(recurrent)
        
        output = output.permute(1, 0, 2)
        return torch.nn.functional.log_softmax(output, dim=2)

def ctc_decode(predictions):
    argmax_preds = torch.argmax(predictions, dim=2)
    argmax_preds = argmax_preds.permute(1, 0).cpu().numpy()
    
    decoded_texts = []
    for seq in argmax_preds:
        decoded = []
        prev = BLANK_IDX
        for idx in seq:
            if idx != BLANK_IDX and idx != prev:
                decoded.append(IDX_TO_CHAR.get(idx, ""))
            prev = idx
        decoded_texts.append("".join(decoded))
        
    return decoded_texts

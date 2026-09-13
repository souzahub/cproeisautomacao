import os
import torch
from crnn_model import CRNN, ctc_decode, NUM_CLASSES
from dataset import preprocess_image

_CRNN_MODEL = None

def carregar_modelo_crnn(caminho_pesos="weights_crnn.pth"):
    global _CRNN_MODEL
    if _CRNN_MODEL is not None:
        return _CRNN_MODEL
        
    caminho = os.path.join(os.path.dirname(__file__), caminho_pesos)
    if not os.path.exists(caminho):
        return None

    model = CRNN(num_classes=NUM_CLASSES)
    model.load_state_dict(torch.load(caminho, map_location=torch.device("cpu")))
    model.eval()
    _CRNN_MODEL = model
    return _CRNN_MODEL

def prever_crnn(img_bytes, model=None):
    if model is None:
        model = carregar_modelo_crnn()
        
    if model is None:
        return ""

    img_np = preprocess_image(img_bytes)
    tensor = torch.from_numpy(img_np).unsqueeze(0).unsqueeze(0)
    
    with torch.no_grad():
        preds = model(tensor)
        decoded = ctc_decode(preds)
        return decoded[0] if decoded else ""

import os
import glob
import json
import cv2
import numpy as np
import torch
from torch.utils.data import Dataset
from crnn_model import CHAR_TO_IDX

IMAGE_HEIGHT = 50
IMAGE_WIDTH = 200

def preprocess_image(img_path_or_bytes):
    if isinstance(img_path_or_bytes, str):
        img = cv2.imread(img_path_or_bytes, cv2.IMREAD_UNCHANGED)
    else:
        nparr = np.frombuffer(img_path_or_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
        
    if img is None:
        return np.zeros((IMAGE_HEIGHT, IMAGE_WIDTH), dtype=np.float32)

    if len(img.shape) == 3 and img.shape[2] == 4:
        bg = np.ones((img.shape[0], img.shape[1], 3), dtype=np.uint8) * 255
        alpha = img[:, :, 3] / 255.0
        for c in range(3):
            bg[:, :, c] = (alpha * img[:, :, c] + (1 - alpha) * 255).astype(np.uint8)
        gray = cv2.cvtColor(bg, cv2.COLOR_BGR2GRAY)
    elif len(img.shape) == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img

    resized = cv2.resize(gray, (IMAGE_WIDTH, IMAGE_HEIGHT), interpolation=cv2.INTER_AREA)
    normalized = (resized.astype(np.float32) / 255.0 - 0.5) / 0.5
    return normalized

class CaptchaCRNNDataset(Dataset):
    def __init__(self, data_dir="dataset_captchas", labels_file="labels.json"):
        self.samples = []
        
        labels_map = {}
        if os.path.exists(labels_file):
            with open(labels_file, "r", encoding="utf-8") as f:
                labels_map = json.load(f)

        arquivos = glob.glob(os.path.join(data_dir, "*.png"))
        for arq in arquivos:
            nome_base = os.path.basename(arq)
            nome_sem_ext = os.path.splitext(nome_base)[0]
            
            label = ""
            if nome_base in labels_map:
                label = labels_map[nome_base]
            elif len(nome_sem_ext) == 6 and nome_sem_ext.isalnum():
                label = nome_sem_ext.upper()
                
            if label:
                self.samples.append((arq, label))

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_path, label = self.samples[idx]
        img_np = preprocess_image(img_path)
        img_tensor = torch.from_numpy(img_np).unsqueeze(0)
        
        target = [CHAR_TO_IDX[c] for c in label if c in CHAR_TO_IDX]
        target_tensor = torch.tensor(target, dtype=torch.long)
        
        return img_tensor, target_tensor, len(target)

def pad_collate(batch):
    images, targets, target_lengths = zip(*batch)
    images = torch.stack(images, 0)
    
    flattened_targets = []
    for t in targets:
        flattened_targets.extend(t.tolist())
        
    flattened_targets = torch.tensor(flattened_targets, dtype=torch.long)
    target_lengths = torch.tensor(target_lengths, dtype=torch.long)
    
    return images, flattened_targets, target_lengths

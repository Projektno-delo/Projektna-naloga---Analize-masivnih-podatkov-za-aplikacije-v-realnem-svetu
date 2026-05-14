import cv2
import os
import glob
import numpy as np

face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

def preprocess_images(input_dir="data/raw/", output_dir="data/processed/", img_size=(128, 128)):
    image_paths = glob.glob(os.path.join(input_dir, "*.jpg"))
    
    for path in image_paths:
        img = cv2.imread(path)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5)
        
        for (x, y, w, h) in faces:
            face_crop = gray[y:y+h, x:x+w]
            face_resized = cv2.resize(face_crop, img_size)
            face_normalized = face_resized / 255.0
            face_to_save = (face_normalized * 255).astype(np.uint8)
            
            filename = os.path.basename(path)
            save_path = os.path.join(output_dir, f"proc_{filename}")
            cv2.imwrite(save_path, face_to_save)
            print(f"Obdelano in shranjeno: {save_path}")
            break 

if __name__ == "__main__":
    preprocess_images()
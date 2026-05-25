import cv2
import os
import uuid

def capture_images(save_path="data/raw/"):
    cap = cv2.VideoCapture(0)
    print("Pritisni SPACE za zajem slike, ali 'q' za izhod.")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        cv2.imshow("Zajem za 2FA Hribovc", frame)
        key = cv2.waitKey(1) & 0xFF

        if key == ord(' '):
            img_name = f"{save_path}/slika_{uuid.uuid4().hex[:8]}.jpg"
            cv2.imwrite(img_name, frame)
            print(f"Shranjeno: {img_name}")
        elif key == ord('q'): 
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    capture_images()


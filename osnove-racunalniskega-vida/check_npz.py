import numpy as np

data = np.load("data/users/anja.npz", allow_pickle=True)

print("Polja v datoteki:")
print(data.files)

print()

for key in data.files:
    print(f"{key}:")
    print(data[key])
    print()
import csv
import os
import pickle

import numpy as np

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report


# =========================
# CONFIGURACIÓN
# =========================

DATA_FILE = "data/landmarks.csv"
MODEL_FILE = "model.pkl"


# =========================
# CARGAR DATASET
# =========================

if not os.path.exists(DATA_FILE):
    raise FileNotFoundError(
        f"No existe {DATA_FILE}. "
        "Primero ejecutá capture_data.py."
    )


X = []
y = []


with open(
    DATA_FILE,
    "r",
    encoding="utf-8"
) as file:

    reader = csv.reader(file)

    # Saltar header
    next(reader)

    for row in reader:

        if len(row) != 64:
            continue

        features = [
            float(value)
            for value in row[:63]
        ]

        label = row[63]

        X.append(features)
        y.append(label)


X = np.array(X)
y = np.array(y)


print()
print("======================================")
print("          ENTRENAMIENTO")
print("======================================")
print()

print(f"Muestras: {len(X)}")
print(f"Características: {X.shape[1]}")
print(f"Clases: {sorted(set(y))}")
print()


# =========================
# TRAIN / TEST SPLIT
# =========================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)


print(f"Entrenamiento: {len(X_train)}")
print(f"Testing:       {len(X_test)}")
print()


# =========================
# MODELO
# =========================

model = RandomForestClassifier(
    n_estimators=300,
    max_depth=None,
    random_state=42,
    n_jobs=-1,
    class_weight="balanced"
)


print("Entrenando...")

model.fit(
    X_train,
    y_train
)


# =========================
# EVALUACIÓN
# =========================

predictions = model.predict(X_test)

accuracy = accuracy_score(
    y_test,
    predictions
)


print()
print("======================================")
print("             RESULTADOS")
print("======================================")
print()

print(
    f"Accuracy: {accuracy * 100:.2f}%"
)

print()

print(
    classification_report(
        y_test,
        predictions
    )
)


# =========================
# GUARDAR MODELO
# =========================

with open(
    MODEL_FILE,
    "wb"
) as file:

    pickle.dump(
        model,
        file
    )


print()
print(f"Modelo guardado en: {MODEL_FILE}")
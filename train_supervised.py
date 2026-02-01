import pandas as pd
import xgboost as xgb
import pickle
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import os

def train_model(data_file="labeled_data.csv", model_file="xgboost_model.pkl"):
    if not os.path.exists(data_file):
        print(f"Error: {data_file} not found. Run data collection first.")
        return

    print("Loading data...")
    df = pd.read_csv(data_file)
    
    # Check if we have both classes
    if len(df['label'].unique()) < 2:
        print("Error: Dataset needs both Normal (0) and Malicious (1) data.")
        print(f"Current labels: {df['label'].unique()}")
        return

    X = df.drop(columns=['label'])
    y = df['label']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print("Training XGBoost Classifier...")
    model = xgb.XGBClassifier(use_label_encoder=False, eval_metric='logloss')
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    
    print(f"\nModel Accuracy: {acc * 100:.2f}%")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, digits=4))
    
    # Feature Importance
    print("\nFeature Importance:")
    for name, imp in zip(X.columns, model.feature_importances_):
        print(f"{name}: {imp:.4f}")
        
    # Save Model
    with open(model_file, "wb") as f:
        pickle.dump(model, f)
    print(f"\nModel saved to {model_file}")

if __name__ == "__main__":
    train_model()

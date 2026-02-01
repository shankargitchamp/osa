"""
ENSEMBLE MODEL TRAINER
Combines multiple ML models for improved threat detection accuracy:
- XGBoost (Gradient Boosting)
- Random Forest
- Isolation Forest (Anomaly Detection)
"""
import pandas as pd
import numpy as np
import pickle
import os
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.ensemble import RandomForestClassifier, IsolationForest, VotingClassifier
import xgboost as xgb
import warnings
warnings.filterwarnings('ignore')

class EnsembleDetector:
    """
    Ensemble threat detector combining multiple models for robust detection.
    """
    
    def __init__(self):
        self.xgb_model = None
        self.rf_model = None
        self.iso_model = None
        self.ensemble = None
        self.feature_names = None
        
    def train(self, data_file="labeled_data.csv", save_dir="."):
        """Train all models in the ensemble"""
        
        if not os.path.exists(data_file):
            print(f"Error: {data_file} not found. Run data collection first.")
            return False
        
        print("=" * 60)
        print("SENTINEL OVERWATCH - Ensemble Model Training")
        print("=" * 60)
        
        # Load data
        print("\n[1/5] Loading training data...")
        df = pd.read_csv(data_file)
        print(f"   Loaded {len(df)} samples")
        
        # Check for both classes
        if len(df['label'].unique()) < 2:
            print("Error: Dataset needs both Normal (0) and Malicious (1) data.")
            print(f"Current labels: {df['label'].unique()}")
            return False
        
        X = df.drop(columns=['label'])
        y = df['label']
        self.feature_names = X.columns.tolist()
        
        print(f"   Features: {self.feature_names}")
        print(f"   Class distribution: {dict(y.value_counts())}")
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Train XGBoost
        print("\n[2/5] Training XGBoost Classifier...")
        self.xgb_model = xgb.XGBClassifier(
            use_label_encoder=False,
            eval_metric='logloss',
            n_estimators=100,
            max_depth=6,
            learning_rate=0.1,
            random_state=42
        )
        self.xgb_model.fit(X_train, y_train)
        xgb_pred = self.xgb_model.predict(X_test)
        xgb_acc = accuracy_score(y_test, xgb_pred)
        print(f"   XGBoost Accuracy: {xgb_acc * 100:.2f}%")
        
        # Train Random Forest
        print("\n[3/5] Training Random Forest Classifier...")
        self.rf_model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            min_samples_split=5,
            random_state=42,
            n_jobs=-1
        )
        self.rf_model.fit(X_train, y_train)
        rf_pred = self.rf_model.predict(X_test)
        rf_acc = accuracy_score(y_test, rf_pred)
        print(f"   Random Forest Accuracy: {rf_acc * 100:.2f}%")
        
        # Train Isolation Forest (for anomaly scores)
        print("\n[4/5] Training Isolation Forest (Anomaly Detector)...")
        self.iso_model = IsolationForest(
            n_estimators=100,
            contamination=0.1,
            random_state=42,
            n_jobs=-1
        )
        self.iso_model.fit(X_train)
        iso_pred = self.iso_model.predict(X_test)
        # Convert -1 (anomaly) to 1 (malicious), 1 (normal) to 0
        iso_pred_binary = (iso_pred == -1).astype(int)
        iso_acc = accuracy_score(y_test, iso_pred_binary)
        print(f"   Isolation Forest Accuracy: {iso_acc * 100:.2f}%")
        
        # Create Voting Ensemble
        print("\n[5/5] Creating Voting Ensemble...")
        self.ensemble = VotingClassifier(
            estimators=[
                ('xgb', self.xgb_model),
                ('rf', self.rf_model),
            ],
            voting='soft',
            weights=[1.5, 1.0]  # Give XGBoost slightly more weight
        )
        self.ensemble.fit(X_train, y_train)
        ensemble_pred = self.ensemble.predict(X_test)
        ensemble_acc = accuracy_score(y_test, ensemble_pred)
        print(f"   Ensemble Accuracy: {ensemble_acc * 100:.2f}%")
        
        # Print detailed results
        print("\n" + "=" * 60)
        print("MODEL COMPARISON RESULTS")
        print("=" * 60)
        
        print(f"\n{'Model':<20} {'Accuracy':<15} {'Improvement':<15}")
        print("-" * 50)
        print(f"{'XGBoost':<20} {xgb_acc * 100:>6.2f}%        {'(baseline)':<15}")
        print(f"{'Random Forest':<20} {rf_acc * 100:>6.2f}%        {(rf_acc - xgb_acc) * 100:+.2f}%")
        print(f"{'Isolation Forest':<20} {iso_acc * 100:>6.2f}%        {(iso_acc - xgb_acc) * 100:+.2f}%")
        print(f"{'Ensemble':<20} {ensemble_acc * 100:>6.2f}%        {(ensemble_acc - xgb_acc) * 100:+.2f}%")
        
        # Feature importance
        print("\n" + "=" * 60)
        print("FEATURE IMPORTANCE (XGBoost)")
        print("=" * 60)
        for name, imp in sorted(zip(self.feature_names, self.xgb_model.feature_importances_), 
                                key=lambda x: x[1], reverse=True):
            bar = "█" * int(imp * 50)
            print(f"   {name:<25} {imp:.4f} {bar}")
        
        # Classification report for ensemble
        print("\n" + "=" * 60)
        print("ENSEMBLE CLASSIFICATION REPORT")
        print("=" * 60)
        print(classification_report(y_test, ensemble_pred, 
                                   target_names=['Normal', 'Malicious'], 
                                   digits=4))
        
        # Save models
        print("\n[*] Saving models...")
        
        # Save individual models
        with open(os.path.join(save_dir, "xgboost_model.pkl"), "wb") as f:
            pickle.dump(self.xgb_model, f)
        
        with open(os.path.join(save_dir, "random_forest_model.pkl"), "wb") as f:
            pickle.dump(self.rf_model, f)
        
        with open(os.path.join(save_dir, "isolation_forest_model.pkl"), "wb") as f:
            pickle.dump(self.iso_model, f)
        
        with open(os.path.join(save_dir, "ensemble_model.pkl"), "wb") as f:
            pickle.dump({
                'ensemble': self.ensemble,
                'iso_model': self.iso_model,
                'feature_names': self.feature_names
            }, f)
        
        print(f"   Saved: xgboost_model.pkl")
        print(f"   Saved: random_forest_model.pkl")
        print(f"   Saved: isolation_forest_model.pkl")
        print(f"   Saved: ensemble_model.pkl")
        
        print("\n" + "=" * 60)
        print("TRAINING COMPLETE")
        print("=" * 60)
        
        return True
    
    def load(self, model_dir="."):
        """Load trained models"""
        try:
            with open(os.path.join(model_dir, "ensemble_model.pkl"), "rb") as f:
                data = pickle.load(f)
                self.ensemble = data['ensemble']
                self.iso_model = data['iso_model']
                self.feature_names = data['feature_names']
            
            with open(os.path.join(model_dir, "xgboost_model.pkl"), "rb") as f:
                self.xgb_model = pickle.load(f)
            
            with open(os.path.join(model_dir, "random_forest_model.pkl"), "rb") as f:
                self.rf_model = pickle.load(f)
                
            return True
        except FileNotFoundError as e:
            print(f"Error loading models: {e}")
            return False
    
    def predict(self, features_dict):
        """
        Make prediction using ensemble.
        Returns probability and predictions from all models.
        """
        # Convert to DataFrame
        df = pd.DataFrame([features_dict])
        
        # Ensure column order matches training
        if self.feature_names:
            df = df[self.feature_names]
        
        results = {
            'xgb_prob': float(self.xgb_model.predict_proba(df)[0][1]),
            'xgb_pred': int(self.xgb_model.predict(df)[0]),
            'rf_prob': float(self.rf_model.predict_proba(df)[0][1]),
            'rf_pred': int(self.rf_model.predict(df)[0]),
            'iso_score': float(self.iso_model.score_samples(df)[0]),
            'iso_pred': int(self.iso_model.predict(df)[0] == -1),
            'ensemble_prob': float(self.ensemble.predict_proba(df)[0][1]),
            'ensemble_pred': int(self.ensemble.predict(df)[0]),
        }
        
        # Calculate combined score (weighted average)
        results['combined_prob'] = (
            results['xgb_prob'] * 0.4 +
            results['rf_prob'] * 0.3 +
            results['ensemble_prob'] * 0.3
        )
        
        # Final prediction based on majority voting + anomaly detection
        votes = results['xgb_pred'] + results['rf_pred'] + results['iso_pred']
        results['final_pred'] = 1 if votes >= 2 else 0
        
        return results

def run_cross_validation(data_file="labeled_data.csv"):
    """Run cross-validation to evaluate model stability"""
    
    if not os.path.exists(data_file):
        print(f"Error: {data_file} not found.")
        return
    
    print("Running 5-Fold Cross-Validation...")
    
    df = pd.read_csv(data_file)
    X = df.drop(columns=['label'])
    y = df['label']
    
    models = {
        'XGBoost': xgb.XGBClassifier(use_label_encoder=False, eval_metric='logloss'),
        'Random Forest': RandomForestClassifier(n_estimators=100, random_state=42),
    }
    
    print(f"\n{'Model':<20} {'Mean Accuracy':<15} {'Std Dev':<15}")
    print("-" * 50)
    
    for name, model in models.items():
        scores = cross_val_score(model, X, y, cv=5, scoring='accuracy')
        print(f"{name:<20} {scores.mean() * 100:>6.2f}%        ±{scores.std() * 100:.2f}%")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Ensemble Model Training")
    parser.add_argument("--data", type=str, default="labeled_data.csv",
                       help="Path to labeled data CSV")
    parser.add_argument("--cv", action="store_true",
                       help="Run cross-validation")
    
    args = parser.parse_args()
    
    if args.cv:
        run_cross_validation(args.data)
    else:
        detector = EnsembleDetector()
        detector.train(args.data)

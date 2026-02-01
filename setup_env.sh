#!/bin/bash

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate and install dependencies
echo "Installing dependencies..."
./venv/bin/pip install --upgrade pip
./venv/bin/pip install xgboost pandas scikit-learn numpy

echo "Setup complete. Virtual environment ready in ./venv"

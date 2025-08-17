#!/bin/bash

echo "Starting Python FastAPI backend for production..."

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Create temp directory if it doesn't exist
mkdir -p temp

# Start the FastAPI server with production settings
echo "Starting FastAPI server..."
python main.py
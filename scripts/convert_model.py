#!/usr/bin/env python3
"""
Helper script to convert Keras .h5 model to TensorFlow.js format
Usage: python scripts/convert_model.py
"""

import os
import sys

def convert_model():
    try:
        import tensorflowjs as tfjs
    except ImportError:
        print("Error: tensorflowjs not installed.")
        print("Please install it with: pip install tensorflowjs")
        sys.exit(1)
    
    # Paths
    input_model = os.path.join('model', 'cnn_model.h5')
    output_dir = os.path.join('model', 'tfjs_model')
    
    # Check if input model exists
    if not os.path.exists(input_model):
        print(f"Error: Model file not found at {input_model}")
        sys.exit(1)
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"Converting {input_model} to TensorFlow.js format...")
    print(f"Output directory: {output_dir}")
    
    # Convert the model
    tfjs.converters.save_keras_model(
        model_path=input_model,
        artifacts_dir=output_dir
    )
    
    print("✓ Conversion complete!")
    print(f"✓ Model files saved to: {output_dir}")
    print("\nNext steps:")
    print("1. Install TensorFlow.js: npm install @tensorflow/tfjs-node")
    print("2. Restart the server")
    print("3. The model will be loaded automatically on first use")

if __name__ == '__main__':
    convert_model()


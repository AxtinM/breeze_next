#!/bin/bash

# ESP Emulator Setup Script
# Installs required dependencies for the ESP device emulator

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_color() {
    echo -e "${1}${2}${NC}"
}

print_color $GREEN "🔧 Setting up ESP Device Emulator..."

# Check if running on different distributions
if command -v pacman &> /dev/null; then
    print_color $YELLOW "📦 Installing mosquitto (Arch Linux)..."
    sudo pacman -S --noconfirm mosquitto
    
elif command -v apt-get &> /dev/null; then
    print_color $YELLOW "📦 Installing mosquitto-clients..."
    sudo apt-get update
    sudo apt-get install -y mosquitto-clients
    
elif command -v yum &> /dev/null; then
    print_color $YELLOW "📦 Installing mosquitto-clients (RHEL/CentOS)..."
    sudo yum install -y mosquitto
    
elif command -v brew &> /dev/null; then
    print_color $YELLOW "📦 Installing mosquitto (macOS)..."
    brew install mosquitto
    
else
    print_color $RED "❌ Unsupported package manager. Please install mosquitto-clients manually."
    exit 1
fi

# Check installation
if command -v mosquitto_pub &> /dev/null && command -v mosquitto_sub &> /dev/null; then
    print_color $GREEN "✅ mosquitto-clients installed successfully!"
else
    print_color $RED "❌ Installation failed. Please install mosquitto-clients manually."
    exit 1
fi

print_color $GREEN "🎉 Setup complete! You can now run:"
print_color $YELLOW "   ./esp_emulator.sh"
print_color $YELLOW "   ./esp_emulator.sh --help"
print_color $YELLOW "   ./esp_emulator.sh -i esp32-test -n \"Test Device\" --auto --online"

#!/bin/bash

# Multi-Device ESP Emulator Demo
# Launches multiple ESP device emulators for testing

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_color() {
    echo -e "${1}${2}${NC}"
}

print_color $CYAN "
╔══════════════════════════════════════════════════════════════════╗
║               🏠 Smart Home Demo - Multiple Devices              ║
║                     ESP Device Emulators                        ║
╚══════════════════════════════════════════════════════════════════╝
"

print_color $YELLOW "🚀 Starting multiple ESP device emulators..."
print_color $BLUE "   Each device will run in a separate terminal window"
echo

# Check if tmux is available for better experience
if command -v tmux &> /dev/null; then
    print_color $GREEN "✅ Using tmux for better terminal management"
    
    # Kill existing session if it exists
    tmux kill-session -t esp-demo 2>/dev/null
    
    # Create new tmux session
    tmux new-session -d -s esp-demo -x 120 -y 30
    
    # Split into 4 panes
    tmux split-window -h
    tmux split-window -v
    tmux select-pane -t 0
    tmux split-window -v
    
    # Start devices in each pane
    tmux send-keys -t 0 './esp_emulator.sh -i esp32-living -n "Living Room Light" -t ESP32 --auto --online' C-m
    tmux send-keys -t 1 './esp_emulator.sh -i esp8266-kitchen -n "Kitchen Fan" -t ESP8266 --auto --online' C-m
    tmux send-keys -t 2 './esp_emulator.sh -i esp32s3-bedroom -n "Bedroom AC" -t ESP32-S3 --auto --online' C-m
    tmux send-keys -t 3 './esp_emulator.sh -i esp32c3-garden -n "Garden Sprinkler" -t ESP32-C3 --auto --online' C-m
    
    print_color $GREEN "🎉 All devices started in tmux session 'esp-demo'"
    print_color $YELLOW "📖 Commands:"
    print_color $BLUE "   tmux attach -t esp-demo    # Attach to session"
    print_color $BLUE "   tmux kill-session -t esp-demo  # Stop all devices"
    print_color $BLUE "   Ctrl+B then D              # Detach from session"
    print_color $BLUE "   Ctrl+B then Arrow keys     # Navigate between panes"
    echo
    
    # Attach to the session
    tmux attach -t esp-demo
    
elif command -v gnome-terminal &> /dev/null; then
    print_color $GREEN "✅ Using gnome-terminal"
    
    gnome-terminal --tab --title="Living Room Light" -- bash -c './esp_emulator.sh -i esp32-living -n "Living Room Light" -t ESP32 --auto --online; bash'
    sleep 1
    gnome-terminal --tab --title="Kitchen Fan" -- bash -c './esp_emulator.sh -i esp8266-kitchen -n "Kitchen Fan" -t ESP8266 --auto --online; bash'
    sleep 1
    gnome-terminal --tab --title="Bedroom AC" -- bash -c './esp_emulator.sh -i esp32s3-bedroom -n "Bedroom AC" -t ESP32-S3 --auto --online; bash'
    sleep 1
    gnome-terminal --tab --title="Garden Sprinkler" -- bash -c './esp_emulator.sh -i esp32c3-garden -n "Garden Sprinkler" -t ESP32-C3 --auto --online; bash'
    
    print_color $GREEN "🎉 All devices started in separate terminal tabs"
    
elif command -v konsole &> /dev/null; then
    print_color $GREEN "✅ Using konsole"
    
    konsole --new-tab -e bash -c './esp_emulator.sh -i esp32-living -n "Living Room Light" -t ESP32 --auto --online; bash' &
    konsole --new-tab -e bash -c './esp_emulator.sh -i esp8266-kitchen -n "Kitchen Fan" -t ESP8266 --auto --online; bash' &
    konsole --new-tab -e bash -c './esp_emulator.sh -i esp32s3-bedroom -n "Bedroom AC" -t ESP32-S3 --auto --online; bash' &
    konsole --new-tab -e bash -c './esp_emulator.sh -i esp32c3-garden -n "Garden Sprinkler" -t ESP32-C3 --auto --online; bash' &
    
    print_color $GREEN "🎉 All devices started in separate terminal tabs"
    
else
    print_color $YELLOW "⚠️  No suitable terminal multiplexer found"
    print_color $BLUE "   Starting devices in background..."
    
    # Start devices in background
    ./esp_emulator.sh -i esp32-living -n "Living Room Light" -t ESP32 --auto --online > /tmp/esp-living.log 2>&1 &
    ESP1_PID=$!
    
    ./esp_emulator.sh -i esp8266-kitchen -n "Kitchen Fan" -t ESP8266 --auto --online > /tmp/esp-kitchen.log 2>&1 &
    ESP2_PID=$!
    
    ./esp_emulator.sh -i esp32s3-bedroom -n "Bedroom AC" -t ESP32-S3 --auto --online > /tmp/esp-bedroom.log 2>&1 &
    ESP3_PID=$!
    
    ./esp_emulator.sh -i esp32c3-garden -n "Garden Sprinkler" -t ESP32-C3 --auto --online > /tmp/esp-garden.log 2>&1 &
    ESP4_PID=$!
    
    print_color $GREEN "🎉 All devices started in background"
    print_color $YELLOW "📖 Commands:"
    print_color $BLUE "   tail -f /tmp/esp-*.log     # View device logs"
    print_color $BLUE "   kill $ESP1_PID $ESP2_PID $ESP3_PID $ESP4_PID  # Stop all devices"
    print_color $BLUE "   ps aux | grep esp_emulator # Show running devices"
    echo
    
    echo "Device PIDs: $ESP1_PID $ESP2_PID $ESP3_PID $ESP4_PID" > /tmp/esp-demo-pids.txt
    
    print_color $CYAN "📱 Open your browser to http://localhost:3000 to see all devices!"
    print_color $BLUE "   Press Enter to stop all devices..."
    read
    
    print_color $YELLOW "🛑 Stopping all devices..."
    kill $ESP1_PID $ESP2_PID $ESP3_PID $ESP4_PID 2>/dev/null
    rm -f /tmp/esp-*.log /tmp/esp-demo-pids.txt
    print_color $GREEN "✅ All devices stopped"
fi

#!/bin/bash

# ESP Device Emulator - Interactive Bash Script
# Simulates ESP32/ESP8266 devices for testing the Breeze portal
# Author: Breeze Portal Team
# Date: $(date)

# Colors for better UX
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Default configuration
MQTT_SERVER="localhost"
MQTT_PORT="1883"
DEVICE_ID=""
DEVICE_NAME=""
DEVICE_TYPE="ESP32"
FIRMWARE_VERSION="1.0.0"
DEVICE_STATE="off"
WIFI_STRENGTH=-50
UPTIME=0
FREE_HEAP=200000
UPDATE_INTERVAL=30

# Generated values
IP_ADDRESS=""
MAC_ADDRESS=""
MQTT_CLIENT_ID=""

# Control flags
RUNNING=false
ONLINE=false
AUTO_MODE=false
AUTO_ONLINE=false

# Function to print colored text
print_color() {
    local color=$1
    local text=$2
    echo -e "${color}${text}${NC}"
}

# Function to print banner
print_banner() {
    clear
    print_color $CYAN "
╔══════════════════════════════════════════════════════════════════╗
║                    🔌 ESP Device Emulator 🔌                     ║
║                  For Breeze Smart WiFi Portal                   ║
╚══════════════════════════════════════════════════════════════════╝
"
}

# Function to generate random MAC address
generate_mac() {
    printf '%02x:%02x:%02x:%02x:%02x:%02x\n' $((RANDOM%256)) $((RANDOM%256)) $((RANDOM%256)) $((RANDOM%256)) $((RANDOM%256)) $((RANDOM%256)) | tr '[:lower:]' '[:upper:]'
}

# Function to generate random IP address
generate_ip() {
    echo "192.168.1.$((100 + RANDOM % 50))"
}

# Function to show current device status
show_status() {
    print_color $WHITE "\n📊 Device Status:"
    print_color $BLUE "   Device ID: $DEVICE_ID"
    print_color $BLUE "   Name: $DEVICE_NAME"
    print_color $BLUE "   Type: $DEVICE_TYPE"
    print_color $BLUE "   State: $([ "$DEVICE_STATE" = "on" ] && echo -e "${GREEN}ON${NC}" || echo -e "${RED}OFF${NC}")"
    print_color $BLUE "   Status: $([ "$ONLINE" = true ] && echo -e "${GREEN}ONLINE${NC}" || echo -e "${RED}OFFLINE${NC}")"
    print_color $BLUE "   IP: $IP_ADDRESS"
    print_color $BLUE "   MAC: $MAC_ADDRESS"
    print_color $BLUE "   WiFi: ${WIFI_STRENGTH}dBm"
    print_color $BLUE "   Uptime: ${UPTIME}s"
    print_color $BLUE "   Free Heap: ${FREE_HEAP} bytes"
    echo
}

# Function to publish MQTT message
publish_mqtt() {
    local topic=$1
    local message=$2
    local retain=${3:-false}
    
    if [ "$retain" = true ]; then
        mosquitto_pub -h "$MQTT_SERVER" -p "$MQTT_PORT" -t "$topic" -m "$message" -r 2>/dev/null
    else
        mosquitto_pub -h "$MQTT_SERVER" -p "$MQTT_PORT" -t "$topic" -m "$message" 2>/dev/null
    fi
    
    if [ $? -eq 0 ]; then
        print_color $GREEN "   📤 Published to $topic"
        if [ ${#message} -gt 60 ]; then
            print_color $YELLOW "      Message: ${message:0:60}..."
        else
            print_color $YELLOW "      Message: $message"
        fi
    else
        print_color $RED "   ❌ Failed to publish to $topic"
    fi
}

# Function to send discovery message
send_discovery() {
    local discovery_json=$(cat <<EOF
{
  "id": "$DEVICE_ID",
  "name": "$DEVICE_NAME", 
  "type": "$DEVICE_TYPE",
  "firmware": "$FIRMWARE_VERSION",
  "ip": "$IP_ADDRESS",
  "mac": "$MAC_ADDRESS",
  "state": "$DEVICE_STATE"
}
EOF
)
    publish_mqtt "breeze/devices/$DEVICE_ID/discovery" "$discovery_json" true
}

# Function to send status update
send_status() {
    local status_json=$(cat <<EOF
{
  "online": true,
  "wifi_strength": $WIFI_STRENGTH,
  "uptime": $UPTIME,
  "free_heap": $FREE_HEAP
}
EOF
)
    publish_mqtt "breeze/devices/$DEVICE_ID/status" "$status_json"
}

# Function to send state update
send_state() {
    local state_json=$(cat <<EOF
{
  "state": "$DEVICE_STATE",
  "timestamp": $(date +%s)000
}
EOF
)
    publish_mqtt "breeze/devices/$DEVICE_ID/state" "$state_json"
}

# Function to toggle device state
toggle_state() {
    if [ "$DEVICE_STATE" = "on" ]; then
        DEVICE_STATE="off"
        print_color $RED "   🔴 Device turned OFF"
    else
        DEVICE_STATE="on" 
        print_color $GREEN "   🟢 Device turned ON"
    fi
    send_state
}

# Function to simulate WiFi strength variation
update_wifi_strength() {
    local variation=$((RANDOM % 10 - 5))
    WIFI_STRENGTH=$((WIFI_STRENGTH + variation))
    
    # Keep within realistic bounds
    if [ $WIFI_STRENGTH -lt -80 ]; then
        WIFI_STRENGTH=-80
    elif [ $WIFI_STRENGTH -gt -30 ]; then
        WIFI_STRENGTH=-30
    fi
}

# Function to update uptime and heap
update_metrics() {
    UPTIME=$((UPTIME + UPDATE_INTERVAL))
    FREE_HEAP=$((200000 + RANDOM % 100000))
    update_wifi_strength
}

# Function to start MQTT subscription in background
start_mqtt_listener() {
    print_color $YELLOW "   🔊 Starting MQTT command listener..."
    
    # Kill any existing listener
    pkill -f "mosquitto_sub.*breeze/devices/$DEVICE_ID/command"
    
    # Start new listener in background
    mosquitto_sub -h "$MQTT_SERVER" -p "$MQTT_PORT" -t "breeze/devices/$DEVICE_ID/command/+" | while read -r line; do
        if echo "$line" | grep -q '"state"'; then
            local new_state=$(echo "$line" | grep -o '"state":"[^"]*"' | cut -d'"' -f4)
            if [ "$new_state" != "$DEVICE_STATE" ]; then
                DEVICE_STATE="$new_state"
                print_color $PURPLE "\n   📨 Received command: Set state to $new_state"
                echo "$new_state" > "/tmp/esp_${DEVICE_ID}_state"
                send_state
                show_status
                print_color $CYAN "\n🎮 Commands: [t]oggle [s]tatus [q]uit [h]elp"
                echo -n "   Enter command: "
            fi
        fi
    done &
    
    print_color $GREEN "   ✅ MQTT listener started"
}

# Function to check for remote state changes
check_remote_state() {
    local state_file="/tmp/esp_${DEVICE_ID}_state"
    if [ -f "$state_file" ]; then
        local new_state=$(cat "$state_file")
        if [ "$new_state" != "$DEVICE_STATE" ]; then
            DEVICE_STATE="$new_state"
            rm -f "$state_file"
        fi
    fi
}

# Function to go online
go_online() {
    if [ "$ONLINE" = true ]; then
        print_color $YELLOW "   ⚠️  Device is already online"
        return
    fi
    
    print_color $YELLOW "   🔄 Connecting to MQTT broker..."
    
    # Generate network info first
    IP_ADDRESS=$(generate_ip)
    MAC_ADDRESS=$(generate_mac)
    MQTT_CLIENT_ID="${DEVICE_ID}_emulator_$$"
    
    # Test MQTT connection
    if ! mosquitto_pub -h "$MQTT_SERVER" -p "$MQTT_PORT" -t "test" -m "test" 2>/dev/null; then
        print_color $RED "   ❌ Cannot connect to MQTT broker at $MQTT_SERVER:$MQTT_PORT"
        print_color $YELLOW "      Make sure the broker is running: docker-compose up -d"
        return 1
    fi
    
    ONLINE=true
    print_color $GREEN "   ✅ Connected to MQTT broker"
    print_color $BLUE "   📡 Generated IP: $IP_ADDRESS"
    print_color $BLUE "   📱 Generated MAC: $MAC_ADDRESS"
    
    # Send initial messages
    print_color $YELLOW "   📤 Sending discovery message..."
    send_discovery
    sleep 1
    print_color $YELLOW "   📤 Sending initial status..."
    send_status
    
    # Start command listener
    start_mqtt_listener
    
    print_color $GREEN "   🎉 Device is now ONLINE!"
}

# Function to go offline
go_offline() {
    if [ "$ONLINE" = false ]; then
        print_color $YELLOW "   ⚠️  Device is already offline"
        return
    fi
    
    ONLINE=false
    
    # Kill MQTT listener
    pkill -f "mosquitto_sub.*breeze/devices/$DEVICE_ID/command"
    
    # Clean up temp files
    rm -f "/tmp/esp_${DEVICE_ID}_state"
    
    print_color $RED "   📡 Device is now OFFLINE"
}

# Function to show help
show_help() {
    print_color $WHITE "\n📖 Available Commands:"
    print_color $GREEN "   [t] toggle    - Toggle device state (on/off)"
    print_color $GREEN "   [s] status    - Show current device status"
    print_color $GREEN "   [o] online    - Connect to MQTT broker"
    print_color $GREEN "   [f] offline   - Disconnect from MQTT broker"
    print_color $GREEN "   [a] auto      - Toggle auto mode (random changes)"
    print_color $GREEN "   [c] config    - Reconfigure device settings"
    print_color $GREEN "   [r] restart   - Restart device emulator"
    print_color $GREEN "   [h] help      - Show this help"
    print_color $GREEN "   [q] quit      - Exit emulator"
    echo
}

# Function to configure device
configure_device() {
    print_color $WHITE "\n⚙️  Device Configuration:"
    
    echo -n "   Device ID [$DEVICE_ID]: "
    read input
    [ -n "$input" ] && DEVICE_ID="$input"
    
    echo -n "   Device Name [$DEVICE_NAME]: "
    read input
    [ -n "$input" ] && DEVICE_NAME="$input"
    
    echo -n "   Device Type [$DEVICE_TYPE] (ESP32/ESP8266/ESP32-S3/ESP32-C3): "
    read input
    [ -n "$input" ] && DEVICE_TYPE="$input"
    
    echo -n "   MQTT Server [$MQTT_SERVER]: "
    read input
    [ -n "$input" ] && MQTT_SERVER="$input"
    
    echo -n "   MQTT Port [$MQTT_PORT]: "
    read input
    [ -n "$input" ] && MQTT_PORT="$input"
    
    print_color $GREEN "   ✅ Configuration updated!"
}

# Function to run auto mode
run_auto_mode() {
    if [ "$AUTO_MODE" = true ]; then
        # Random state change (10% chance)
        if [ $((RANDOM % 10)) -eq 0 ]; then
            toggle_state
        fi
        
        # Random offline/online (1% chance)
        if [ $((RANDOM % 100)) -eq 0 ]; then
            if [ "$ONLINE" = true ]; then
                go_offline
                sleep 5
                go_online
            fi
        fi
    fi
}

# Function for initial setup
initial_setup() {
    if [ -z "$DEVICE_ID" ]; then
        print_color $WHITE "🚀 Welcome to ESP Device Emulator!"
        print_color $YELLOW "\nLet's set up your virtual ESP device:\n"
        
        echo -n "   Device ID (e.g., esp32-livingroom): "
        read DEVICE_ID
        [ -z "$DEVICE_ID" ] && DEVICE_ID="esp32-$(date +%s)"
        
        echo -n "   Device Name (e.g., Living Room Light): "
        read DEVICE_NAME
        [ -z "$DEVICE_NAME" ] && DEVICE_NAME="ESP Device $DEVICE_ID"
        
        echo -n "   Device Type [ESP32]: "
        read input
        [ -n "$input" ] && DEVICE_TYPE="$input"
        
        print_color $GREEN "\n✅ Device configured!"
        print_color $BLUE "   ID: $DEVICE_ID"
        print_color $BLUE "   Name: $DEVICE_NAME"
        print_color $BLUE "   Type: $DEVICE_TYPE"
    fi
}

# Function to check dependencies
check_dependencies() {
    if ! command -v mosquitto_pub &> /dev/null; then
        print_color $RED "❌ mosquitto_pub not found!"
        print_color $YELLOW "   Install with: sudo apt-get install mosquitto-clients"
        exit 1
    fi
    
    if ! command -v mosquitto_sub &> /dev/null; then
        print_color $RED "❌ mosquitto_sub not found!"
        print_color $YELLOW "   Install with: sudo apt-get install mosquitto-clients"
        exit 1
    fi
}

# Function to cleanup on exit
cleanup() {
    print_color $YELLOW "\n🧹 Cleaning up..."
    pkill -f "mosquitto_sub.*breeze/devices/$DEVICE_ID/command"
    rm -f "/tmp/esp_${DEVICE_ID}_state"
    print_color $GREEN "   ✅ Cleanup complete"
    print_color $CYAN "   👋 Goodbye!"
    exit 0
}

# Function to parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -i|--id)
                DEVICE_ID="$2"
                shift 2
                ;;
            -n|--name)
                DEVICE_NAME="$2"
                shift 2
                ;;
            -t|--type)
                DEVICE_TYPE="$2"
                shift 2
                ;;
            -s|--server)
                MQTT_SERVER="$2"
                shift 2
                ;;
            -p|--port)
                MQTT_PORT="$2"
                shift 2
                ;;
            -a|--auto)
                AUTO_MODE=true
                shift
                ;;
            -o|--online)
                AUTO_ONLINE=true
                shift
                ;;
            -h|--help)
                echo "ESP Device Emulator"
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  -i, --id ID        Device ID"
                echo "  -n, --name NAME    Device name"
                echo "  -t, --type TYPE    Device type (ESP32, ESP8266, etc.)"
                echo "  -s, --server HOST  MQTT server hostname (default: localhost)"
                echo "  -p, --port PORT    MQTT server port (default: 1883)"
                echo "  -a, --auto         Enable auto mode"
                echo "  -o, --online       Start online"
                echo "  -h, --help         Show this help"
                exit 0
                ;;
            *)
                print_color $RED "Unknown option: $1"
                exit 1
                ;;
        esac
    done
}

# Main interactive loop
main_loop() {
    local last_update=$(date +%s)
    
    while true; do
        local current_time=$(date +%s)
        
        # Auto updates every UPDATE_INTERVAL seconds
        if [ $((current_time - last_update)) -ge $UPDATE_INTERVAL ]; then
            if [ "$ONLINE" = true ]; then
                update_metrics
                send_status
                check_remote_state
                run_auto_mode
            fi
            last_update=$current_time
        fi
        
        # Non-blocking input with timeout
        print_color $CYAN "\n🎮 Commands: [t]oggle [s]tatus [o]nline [f]offline [a]uto [c]onfig [h]elp [q]uit"
        echo -n "   Enter command: "
        
        if read -t 1 -n 1 cmd; then
            echo # New line after input
            case $cmd in
                t|T)
                    if [ "$ONLINE" = true ]; then
                        toggle_state
                    else
                        print_color $RED "   ❌ Device must be online to toggle state"
                    fi
                    ;;
                s|S)
                    show_status
                    ;;
                o|O)
                    go_online
                    ;;
                f|F)
                    go_offline
                    ;;
                a|A)
                    if [ "$AUTO_MODE" = true ]; then
                        AUTO_MODE=false
                        print_color $YELLOW "   🤖 Auto mode DISABLED"
                    else
                        AUTO_MODE=true
                        print_color $GREEN "   🤖 Auto mode ENABLED"
                    fi
                    ;;
                c|C)
                    configure_device
                    ;;
                r|R)
                    print_color $YELLOW "   🔄 Restarting emulator..."
                    exec "$0" "$@"
                    ;;
                h|H)
                    show_help
                    ;;
                q|Q)
                    cleanup
                    ;;
                *)
                    print_color $RED "   ❓ Unknown command: $cmd"
                    print_color $YELLOW "   Type 'h' for help"
                    ;;
            esac
        fi
    done
}

# Trap signals for cleanup
trap cleanup SIGINT SIGTERM

# Main execution
main() {
    print_banner
    
    # Parse command line arguments
    parse_args "$@"
    
    # Check dependencies
    check_dependencies
    
    # Initial setup if needed
    initial_setup
    
    # Show initial status
    show_status
    
    # Auto start online if requested
    if [ "$AUTO_ONLINE" = true ]; then
        go_online
    fi
    
    # Show help initially
    show_help
    
    # Start main loop
    print_color $GREEN "🚀 ESP Device Emulator started!"
    print_color $BLUE "   Press Ctrl+C to exit"
    
    main_loop
}

# Run main function with all arguments
main "$@"

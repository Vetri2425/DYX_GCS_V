import socket
import json

s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(('', 5002))

print("Listening for UDP beacons on port 5002...")
print("Press Ctrl+C to stop\n")

while True:
    data, addr = s.recvfrom(1024)
    print(f'From {addr}: {json.loads(data)}')

from socket import socket, AF_INET, SOCK_DGRAM
from Message import Message
import threading

class UDPChatClient():
    def __init__(self, server_ip: str):
        self.socket = socket(AF_INET, SOCK_DGRAM)
        self.server_address = (server_ip, 12345)
        self.username = None
        self.running = False
    
    def join(self):
        print("Inserire il proprio username: ", end="")
        self.username = input().strip()
        
        join_message = Message(self.username, "JOIN")
        self.socket.sendto(join_message.to_json().encode(), self.server_address)
        
        # Avvia thread per ricevere messaggi
        self.running = True
        receive_thread = threading.Thread(target=self._receive_messages, daemon=True)
        receive_thread.start()
    
    def _receive_messages(self):
        """Thread che riceve messaggi in background"""
        while self.running:
            try:
                data, _ = self.socket.recvfrom(1024)
                message = Message.from_json(data.decode())
                
                if message.recipient and message.recipient == self.username:
                    # Messaggio privato
                    print(f"\n[DM da {message.sender}]: {message.content}")
                else:
                    # Messaggio normale o dal server
                    print(f"\n{message.sender}: {message.content}")
                print("> ", end="", flush=True)
            except:
                break
    
    def send_message(self, content: str):
        # Gestisce sintassi @username per messaggi privati
        recipient = None
        
        if content.startswith("@"):
            # Messaggio privato: @username messaggio
            parts = content.split(" ", 1)
            if len(parts) == 2:
                recipient = parts[0][1:]  # Rimuove @
                content = parts[1]
            else:
                print("Sintassi DM: @username messaggio")
                return
        
        message = Message(self.username, content, recipient)
        self.socket.sendto(message.to_json().encode(), self.server_address)
    
    def leave(self):
        self.running = False
        leave_message = Message(self.username, "LEAVE")
        self.socket.sendto(leave_message.to_json().encode(), self.server_address)
        self.socket.close()
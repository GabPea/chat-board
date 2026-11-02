from socket import socket, AF_INET, SOCK_DGRAM
from Message import Message

class UDPChatServer():
    def __init__(self):
        self.socket = socket(AF_INET, SOCK_DGRAM)
        self.socket.bind(('0.0.0.0', 12345))
        self.running = False
        self.users = {}  # username -> address
    
    def start(self):
        print("Server partito e in ascolto...")
        self.running = True
        
        while self.running:
            try:
                data, addr = self.socket.recvfrom(1024)
                message = Message.from_json(data.decode())
                
                if message.content == "JOIN":
                    self.users[message.sender] = addr
                    print(f"{message.sender} joins the chat")
                    
                elif message.content == "LEAVE":
                    if message.sender in self.users:
                        del self.users[message.sender]
                        
                elif message.content == "/users":
                    # Invia lista utenti al richiedente
                    user_list = ", ".join(self.users.keys())
                    response = Message("SERVER", f"Utenti online: {user_list}")
                    self.socket.sendto(response.to_json().encode(), addr)
                    
                else:
                    # Messaggio privato o broadcast
                    if message.recipient:
                        # Messaggio privato
                        if message.recipient in self.users:
                            recipient_addr = self.users[message.recipient]
                            self.socket.sendto(data, recipient_addr)
                            print(f"> {message.sender} -> {message.recipient}: {message.content}")
                        else:
                            # Utente non trovato
                            error_msg = Message("SERVER", f"Utente {message.recipient} non trovato")
                            self.socket.sendto(error_msg.to_json().encode(), addr)
                    else:
                        # Broadcast a tutti
                        print(f"> {message.sender}: {message.content}")
                        for username, user_addr in self.users.items():
                            if user_addr != addr:  # Non inviare a se stesso
                                self.socket.sendto(data, user_addr)
            except:
                break
    
    def stop(self):
        print("Server stoppato.")
        self.running = False
        self.socket.close()
        print("ARRIVEDERCI")
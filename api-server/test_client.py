"""
Client di test per la Chat Segreta API
Usa questo per testare il server prima di creare l'app iOS
"""
import asyncio
import websockets
import requests
import json
from typing import Optional

BASE_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000"

class ChatClient:
    def __init__(self):
        self.token: Optional[str] = None
        self.username: Optional[str] = None
        self.ws: Optional[websockets.WebSocketClientProtocol] = None
    
    def register(self, username: str, password: str) -> bool:
        """Registra un nuovo utente"""
        try:
            response = requests.post(
                f"{BASE_URL}/api/register",
                json={"username": username, "password": password}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.token = data["access_token"]
                self.username = data["username"]
                print(f"✅ Registrato come {self.username}")
                return True
            else:
                print(f"❌ Errore: {response.json()['detail']}")
                return False
        except Exception as e:
            print(f"❌ Errore connessione: {e}")
            return False
    
    def login(self, username: str, password: str) -> bool:
        """Login con utente esistente"""
        try:
            response = requests.post(
                f"{BASE_URL}/api/login",
                json={"username": username, "password": password}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.token = data["access_token"]
                self.username = data["username"]
                print(f"✅ Login effettuato come {self.username}")
                return True
            else:
                print(f"❌ Errore: {response.json()['detail']}")
                return False
        except Exception as e:
            print(f"❌ Errore connessione: {e}")
            return False
    
    def get_users(self):
        """Ottiene lista utenti"""
        headers = {"Authorization": f"Bearer {self.token}"}
        response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        
        if response.status_code == 200:
            users = response.json()["users"]
            print(f"👥 Utenti registrati: {', '.join(users)}")
        else:
            print("❌ Errore nel recuperare gli utenti")
    
    def get_online_users(self):
        """Ottiene lista utenti online"""
        headers = {"Authorization": f"Bearer {self.token}"}
        response = requests.get(f"{BASE_URL}/api/users/online", headers=headers)
        
        if response.status_code == 200:
            users = response.json()["online_users"]
            print(f"🟢 Utenti online: {', '.join(users) if users else 'Nessuno'}")
        else:
            print("❌ Errore nel recuperare gli utenti online")
    
    def get_messages(self):
        """Ottiene cronologia messaggi"""
        headers = {"Authorization": f"Bearer {self.token}"}
        response = requests.get(f"{BASE_URL}/api/messages", headers=headers)
        
        if response.status_code == 200:
            messages = response.json()["messages"]
            print(f"\n📜 Ultimi {len(messages)} messaggi:")
            for msg in messages:
                sender = msg["sender"]
                content = msg["content"]
                recipient = msg.get("recipient")
                if recipient:
                    print(f"  [DM] {sender} -> {recipient}: {content}")
                else:
                    print(f"  {sender}: {content}")
        else:
            print("❌ Errore nel recuperare i messaggi")
    
    async def connect_websocket(self):
        """Connette al WebSocket"""
        try:
            uri = f"{WS_URL}/ws/{self.token}"
            self.ws = await websockets.connect(uri)
            print(f"🔌 Connesso al WebSocket come {self.username}")
            return True
        except Exception as e:
            print(f"❌ Errore WebSocket: {e}")
            return False
    
    async def send_message(self, content: str, recipient: Optional[str] = None):
        """Invia un messaggio"""
        if not self.ws:
            print("❌ Non connesso al WebSocket")
            return
        
        message = {
            "content": content,
            "recipient": recipient
        }
        
        await self.ws.send(json.dumps(message))
    
    async def receive_messages(self):
        """Riceve messaggi in loop"""
        try:
            async for message in self.ws:
                data = json.loads(message)
                sender = data["sender"]
                content = data["content"]
                recipient = data.get("recipient")
                
                if sender == "SYSTEM":
                    print(f"\n💬 {content}")
                elif recipient:
                    print(f"\n[DM da {sender}]: {content}")
                else:
                    print(f"\n{sender}: {content}")
                
                print("> ", end="", flush=True)
        except websockets.exceptions.ConnectionClosed:
            print("\n❌ Connessione chiusa")
    
    async def interactive_chat(self):
        """Modalità chat interattiva"""
        # Connetti WebSocket
        if not await self.connect_websocket():
            return
        
        # Thread per ricevere messaggi
        receive_task = asyncio.create_task(self.receive_messages())
        
        print("\n💬 Chat attiva! Comandi:")
        print("  - Scrivi normalmente per broadcast")
        print("  - @username messaggio per DM")
        print("  - /users per vedere chi è online")
        print("  - /exit per uscire\n")
        
        try:
            while True:
                message = await asyncio.get_event_loop().run_in_executor(
                    None, input, "> "
                )
                
                if message == "/exit":
                    break
                
                # Parsing @username per DM
                recipient = None
                if message.startswith("@"):
                    parts = message.split(" ", 1)
                    if len(parts) == 2:
                        recipient = parts[0][1:]
                        message = parts[1]
                
                await self.send_message(message, recipient)
                
        except KeyboardInterrupt:
            print("\n👋 Disconnessione...")
        finally:
            receive_task.cancel()
            await self.ws.close()


async def main():
    print("=" * 50)
    print("🔐 CHAT SEGRETA - Client di Test")
    print("=" * 50)
    
    client = ChatClient()
    
    # Menu principale
    while True:
        print("\n1. Registrati")
        print("2. Login")
        print("3. Esci")
        choice = input("\nScelta: ").strip()
        
        if choice == "1":
            username = input("Username: ").strip()
            password = input("Password: ").strip()
            if client.register(username, password):
                break
        elif choice == "2":
            username = input("Username: ").strip()
            password = input("Password: ").strip()
            if client.login(username, password):
                break
        elif choice == "3":
            return
    
    # Menu secondario
    while True:
        print("\n1. Vedi tutti gli utenti")
        print("2. Vedi utenti online")
        print("3. Vedi cronologia messaggi")
        print("4. Inizia chat")
        print("5. Esci")
        choice = input("\nScelta: ").strip()
        
        if choice == "1":
            client.get_users()
        elif choice == "2":
            client.get_online_users()
        elif choice == "3":
            client.get_messages()
        elif choice == "4":
            await client.interactive_chat()
        elif choice == "5":
            break


if __name__ == "__main__":
    asyncio.run(main())

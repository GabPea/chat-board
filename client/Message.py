import json
from cryptography.fernet import Fernet

class Message():
    # Chiave segreta condivisa (generata con Fernet.generate_key())
    SECRET_KEY = b'BbbnMXbAiX4immxGhEfsJ3RuS3g_oazgupvnmnmJcLw='
    _cipher = Fernet(SECRET_KEY)
    
    def __init__(self, sender: str, content: str, recipient: str = None):
        self.sender = sender
        self.content = content
        self.recipient = recipient  # None = broadcast, altrimenti DM
    
    def to_json(self) -> str:
        # Cifra il contenuto prima di inviare
        encrypted_content = self._cipher.encrypt(self.content.encode()).decode()
        return json.dumps({
            "sender": self.sender, 
            "content": encrypted_content,
            "recipient": self.recipient
        })
    
    @staticmethod
    def from_json(json_str: str):
        data = json.loads(json_str)
        # Decifra il contenuto ricevuto
        decrypted_content = Message._cipher.decrypt(data["content"].encode()).decode()
        return Message(data["sender"], decrypted_content, data.get("recipient"))
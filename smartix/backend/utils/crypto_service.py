import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend

class CryptoService:
    def __init__(self):
        # In a real E2EE scenario, keys would be derived per-conversation or per-user.
        # For Phase 3 (Server-side encryption), we use a master key from environment.
        self.master_key = os.getenv("MESSAGING_ENCRYPTION_KEY", "default-secret-key-32-chars-length!!")
        # S'assurer que la clé fait exactement 32 octets (256 bits)
        if isinstance(self.master_key, str):
            if len(self.master_key) < 32:
                self.master_key = self.master_key.ljust(32, "0")
            self.key = self.master_key[:32].encode()
        else:
            self.key = self.master_key
            
        try:
            self.aesgcm = AESGCM(self.key)
        except Exception as e:
            # Fallback sur une clé valide si l'initialisation échoue
            self.key = b"0" * 32
            self.aesgcm = AESGCM(self.key)

    def encrypt(self, plaintext: str) -> str:
        """Encrypts plaintext using AES-256-GCM."""
        if not plaintext:
            return ""
        nonce = os.urandom(12)
        ciphertext = self.aesgcm.encrypt(nonce, plaintext.encode(), None)
        # Combine nonce and ciphertext then encode to base64
        result = base64.b64encode(nonce + ciphertext).decode('utf-8')
        return result

    def decrypt(self, encrypted_text: str) -> str:
        """Decrypts AES-256-GCM encrypted text."""
        if not encrypted_text:
            return ""
        try:
            data = base64.b64decode(encrypted_text)
            nonce = data[:12]
            ciphertext = data[12:]
            decrypted = self.aesgcm.decrypt(nonce, ciphertext, None)
            return decrypted.decode('utf-8')
        except Exception as e:
            # If decryption fails (e.g., data was not encrypted), return original for migration phase
            return encrypted_text

crypto_service = CryptoService()

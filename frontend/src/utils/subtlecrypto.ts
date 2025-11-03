// Generate RSA Key Pair (public and private)

/**
 *
 * First generate private and public key pair by calling generateRSAKeyPair()
 * Save generated keys in a secure location
 *
 * Convert genereate keys to string before storage by calling exportRSAKeyToPEM()
 *
 * Upon encryption and descryption private and public keys in string need to be
 * converted by back to arraybuffer. To do this call importRSAKeyFromPEM()
 *
 *
 *
 */
async function generateRSAKeyPair(): Promise<CryptoKeyPair> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]), // Common exponent for RSA
      hash: "SHA-256", // Hash algorithm used
    },
    true, // Can be exported
    ["encrypt", "decrypt"] // Public key used for encryption, private key for decryption
  );
  return keyPair;
}

// Export the RSA Key Pair to PEM format - this is to convert keys in arraybuffer to string
async function exportRSAKeyToPEM(
  key: CryptoKey,
  isPublicKey: boolean = true
): Promise<string> {
  const exportedKey = await window.crypto.subtle.exportKey(
    isPublicKey ? "spki" : "pkcs8", // Export format (SPKI for public, PKCS8 for private)
    key
  );
  const exportedKeyArray = new Uint8Array(exportedKey);
  const keyString = arrayBufferToBase64(exportedKeyArray);
  return keyString;
}

// Convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary); // Convert to Base64 string
}

// Import the RSA Key from PEM format. this is to convert keys in sting to array buffer
async function importRSAKeyFromPEM(
  pemKey: string,
  isPublicKey: boolean = true
): Promise<CryptoKey> {
  const binaryDerString = window.atob(pemKey);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  const keyFormat = isPublicKey ? "spki" : "pkcs8";
  const importedKey = await window.crypto.subtle.importKey(
    keyFormat,
    binaryDer.buffer,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true, // Key can be used for encryption/decryption
    isPublicKey ? ["encrypt"] : ["decrypt"]
  );
  return importedKey;
}

export const encryptWithRSA = async (
  publicKey: string,
  text: string
): Promise<string | undefined> => {
  // convert token string to cryptokey type
  const convertedPublickKey = await importRSAKeyFromPEM(publicKey, true);

  // encode text
  const enc = new TextEncoder();
  const encodedText = enc.encode(text);

  // encrypt text
  try {
    const encryptedData = await window.crypto.subtle.encrypt(
      {
        name: "RSA-OAEP", // Encryption algorithm
      },
      convertedPublickKey, // Public key for encryption
      encodedText // The text to encrypt
    );

    // Convert ArrayBuffer to Base64
    const encryptedDataArray = new Uint8Array(encryptedData);
    const base64Token = arrayBufferToBase64(encryptedDataArray);

    return base64Token; // Return Base64 encoded token
  } catch (err) {
    console.error("Encryption failed", err);
  }
};

export const decryptWithRSA = async (
  privateKey: string,
  encryptedDataString: string // Accept a string instead of ArrayBuffer
): Promise<string | undefined> => {
  // Convert the private key string to a CryptoKey
  const convertedPrivateKey = await importRSAKeyFromPEM(privateKey, false);

  // Helper function to convert base64 string to ArrayBuffer
  const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = window.atob(base64); // Decode base64 to binary string
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  // Convert the encrypted data string to ArrayBuffer
  const encryptedData = base64ToArrayBuffer(encryptedDataString);

  try {
    const decryptedData = await window.crypto.subtle.decrypt(
      {
        name: "RSA-OAEP", // Decryption algorithm
      },
      convertedPrivateKey, // Private key for decryption
      encryptedData // The encrypted data as ArrayBuffer
    );

    const dec = new TextDecoder();
    const decryptedText = dec.decode(decryptedData);

    return decryptedText;
  } catch (err) {
    console.error("Decryption failed", err);
  }
};

// Save keys to localStorage
function saveKeysToLocalStorage(
  publicKeyPEM: string,
  privateKeyPEM: string
): void {
  localStorage.setItem("publicKey", publicKeyPEM);
  localStorage.setItem("privateKey", privateKeyPEM);
}

// Load keys from localStorage
function loadKeysFromLocalStorage(): {
  publicKeyPEM: string | null;
  privateKeyPEM: string | null;
} {
  const publicKeyPEM = localStorage.getItem("publicKey");
  const privateKeyPEM = localStorage.getItem("privateKey");

  return { publicKeyPEM, privateKeyPEM };
}

// Example usage:
async function runEncryptionDecryption(): Promise<void> {
  const { publicKey, privateKey } = await generateRSAKeyPair();

  // Export keys to PEM format
  const publicKeyPEM = await exportRSAKeyToPEM(publicKey, true);
  const privateKeyPEM = await exportRSAKeyToPEM(privateKey, false);

  // Save keys to localStorage
  saveKeysToLocalStorage(publicKeyPEM, privateKeyPEM);

  const { publicKeyPEM: savedPublicKeyPEM, privateKeyPEM: savedPrivateKeyPEM } =
    loadKeysFromLocalStorage();
  let encryptedData;
  if (savedPublicKeyPEM && savedPrivateKeyPEM) {
    // Import keys from PEM format
    // const savedPublicKey = await importRSAKeyFromPEM(savedPublicKeyPEM, true);
    // const savedPrivateKey = await importRSAKeyFromPEM(
    //   savedPrivateKeyPEM,
    //   false
    // );
    await importRSAKeyFromPEM(savedPublicKeyPEM, true);
    await importRSAKeyFromPEM(savedPrivateKeyPEM, false);

    encryptedData = await encryptWithRSA(savedPublicKeyPEM, "hello");

    // Decrypt the message with the private key
    // await decryptWithRSA(savedPrivateKey, encryptedData);
  }
  //  encryptedData = await encryptWithRSA(savedPublicKeyPEM, "hello");

  if (encryptedData) {
    // Load keys from localStorage (simulating reuse of keys)
    const {
      publicKeyPEM: savedPublicKeyPEM,
      privateKeyPEM: savedPrivateKeyPEM,
    } = loadKeysFromLocalStorage();

    if (savedPublicKeyPEM && savedPrivateKeyPEM) {
      // Import keys from PEM format
      // const savedPublicKey = await importRSAKeyFromPEM(savedPublicKeyPEM, true);
      // const savedPrivateKey = await importRSAKeyFromPEM(
      //   savedPrivateKeyPEM,
      //   false
      // );
      await importRSAKeyFromPEM(savedPublicKeyPEM, true);
      await importRSAKeyFromPEM(savedPrivateKeyPEM, false);

      // Decrypt the message with the private key
      // await decryptWithRSA(savedPrivateKey, encryptedData);
    }
  }
}

runEncryptionDecryption();

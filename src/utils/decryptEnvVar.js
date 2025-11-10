import crypto from 'crypto';

export const decryptEnvVar = (encryptedValue, encryptionKey) => {
    const [ivHex, encryptedHex] = encryptedValue.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedText = Buffer.from(encryptedHex, 'hex');

    const key = crypto.createHash('sha256').update(encryptionKey).digest();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    let decrypted = decipher.update(encryptedText, null, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
};


export const encryptEnvVar = (plainText, encryptionKey) => {
  // Generate a random IV (16 bytes for AES-256-CBC)
  const iv = crypto.randomBytes(16);

  // Derive the encryption key (same as decryption)
  const key = crypto.createHash("sha256").update(encryptionKey).digest();

  // Create cipher
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

  // Encrypt
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");

  // Return in the format "iv:encryptedText"
  return `${iv.toString("hex")}:${encrypted}`;
};

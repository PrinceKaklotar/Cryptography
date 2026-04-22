# 🔐 Hybrid Post-Quantum Cryptography Visualizer

🚀 Live Demo: https://hybrid-post-quantum-cryptography.vercel.app/

A web-based cryptography platform that demonstrates and simulates a **hybrid encryption system** combining classical and post-quantum algorithms.

This project not only performs secure file transfer but also provides an **interactive visualization** of how modern cryptographic systems work.

---

## ✨ Features

- 🔑 Hybrid Key Exchange using:
  - ECDH (Elliptic Curve Diffie-Hellman)
  - Kyber (ML-KEM - Post-Quantum Cryptography)

- 🔐 Secure Encryption:
  - AES-256-GCM (confidentiality + integrity)
  - SHA-256 for key derivation

- 🌐 Interactive Web Interface:
  - Visualize key generation and exchange
  - Step-by-step encryption & decryption flow

- ⚡ Real-time simulation of cryptographic workflow

---

## 🧠 How It Works

1. **Key Exchange Phase**
   - ECDH generates a shared secret
   - Kyber generates a post-quantum secure key

2. **Key Derivation**
   - Both secrets are combined
   - SHA-256 derives a final symmetric key

3. **Encryption**
   - AES-256-GCM encrypts the file/message

4. **Decryption**
   - Same derived key is used to decrypt securely

---
## 🏗️ Project Structure

```
CRYPTO/
├── index.html
├── demo.html
├── how-it-works.html
├── security.html
├── test.html
│
├── css/
│   └── style.css
│
├── js/
│   ├── aes.js        # AES encryption logic
│   ├── ecdh.js       # ECDH key exchange
│   ├── lwe.js        # Kyber (lattice-based logic)
│   ├── hybrid.js     # Hybrid crypto integration
│   └── demo.js       # Visualization logic
```


## 🛠️ Tech Stack

- HTML, CSS, JavaScript
- AES-256-GCM
- ECDH
- Kyber (ML-KEM - Lattice-based cryptography)
- SHA-256

---

## 🎯 Key Highlights

- 💡 Combines **classical + post-quantum cryptography**
- 🧩 Modular crypto engine (separate JS implementations)
- 🎨 Visualization-focused learning tool
- 🔒 End-to-end secure file handling



---

## 🚀 Future Improvements

- Add backend for real-world file transfer
- Improve Kyber implementation accuracy
- Add performance comparison (ECDH vs Kyber)
- User authentication system

---

## 📚 Learning Outcomes

- Understanding hybrid cryptographic systems
- Hands-on implementation of encryption algorithms
- Visualization of complex security concepts
- Frontend-based simulation of secure workflows

---

## ⭐ If you like this project

Give it a star ⭐ and share it!

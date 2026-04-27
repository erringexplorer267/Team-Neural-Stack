# 🌌 Neural Stack: Cyber Fairness Console

Neural Stack is a high-performance bias audit engine designed to detect, analyze, and mitigate algorithmic bias in tabular datasets. It combines a robust **FastAPI** backend with an immersive **Cyberpunk-inspired React** dashboard.

![License](https://img.shields.io/badge/license-MIT-cyan)
![Python](https://img.shields.io/badge/python-3.10+-blue)
![React](https://img.shields.io/badge/react-18-61dafb)

## ✨ Features

- **🛡️ Bias Intelligence**: Automated detection of Disparate Impact and Statistical Parity Difference.
- **🤖 Agentic Reasoning**: A live Cyberpunk terminal that visualizes the AI agent's internal investigation trace.
- **📈 Executive HUD**: Real-time visualization of selection rates using Recharts.
- **📄 Audit Report Generator**: Instant generation of professional Markdown reports with "Copy to Clipboard" and download features.
- **🔮 Simulation Lab**: Hypothetical re-weighting simulations to project fairness improvements.

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- [Google Gemini API Key](https://aistudio.google.com/app/apikey)

### 2. Setup

From the root directory, install all dependencies:

```bash
# Install root helper dependencies
npm install

# Install Frontend dependencies
cd client && npm install && cd ..

# Install Backend dependencies
python -m pip install -r server/requirements.txt
```

### 3. Environment Configuration
Create a `.env` file in the `server/` directory:
```bash
cp server/.env.example server/.env
```
Add your Gemini API key:
```env
GEMINI_API_KEY=your_key_here
```

### 4. Running the Stack
Run both the frontend and backend simultaneously from the root:
```bash
npm run dev
```

---

## 🏗️ Architecture

- **Backend**: FastAPI (Python)
- **Frontend**: React + Vite + Tailwind CSS
- **AI Engine**: Google Gemini (via `google-generativeai`)
- **Visuals**: Lucide Icons + Recharts
- **Deployment**: Monorepo structure ready for Vercel/Render.

## 🛠️ API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/upload` | POST | Upload CSV and extract sensitive attributes. |
| `/analyze` | POST | Calculate core fairness metrics. |
| `/agent-reasoning` | POST | Trigger AI agent reasoning and summary generation. |
| `/simulate-mitigation` | POST | Simulate bias mitigation impact. |
| `/report` | POST | Generate formatted Markdown audit report. |

---

## 📜 License
Neural Stack is released under the [MIT License](LICENSE).

---
*Built for the future of ethical AI.*

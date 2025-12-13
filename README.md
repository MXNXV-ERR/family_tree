# 🌳 AI-Powered Family Tree

A modern, interactive Family Tree application built with Next.js, Firebase, and Gemini AI. Visualize your ancestry, manage family members with photos, and ask an AI assistant to explain complex relationships in your native language.

![Project Banner](public/banner.png) *<!-- Add a banner image here if you have one, otherwise remove or replace -->*

## ✨ Features

*   **interactive Graph**: Visualize your family connections using a dynamic, auto-layout graph (powered by React Flow & Dagre).
*   **🤖 AI Relationship Assistant**: Built-in Gemini Chat that explains relationships (e.g., "What is my father's brother to me?") in English or regional languages like Gujarati.
*   **📸 Member Management**: Add and edit family members with detailed profiles, including photos (stored efficiently as Base64/Data URLs).
*   **👤 "Me" Node Detection**: Mark yourself in the tree, and the app (and AI) automatically understands your position relative to others.
*   **🔐 Secure**: User authentication and data storage via Firebase (Auth & Firestore).
*   **📱 Responsive**: Fully responsive design that works beautifully on desktop and mobile.

## 🛠️ Tech Stack

*   **Frontend**: Next.js 14, React, Tailwind CSS, Framer Motion
*   **Visualization**: React Flow, Dagre (for auto-layout)
*   **AI**: Google Gemini API (`gemini-2.5-flash` / `pro`)
*   **Backend/BaaS**: Firebase (Authentication, Firestore Database)
*   **Language**: TypeScript

## 🚀 Getting Started

### Prerequisites

*   Node.js (v18+)
*   A Firebase Project
*   A Google Cloud API Key (for Gemini)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/family-tree.git
    cd family-tree
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment:**
    Create a `.env.local` file in the root directory:
    ```env
    NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
    NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
    GEMINI_API_KEY=your_gemini_api_key
    ```

4.  **Run the development server:**
    ```bash
    npm run dev
    ```

5.  Open [http://localhost:3000](http://localhost:3000) with your browser.

## 🧠 Smart AI Chat

The built-in chat isn't just a wrapper. It's context-aware:
*   It knows who **YOU** are (based on the "Me" node).
*   It calculates the shortest path between family members using a graph algorithm.
*   It sends this context to Gemini to provide culturally accurate terms (e.g., distinguishing between "Paternal Uncle" (Kaka) and "Maternal Uncle" (Mama)).

## 📸 Screenshots

*(Add screenshots of your Graph View and Chat Interface here)*

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

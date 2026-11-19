# AI Career Copilot

An AI-powered resume analyzer that compares a candidate's resume against a target job description using the Google Gemini API and a secure Vercel serverless backend.

## Features

- **ATS Compatibility Score (0–100)** and concise executive summary
- **Skill & Keyword Breakdown**: Matching skills, missing skills, and missing ATS keywords
- **Strengths, Weaknesses & Actionable Improvements**
- **Fresh Graduate / Student Advisor Mode**: Evaluates academic projects, internships, coursework, and technical skills fairly
- **PDF Resume Upload**: Extracts text directly in the browser using PDF.js
- **Download Analysis as PDF**: Exports a formatted report using jsPDF
- **Analysis History**: Saves past analyses with timestamps in `localStorage` (View, Delete, Clear All)
- **Light / Dark Mode**: Smooth theme toggle saved in `localStorage`
- **Secure Architecture**: Keeps `GEMINI_API_KEY` private on the server via `/api/analyze`

## Folder Structure

```text
ai-career-copilot/
├── api/
│   └── analyze.js     # Vercel serverless endpoint (calls Gemini API securely)
├── index.html         # Frontend UI (HTML, CSS, JavaScript)
├── .gitignore         # Prevents committing .env files
└── README.md          # Setup and deployment guide
```

## Deploy Securely on Vercel

1. Push this folder to a GitHub repository (or deploy with the Vercel CLI).
2. Import the project in **Vercel** (`vercel.com`).
3. Go to **Project Settings → Environment Variables**.
4. Add a new variable:
   - **Name**: `GEMINI_API_KEY`
   - **Value**: Your Gemini API key from Google AI Studio (`aistudio.google.com`)
5. Click **Save** and **Redeploy** the project.

## Run Locally with Vercel CLI

1. Install Vercel CLI (`npm i -g vercel`) if you haven't already.
2. Create a `.env.local` file in the project root:
   ```env
   GEMINI_API_KEY=YOUR_API_KEY_HERE
   ```
3. Run:
   ```bash
   vercel dev
   ```
4. Open the local URL shown in your terminal.

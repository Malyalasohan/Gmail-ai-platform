# Gmail AI Platform

An AI-powered Gmail productivity platform that combines Gmail integration, Retrieval-Augmented Generation (RAG), AI-powered email assistance, workflow automation, and executive insights into a single modern SaaS application.

---

# Features

## Authentication

* Google OAuth Login
* Secure Session Management using NextAuth

## Gmail Integration

* Gmail Sync
* Inbox Management
* Thread View
* Search Emails
* Star Emails
* Archive Emails
* Delete Emails
* AI Reply

## AI Features

* AI Inbox Chat
* AI Email Summarization
* AI Reply Generator
* AI Email Composer
* Executive Daily Brief
* Smart Priority Detection
* Task Extraction
* Workflow Automation

## AI Provider Architecture

### Primary Provider

* Google Gemini

### Automatic Fallback

* NVIDIA NIM (Llama)

The application automatically switches to NVIDIA NIM whenever Gemini becomes unavailable due to:

* Rate Limits
* Quota Exhaustion
* Timeout
* Temporary Server Errors

---

# Tech Stack

## Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS

## Backend

* Next.js API Routes

## Database

* Supabase

## Authentication

* Google OAuth
* NextAuth

## AI

* Google Gemini
* NVIDIA NIM
* Retrieval-Augmented Generation (RAG)

---

# Project Structure

```
app/
components/
hooks/
lib/
public/
types/
```

---

# Installation

Clone the repository

```bash
git clone <repository-url>
```

Install dependencies

```bash
npm install
```

Create a `.env.local` file and configure:

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

GEMINI_API_KEY=
NVIDIA_NIM_API_KEY=
```

Run the project

```bash
npm run dev
```

Production Build

```bash
npm run build
npm start
```

---

# Core Modules

* AI Chat
* Inbox Management
* Email Summaries
* AI Compose
* AI Reply
* Executive Dashboard
* Workflow Automation

---

# Future Enhancements

* Outlook Integration
* Slack Integration
* Voice Assistant
* Mobile Application
* Team Collaboration
* Calendar Intelligence

---

# Author

**Malyala Sohan Gupta**

B.Tech CSE (AI & ML)

Woxsen University

---

# License

MIT License

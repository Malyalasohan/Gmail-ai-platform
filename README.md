# Gmail AI Platform

An AI-powered Gmail productivity platform built with **Next.js**, **Supabase**, **Google OAuth**, and **Google Gemini AI**. The platform helps users manage emails intelligently using AI-powered summarization, semantic search, Retrieval-Augmented Generation (RAG), workflow automation, and executive insights through a modern SaaS interface.

---

# Features

## Authentication

* Google OAuth Login
* Secure Session Management using NextAuth

## Gmail Integration

* Gmail Synchronization
* Inbox Management
* Thread View
* Email Search
* Star Emails
* Archive Emails
* Delete Emails
* AI Reply Assistance

## AI Features

* AI Inbox Chat
* AI Email Summarization
* AI Email Composer
* AI Reply Generator
* Executive Daily Brief
* Smart Priority Detection
* Task Extraction
* Workflow Automation

## AI Provider Architecture

### Primary Provider

* Google Gemini

### Automatic Fallback

* NVIDIA NIM (Meta Llama)

The application automatically switches to NVIDIA NIM whenever Gemini is unavailable because of:

* Rate Limits
* Quota Exhaustion
* Timeouts
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

* NextAuth
* Google OAuth

## AI Stack

* Google Gemini
* NVIDIA NIM
* Retrieval-Augmented Generation (RAG)

---

# Project Structure

```text
app/
components/
hooks/
lib/
public/
types/
```

---

# Installation

### Clone Repository

```bash
git clone https://github.com/<your-username>/gmail-ai-platform.git
```

### Install Dependencies

```bash
npm install
```

### Configure Environment Variables

Create a `.env.local` file.

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

GEMINI_API_KEY=
NVIDIA_NIM_API_KEY=
```

### Run Development Server

```bash
npm run dev
```

Open:

```
http://localhost:3000
```

### Production Build

```bash
npm run build
npm start
```

---

# Core Modules

* AI Inbox Chat
* Gmail Inbox
* Email Thread View
* Email Summaries
* AI Compose
* AI Reply
* Executive Dashboard
* Workflow Automation
* Semantic Email Search

---

# Architecture

The application follows a modern SaaS architecture consisting of:

* Next.js Frontend
* Next.js API Routes
* Supabase Database
* Google OAuth Authentication
* Gmail API Integration
* RAG Pipeline
* Gemini AI with NVIDIA NIM Automatic Fallback

---

# Future Enhancements

* Outlook Integration
* Microsoft 365 Support
* Slack Integration
* Voice Assistant
* Mobile Application
* Team Collaboration
* Calendar Intelligence

---

# Author

**Malyala Sohan Gupta**

B.Tech Computer Science & Engineering (AI & ML)

Woxsen University

---

# License

This project is developed for educational and technical assessment purposes.

# Vega - Job Search Assistant MVP

Vega is an AI-powered (currently rules-based) job search assistant designed to help candidates track applications, deterministically score job descriptions against their profiles, and manage their hiring pipeline.

## Architecture

This is a full-stack monorepo:
- **Frontend**: React, TypeScript, Vite, TailwindCSS
- **Backend**: Node.js, Express, TypeScript, Prisma (PostgreSQL)
- **MCP Layer**: Located in `backend/src/mcp`, this layer provides a Model Context Protocol architecture so that future LLMs or Chrome extensions can use the backend services securely.

## Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL (or use the provided `docker-compose.yml`)

### 1. Database Setup
```bash
# Start PostgreSQL via Docker
docker-compose up -d
```

### 2. Backend Setup
```bash
cd backend
npm install
npm run seed  # Pushes schema to DB and seeds data
npm run dev   # Starts server on http://localhost:3001
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev   # Starts React app on http://localhost:5173
```

## Features
- **Deterministic JD Scoring**: Paste a job description and see a score based on your years of experience, target domains, and skills.
- **Pipeline Tracking**: View active applications and their current status.
- **Candidate Profile**: Define your core skills, target roles, and preferences to improve scoring accuracy.
- **MCP-Ready**: Tool contracts are defined in `backend/src/mcp/toolContracts.ts` for future agentic workflows.

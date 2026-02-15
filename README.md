# DecodeX - The Great Signal Mystery

DecodeX is a React/TypeScript quiz application themed as "The Great Signal Mystery" - a vintage detective-style investigative game for the IEEE Signal Processing Society. It's a multiplayer quiz platform with team-based gameplay, power-ups, and real-time updates powered by Supabase.

## Project Overview

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Supabase (PostgreSQL database with real-time subscriptions)
- **Styling**: Tailwind CSS with custom vintage detective theme
- **State Management**: React Context (GameContext)
- **Authentication**: Simple team-based authentication via Supabase

## 🕵️‍♂️ Key Features

### 🎮 Immersive Gameplay
- **Vintage Detective Theme**: A fully styled "Great Signal Mystery" aesthetic with custom fonts, colors, and UI elements.
- **Interactive Map**: Navigate through the game using a vintage-style path map.
- **Real-time Leaderboard**: Live ranking of teams based on scores and completion time.
- **Live Updates**: Real-time game state synchronization using Supabase.

### 🧩 Advanced Question System
- **Multi-Media Support**: Questions can include text, images, video, audio, and file attachments.
- **Branching Narratives**: Strategic gameplay with "Speed Path" (Easy) vs "Challenge Path" (Hard) choices.
- **Rich Feedback**: Immediate feedback on answers with detailed explanations.

### ⚡ Power-Ups & Strategy
- **Brain Boost**: Activate to earn double points for a limited time.
- **Hint System**: Unlock clues for difficult puzzles.
- **Question Skips**: Strategically bypass challenging questions.
- **Double Points**: Multipliers for high-stakes answers.

### 🛠️ Admin & Management
- **Comprehensive Admin Panel**: Full control over questions, teams, and game flow.
- **Bulk Operations**: Import/Export questions via CSV/JSON for easy management.
- **Analytics Dashboard**: Track question performance and team progress stats.
- **Global Announcements**: Send real-time messages to all active players.

## Development Commands

### Development Server
```bash
npm run dev
```
Start the Vite development server (usually runs on http://localhost:5173)

### Build Production
```bash
npm run build
```
Build the application for production deployment

### Linting
```bash
npm run lint
```
Run ESLint to check code quality and style

### Preview Production Build
```bash
npm run preview
```
Preview the production build locally

## Architecture

### Main Application Flow
1. **App.tsx** - Root component managing view routing and global state
2. **LandingPage** - Entry point with vintage detective theme
3. **PlayerLogin/AdminLogin** - Separate authentication flows
4. **PlayerDashboard** - Team interface with map/detail views
5. **AdminPanel** - Question management and game controls
6. **QuestionInterface** - Interactive question presentation

### Database Integration
- **Supabase Client**: Database connection and types
- Real-time subscriptions for live updates
- Server-side functions for answer verification and branching logic
- Row-level security for admin vs player access

### Key Tables
- `teams`: Team information, scores, power-ups, progress
- `questions`: Main questions with media support
- `choice_questions`: Branching question variants
- `game_settings`: Global game state (active/paused)

## Configuration

- Environment variables needed: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Custom CSS variables defined in `src/index.css` for theming

# DecodeX - The Great Signal Mystery

DecodeX is a React/TypeScript quiz application themed as "The Great Signal Mystery" - a vintage detective-style investigative game for the IEEE Signal Processing Society. It's a multiplayer quiz platform with team-based gameplay, power-ups, and real-time updates powered by Supabase.

## Project Overview

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Supabase (PostgreSQL database with real-time subscriptions)
- **Styling**: Tailwind CSS with custom vintage detective theme
- **State Management**: React Context (GameContext)
- **Authentication**: Simple team-based authentication via Supabase

## Key Features

- **Branching Questions**: Questions can have easy/hard path choices
- **Power-ups System**: Teams get hints, skips, double points, brain boost
- **Real-time Updates**: Live leaderboard and game state changes
- **Admin Panel**: Full question management, analytics, announcements
- **Vintage UI Theme**: Complete detective/newspaper aesthetic with custom CSS

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

# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

DecodeX is a React/TypeScript quiz application themed as "The Great Signal Mystery" - a vintage detective-style investigative game for the IEEE Signal Processing Society. It's a multiplayer quiz platform with team-based gameplay, power-ups, and real-time updates powered by Supabase.

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

### Test a Single Component
Since there are no formal tests, you can test individual components by temporarily importing and rendering them in the main App.tsx file.

## Architecture Overview

### Core Architecture
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Supabase (PostgreSQL database with real-time subscriptions)
- **Styling**: Tailwind CSS with custom vintage detective theme
- **State Management**: React Context (GameContext)
- **Authentication**: Simple team-based authentication via Supabase

### Key Components Structure

#### Main Application Flow
1. **App.tsx** - Root component managing view routing and global state
2. **LandingPage** - Entry point with vintage detective theme
3. **PlayerLogin/AdminLogin** - Separate authentication flows
4. **PlayerDashboard** - Team interface with map/detail views
5. **AdminPanel** - Question management and game controls
6. **QuestionInterface** - Interactive question presentation

#### State Management
- **GameContext** (`src/context/GameContext.tsx`) - Central state management
  - Teams data with scores, power-ups, progress tracking
  - Questions with branching logic support
  - Real-time game state (active/paused)
  - Database operations (CRUD for questions, answer verification)

#### Database Integration
- **Supabase Client** (`src/lib/supabase.ts`) - Database connection and types
- Real-time subscriptions for live updates
- Server-side functions for answer verification and branching logic
- Row-level security for admin vs player access

### Key Features
- **Branching Questions**: Questions can have easy/hard path choices
- **Power-ups System**: Teams get hints, skips, double points, brain boost
- **Real-time Updates**: Live leaderboard and game state changes
- **Admin Panel**: Full question management, analytics, announcements
- **Vintage UI Theme**: Complete detective/newspaper aesthetic with custom CSS

### Database Schema (Key Tables)
- `teams` - Team information, scores, power-ups, progress
- `questions` - Main questions with media support
- `choice_questions` - Branching question variants
- `game_settings` - Global game state (active/paused)
- Views: `public_questions_secure` (player), `admin_questions` (admin)

### File Structure Patterns
- **Components**: Organized by feature (`src/components/`)
- **Types**: Centralized in `src/types/game.ts`
- **Hooks**: Custom hooks for toast notifications and announcements
- **Context**: React Context for global state
- **Library**: Utilities and external service integrations

### Development Notes
- Environment variables needed: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Custom CSS variables defined in `src/index.css` for theming
- Real-time features depend on Supabase connection
- Admin access hidden behind hover interaction on landing page
- Questions support multiple media types (text, image, video, audio, file)
- Simple password hashing used (not production-ready)

### Common Development Tasks
- **Add new question types**: Extend the `type` enum in `game.ts` and update form handling
- **Modify power-ups**: Update the power-ups object structure in team interface
- **Change theme**: Modify CSS variables in `:root` section of `index.css`
- **Add new views**: Update App.tsx view routing and add corresponding components
- **Database changes**: Create new Supabase migrations in the `supabase/migrations/` folder

### Supabase Functions
- Located in `supabase/functions/admin-auth/` 
- Contains server-side logic for authentication and game mechanics
- Migrations define database schema and stored procedures

### Testing Approach
- No formal test framework configured
- Manual testing through the development server
- Use browser dev tools for debugging real-time subscriptions
- Test different user flows: team registration → login → questions → completion
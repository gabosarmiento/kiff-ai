# CLAUDE.md - Kiff AI Project Knowledge

## Project Overview
Kiff AI is a monorepo project for building and deploying AI-powered applications. The project has evolved to focus on a component library and UI development workflow.

## Repository Structure
```
kiff-ai/
├── backend-lite-v2/      # ACTIVE: Production backend service (AWS App Runner)
├── storybookv0/          # ACTIVE: Component library and UI showcase
├── frontend-lite/        # ACTIVE: Next.js frontend application
├── backend/              # LEGACY: Not in use
├── backend-lite/         # LEGACY: Not in use
├── docs/                 # Project documentation
├── terraform/            # Infrastructure as code
└── various config files
```

## Key Components Removed
- **frontend/** directory - LEGACY React frontend was completely removed
- **.venv/** directory - Python virtual environment cleaned up
- Various test files and broken services cleaned up

## Active Development Areas

### StorybookV0 (Primary Focus)
**Location:** `/storybookv0/`
**Purpose:** Component library and UI development
**Deployment:** Vercel at https://storybookv0-kgui1xb8v-gabosarmientos-projects.vercel.app

**Key Components:**
- `ApiExtractionLoading` - Loading states for API extraction
- `ApiExtractionPreviewTabs` - Tabbed preview interface
- `ApiExtractionResults` - Display extraction results
- `ApiExtractorPage` - Main extractor interface
- `KiffComposePanel` - Workflow composition
- `KiffResultConfigPage` - Result configuration
- `LeftSidebarNav` - Navigation sidebar
- `NavBar` - Top navigation
- `LoginPage` & `SignUpPage` - Authentication pages
- `TopRightActionBar` - User actions
- Admin components: `ModelAdmin`, `TenancyAdmin`, `UserAdmin`

**Build & Deploy:**
```bash
cd storybookv0
npm run build          # Build storybook
vercel --prod          # Deploy to production
```

### Frontend-Lite (Active Frontend)
**Location:** `/frontend-lite/`
**Technology:** Next.js
**Purpose:** The ONLY active frontend application

### Backend-Lite-v2 (Active Backend)
**Location:** `/backend-lite-v2/`
**Purpose:** The ONLY active backend service
**Deployment:** AWS App Runner at https://rfn5agrmiw.eu-west-3.awsapprunner.com

## Legacy/Unused Components
- **frontend/** - REMOVED: Legacy React frontend 
- **backend/** - LEGACY: Not in active use
- **backend-lite/** - LEGACY: Not in active use

## Git Workflow
**Current Branch:** `vercel-setup`
**Remote:** `https://github.com/gabosarmiento/kiff-ai.git`

**Authentication Setup:**
- GitHub CLI configured for user `gabosarmiento`
- Git authentication setup with `gh auth setup-git`

**Recent Commits:**
- `c9f64fd` - Enhanced storybook components and navigation
- `b188447` - Removed legacy frontend, enhanced storybookv0
- `bcec198` - Successfully deployed monorepo with frontend-lite and storybookv0

## Deployment Configuration

### Vercel Deployment (Storybook)
**File:** `storybookv0/vercel.json`
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "version": 2,
  "framework": null,
  "buildCommand": "npx storybook build",
  "outputDirectory": "storybook-static"
}
```

**Live URL:** https://storybookv0-kgui1xb8v-gabosarmientos-projects.vercel.app

## Development Commands

### Storybook Development
```bash
cd storybookv0
npm run storybook      # Run dev server on port 3001
npm run build         # Build for production
```

### Deployment
```bash
git add storybookv0/
git commit -m "feat: update storybook components"
git push origin vercel-setup
cd storybookv0 && vercel --prod
```

## Component Library Architecture
The storybookv0 uses:
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **React Hot Toast** for notifications
- **Vite** for building

## Package Dependencies
Key libraries in use:
- `clsx` & `tailwind-merge` for className utilities
- `react-router-dom` for routing
- `@storybook/react-vite` for Storybook
- `esbuild` & `rollup` for building

## Recent Changes & Improvements
1. **Frontend Cleanup** - Removed entire legacy frontend/ directory
2. **Component Enhancement** - Added new API extraction and admin components
3. **Navigation Improvements** - Enhanced sidebar and navbar components
4. **Deployment Optimization** - Streamlined Vercel deployment process
5. **Repository Cleanup** - Removed .venv, test files, and unused services

## Authentication & Tools
- **GitHub CLI:** Available and configured
- **Vercel CLI:** Available and configured
- **Git:** Setup with HTTPS authentication via GitHub CLI

## Development Workflow
1. Work in `storybookv0/` directory for UI components
2. Create/update `.stories.tsx` files for each component
3. Test locally with `npm run storybook`
4. Commit changes to `vercel-setup` branch
5. Deploy with `vercel --prod` from storybookv0 directory
6. Push commits to GitHub

## Known Issues & Notes
- Some Storybook build warnings about chunk sizes (can be optimized)
- Build process takes ~15-20 seconds on Vercel
- React Hot Toast shows "use client" warnings (can be ignored)

## Future Development Areas
- Continue enhancing component library
- Add more stories and documentation
- Optimize build performance
- Expand admin interface components
- Integrate with backend APIs

## Important Files to Monitor
- `storybookv0/package.json` - Dependencies and scripts
- `storybookv0/vercel.json` - Deployment configuration
- `storybookv0/src/components/ui/` - All UI components
- `CLAUDE.md` - This knowledge file (update as needed)

---
*Last Updated: 2025-08-09*
*Primary Focus: Storybook component library development and deployment*
*Active Stack: backend-lite-v2 + frontend-lite + storybookv0*
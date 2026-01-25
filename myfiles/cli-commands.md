# SACRED CLI Commands Reference

## Development

```bash
# Start BOTH frontend and backend (kills stuck processes automatically)
npm run dev:all

# Or run separately in two terminals:
npm run dev          # Frontend at http://localhost:3000
npm run dev:server   # Backend at http://localhost:3001
```

## Kill Stuck Processes

```bash
# Find what's using port 3000 (frontend)
lsof -i :3000

# Find what's using port 3001 (backend)
lsof -i :3001

# Kill process on port 3000
kill -9 $(lsof -t -i:3000)

# Kill process on port 3001
kill -9 $(lsof -t -i:3001)

# Kill both ports at once
kill -9 $(lsof -t -i:3000) $(lsof -t -i:3001)
```

## Production

```bash
# Build frontend for production
npm run build

# Start production server (serves built frontend + API)
npm run start

# Preview production build locally
npm run preview
```

## Electron (Mac App)

```bash
# Run Electron in development mode
npm run electron:dev

# Build Mac app (creates release/SACRED-*.dmg)
npm run electron:build
```

## Testing

```bash
# Run all tests once
npm run test

# Run tests in watch mode
npm run test:watch

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:component

# Run E2E tests (Playwright)
npm run test:e2e
npm run test:e2e:web        # Web only
npm run test:e2e:electron   # Electron only

# Run tests with coverage report
npm run test:coverage
```

## Code Quality

```bash
# Run ESLint
npm run lint
```

## Git Shortcuts

```bash
# Check status
git status

# Stage all changes
git add .

# Commit with message
git commit -m "type: description"

# Push to origin
git push origin develop

# Pull latest
git pull origin develop
```

## Database Location

- **Development**: `data/sacred.db`
- **Mac App**: `~/Library/Application Support/sacred/sacred.db`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `NODE_ENV` | development | Environment mode |
| `DB_PATH` | data/sacred.db | Custom database path |

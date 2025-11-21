# ⚽ PronoFootball.Club

A modern football prediction platform with real-time live scores, interactive analytics, and comprehensive tournament management.

[![Version](https://img.shields.io/badge/version-1.9-blue.svg)](https://github.com/y4nnr/PronoFootball.Club/releases)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue.svg)](https://postgresql.org/)

## ✨ Features

### 🎯 Core Functionality
- **Real-time Live Scores** - Integration with Football-Data.org API
- **Interactive Predictions** - Bet on match outcomes with instant scoring
- **Multi-Competition Support** - Manage multiple tournaments simultaneously
- **Advanced Analytics** - Comprehensive performance tracking and visualizations
- **User Management** - Complete authentication and profile system

### 📊 Analytics & Visualizations
- **Player Points Progression** - Interactive horizontal stacked bars showing point evolution
- **Real-time Leaderboards** - Multiple ranking systems (points, averages, streaks)
- **Performance Widgets** - Visual analytics with interactive charts
- **Competition Statistics** - Detailed tournament analysis and player comparisons
- **Live Score Indicators** - Real-time match status and score updates

### 🔧 Technical Features
- **Server-Sent Events (SSE)** - Real-time frontend updates without polling
- **Advanced Team Matching** - Fuzzy matching algorithms for robust team name recognition
- **Responsive Design** - Mobile-first approach with Tailwind CSS
- **Type Safety** - Full TypeScript implementation
- **Database Optimization** - Efficient queries with Prisma ORM

## 🚀 Quick Start

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/y4nnr/PronoFootball.Club.git
   cd PronoFootball.Club
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

   Ensure you have PostgreSQL running locally and a database named `pronofootball` created.

5. **Run database migrations**
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

7. **Access the application**
   - Open [http://localhost:3000](http://localhost:3000)
   - Login with your credentials

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 15, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, NextAuth.js
- **Database**: PostgreSQL with Prisma ORM
- **Real-time**: Server-Sent Events (SSE)
- **External APIs**: Football-Data.org for live scores
- **Infrastructure**: Vercel / Local Server

### Project Structure
```
PronoFootball.Club/
├── components/              # React components
│   ├── PlayerPointsProgressionWidget.tsx
│   ├── GameCard.tsx
│   └── ...
├── pages/                   # Next.js pages and API routes
│   ├── api/                 # API endpoints
│   │   ├── live-sync.ts     # Live score synchronization
│   │   ├── refresh-games-cards.ts  # SSE endpoint
│   │   └── ...
│   ├── dashboard.tsx        # Main dashboard
│   └── competitions/       # Competition pages
├── lib/                     # Utilities and services
│   ├── football-data-api.ts # External API integration
│   └── prisma.ts           # Database client
├── hooks/                   # Custom React hooks
│   └── useLiveScores.ts    # Live score management
├── prisma/                  # Database schema and migrations
└── public/                  # Static assets
```

## 🔧 Environment Variables

Create a `.env` file with:

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/pronofootball"

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# Football-Data.org API (for live scores)
FOOTBALL_DATA_API_KEY="your-api-key"
```

## 📡 API Endpoints

### Live Score Integration
- `POST /api/live-sync` - Synchronize live scores from external API
- `GET /api/refresh-games-cards` - SSE endpoint for real-time updates
- `POST /api/trigger-frontend-refresh` - Trigger frontend refresh

### User & Statistics
- `GET /api/user/dashboard` - User dashboard data
- `GET /api/user/games-of-day` - Today's games
- `GET /api/stats/user-performance` - User performance analytics

### Competitions
- `GET /api/competitions/[id]/calendar` - Competition calendar data
- `GET /api/competitions/[id]/ranking-evolution` - Ranking evolution data

## 🎮 Live Score Features

### Real-time Updates
- **Automatic Score Sync** - Fetches live scores from Football-Data.org
- **Team Name Matching** - Advanced fuzzy matching for robust team recognition
- **Status Transitions** - Handles UPCOMING → LIVE → FINISHED transitions
- **Server-Sent Events** - Real-time frontend updates without page refresh

### External API Integration
- **Football-Data.org** - Professional football data provider
- **Rate Limiting** - Exponential backoff for API calls
- **Error Handling** - Comprehensive error management and retries
- **Attribution Compliance** - Proper data source attribution

## 📊 Analytics Widgets

### Player Points Progression Widget
- **Interactive Bars** - Horizontal stacked bars showing point evolution
- **Click-to-Select** - Click slices to see rankings at specific dates
- **Dynamic Scaling** - Proportional scaling with 90th percentile algorithm
- **Smart Calculations** - Handles players who didn't bet on specific days
- **Responsive Design** - Adapts to different screen sizes

### Performance Analytics
- **Real-time Leaderboards** - Multiple ranking systems
- **Visual Charts** - Interactive performance visualizations
- **Competition Statistics** - Detailed tournament analysis
- **User Performance** - Personal statistics and trends

## 🚀 Deployment

### Production Deployment
```bash
# Build the application
npm run build

# Start production server
npm start
```



### Vercel Deployment
1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

## 🧪 Development

### Database Management
```bash
# Create backup
./scripts/backup-database.sh

# Restore from backup
./scripts/restore-database.sh

# Reset database (Caution: This deletes all data)
npx prisma migrate reset
```

### Code Quality
```bash
# Run linting
npm run lint

# Run type checking
npm run type-check

# Run tests
npm test
```

## 📈 Performance

### Optimization Features
- **Efficient Queries** - Optimized database queries with Prisma
- **Caching Strategy** - Smart caching for API responses
- **Lazy Loading** - Components loaded on demand
- **Image Optimization** - Next.js automatic image optimization
- **Bundle Splitting** - Automatic code splitting for better performance

### Scalability
- **Horizontal Scaling** - Stateless architecture for easy scaling
- **Database Optimization** - Efficient indexing and query patterns
- **CDN Ready** - Static assets optimized for CDN delivery
- **Real-time Updates** - Efficient SSE implementation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Common Issues
- **Port conflicts**: Application runs on port 3001 if 3000 is busy
- **Database connection**: Ensure local PostgreSQL is running and credentials in .env are correct
- **Live score API**: Check Football-Data.org API key configuration
- **SSE connection**: Verify browser supports Server-Sent Events

### Getting Help
- Check the [documentation](docs/)
- Review [GitHub Issues](https://github.com/y4nnr/PronoFootball.Club/issues)
- Contact: [your-email@example.com](mailto:your-email@example.com)

---

**Built with ❤️ for football prediction enthusiasts**

*Version 1.9 - PlayerPointsProgressionWidget and Live Score Integration*

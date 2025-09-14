# PronoFootball - Football Prediction Application

A comprehensive football prediction platform built with Next.js, featuring real-time betting, leaderboards, and detailed statistics.

## 🏆 Features

### Core Functionality
- **User Authentication**: Secure login/registration system with NextAuth.js
- **Football Predictions**: Bet on match outcomes with real-time scoring
- **Competitions**: Support for multiple tournaments (Euro 2016 historical data included)
- **Real-time Leaderboards**: Multiple ranking systems by points, averages, and streaks
- **Personal Statistics**: Detailed performance tracking with visual analytics
- **Admin Panel**: Complete tournament and user management

### Statistics & Analytics
- **Personal Stats Dashboard**: 
  - All-time ranking and average points per game
  - Longest streaks (points and exact scores) with start/end dates
  - Last 10 games performance with visual timeline
  - Competition wins and trophy cabinet
- **Global Leaderboards**: 
  - Top players by total points (with games played count)
  - Best averages and accuracy rates
  - Longest streaks with date ranges
  - Competition winners and achievements
- **Visual Analytics**: Color-coded performance indicators and interactive charts

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Docker and Docker Compose
- Git

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/y4nnr/pronofootball.git
   cd pronofootball
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the database**:
   ```bash
   docker-compose up -d postgres
   ```

5. **Run database migrations**:
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

6. **Start the development server**:
   ```bash
   npm run dev
   ```

7. **Access the application**:
   - Open [http://localhost:3000](http://localhost:3000)
   - Login with your admin credentials

## 📊 Sample Data

The application comes with complete Euro 2016 historical data:
- **8 Real Users**: Authentic participants with final rankings
- **51 Historical Games**: Complete tournament results
- **408 Realistic Bets**: Distributed across all matches
- **29 Teams**: National and club teams with Wikipedia logos

## 🔧 Development

### Database Management

#### Backup Database
```bash
# Create backup
./scripts/backup-database.sh

# Restore from backup
./scripts/restore-database.sh
```

#### Reset Database
```bash
# Stop application
docker-compose down

# Remove database volume
docker volume rm pronofootball_postgres_data

# Restart and restore
docker-compose up -d postgres
./scripts/restore-database.sh
```

### Code Deployment

#### Manual Deployment
```bash
# Commit changes
git add .
git commit -m "Your commit message"

# Push to GitHub
git push origin main
```

#### Automated Deployment
```bash
# Use the deployment script
./scripts/deploy.sh
```

The deployment script will:
- Check for uncommitted changes
- Create database backup
- Push code to GitHub
- Optionally create GitHub releases with data

## 🗄️ Data Management

### Backup Strategy
- **Local Backups**: Automated scripts for PostgreSQL dumps
- **GitHub Integration**: Code versioning and release management
- **Data Preservation**: Complete database backups with releases

### GitHub Integration
- **Repository**: [https://github.com/y4nnr/pronofootball](https://github.com/y4nnr/pronofootball)
- **Releases**: Tagged versions with database snapshots
- **Documentation**: Comprehensive setup and deployment guides

### Backup Files Location
```
backups/
├── pronofootball_backup_20240529_120000.sql.gz
├── pronofootball_backup_20240528_120000.sql.gz
└── ...
```

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, NextAuth.js
- **Database**: PostgreSQL with Prisma ORM
- **Infrastructure**: Docker, Docker Compose
- **Deployment**: GitHub, Vercel-ready

### Project Structure
```
pronofootball/
├── components/          # React components
├── pages/              # Next.js pages and API routes
├── prisma/             # Database schema and migrations
├── public/             # Static assets
├── scripts/            # Database and deployment scripts
├── docs/               # Documentation
├── backups/            # Database backups
└── docker-compose.yml  # Docker configuration
```

## 🔐 Environment Variables

Create a `.env` file with:

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/pronofootball"

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# Optional: External APIs
FOOTBALL_API_KEY="your-api-key"
```

## 📱 API Endpoints

### Authentication
- `POST /api/auth/signin` - User login
- `POST /api/auth/signout` - User logout
- `GET /api/auth/session` - Current session

### Statistics
- `GET /api/stats/leaderboard` - Global leaderboards
- `GET /api/stats/user-performance` - Personal performance
- `GET /api/stats/current-user` - Individual user stats

### Admin
- `GET /api/admin/users` - User management
- `POST /api/admin/competitions` - Competition management

## 🚀 Deployment

### Vercel Deployment
1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Docker Deployment
```bash
# Build and run with Docker
docker-compose up -d

# Access at http://localhost:3000
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# E2E tests
npm run test:e2e
```

## 📈 Monitoring

### Application Health
- Database connection monitoring
- API response time tracking
- User activity analytics

### Backup Monitoring
- Automated backup verification
- Storage usage tracking
- Retention policy compliance

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
- **Database connection**: Ensure PostgreSQL container is running
- **Authentication errors**: Check NEXTAUTH_SECRET configuration

### Getting Help
- Check the [documentation](docs/)
- Review [GitHub Issues](https://github.com/y4nnr/pronofootball/issues)
- Contact: [your-email@example.com](mailto:your-email@example.com)

---

**Built with ❤️ for football prediction enthusiasts**

# PronoFootball Deployment Guide

## 🐳 Docker Container Deployment

This guide explains how to deploy PronoFootball using pre-built Docker images that contain all the application code and database data.

## 📦 What You Have

1. **pronofootball-app-ready.tar** (2.0GB) - Complete Next.js application
2. **pronofootball-db-with-data.tar** (437MB) - PostgreSQL database with all your competition data
3. **docker-compose.prod.yml** - Production deployment configuration

## 🚀 Deployment Steps

### Option 1: Local Deployment

1. **Load the Docker images:**
   ```bash
   docker load -i pronofootball-app-ready.tar
   docker load -i pronofootball-db-with-data.tar
   ```

2. **Start the application:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Access the application:**
   - Open http://localhost:3000 in your browser
   - All your data will be preserved!

### Option 2: Cloud Deployment

#### Upload to Docker Hub (Recommended)

1. **Tag and push images:**
   ```bash
   # Load images first
   docker load -i pronofootball-app-ready.tar
   docker load -i pronofootball-db-with-data.tar
   
   # Tag for Docker Hub (replace 'yourusername')
   docker tag pronofootball-app-ready:latest yourusername/pronofootball-app:latest
   docker tag pronofootball-db-with-data:latest yourusername/pronofootball-db:latest
   
   # Push to Docker Hub
   docker push yourusername/pronofootball-app:latest
   docker push yourusername/pronofootball-db:latest
   ```

2. **Update docker-compose.prod.yml:**
   ```yaml
   services:
     app:
       image: yourusername/pronofootball-app:latest
       # ... rest of config
     db:
       image: yourusername/pronofootball-db:latest
       # ... rest of config
   ```

#### Deploy to Cloud Platforms

**Railway:**
- Upload your docker-compose.prod.yml
- Set environment variables
- Deploy!

**DigitalOcean App Platform:**
- Use Docker Hub images
- Configure environment variables
- Deploy with one click

**AWS ECS / Google Cloud Run:**
- Push images to respective container registries
- Configure services using the images

## 🔧 Environment Variables

For production deployment, update these environment variables:

```bash
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-super-secure-secret-key
DATABASE_URL=postgresql://postgres:postgres@db:5432/pronofootball?schema=public
```

## 📊 What's Included

Your Docker images contain:
- ✅ Complete Next.js application
- ✅ All 4 competitions (Euro 2016, World Cup 2018, Champions League 2018/19 & 2019/20)
- ✅ All user data and betting history
- ✅ All team logos and data
- ✅ Correct point totals and standings

## 🔄 Updates

To update the application:
1. Make changes to your code
2. Build new images
3. Save and share the new tar files
4. Reload on target deployment

## 💾 Backup Strategy

Your current approach is excellent:
- **Code backup:** GitHub repository
- **Data backup:** JSON files in database-backup/
- **Complete system backup:** Docker images (this approach)

## 🎯 Advantages of This Approach

1. **Complete portability** - Everything in one package
2. **No setup required** - Database comes pre-populated
3. **Consistent environment** - Same setup everywhere
4. **Easy sharing** - Just share the tar files
5. **Quick deployment** - No migration scripts needed

## 📝 Notes

- The app image is large (2GB) because it includes Node.js and all dependencies
- The database image (437MB) contains all your precious competition data
- Both images can be compressed further if needed for sharing
- Consider using a private Docker registry for sensitive data 
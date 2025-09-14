#!/bin/bash

# Stop any running containers
docker compose down

# Build the images
docker compose build

# Save the images to tar files
docker save pronofootball-app-ready:latest > app.tar
docker save pronofootball-db-with-data:latest > db.tar

echo "Images have been saved. Now you can:"
echo "1. Copy app.tar and db.tar to your server"
echo "2. On your server, run:"
echo "   docker load < app.tar"
echo "   docker load < db.tar"
echo "   docker compose up -d" 
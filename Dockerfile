FROM node:18

# Install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg

# Set up working directory
WORKDIR /app
COPY . .

# Install dependencies
RUN npm install

# Start the app
CMD ["node", "server.js"]

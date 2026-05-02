# Use Node.js base image
FROM node:20

# Set working directory
WORKDIR /usr/src/app

# Copy dependencies
COPY package.json ./

# Install dependencies
RUN npm install

# Copy rest of the app
COPY . .

# Expose port
EXPOSE 5000

# Run the app
CMD ["npm", "start"]

# Base image: Lightweight Nginx web server
FROM nginx:alpine

# Set working directory in the container
WORKDIR /usr/share/nginx/html

# Copy the web control interface source files into the container
COPY src/ /usr/share/nginx/html/

# Remove the default Nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Add a custom Nginx configuration
COPY server/nginx/volumio.conf /etc/nginx/conf.d/volumio.conf

# Expose port 80 for HTTP access
EXPOSE 80

# Set default command to start Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]

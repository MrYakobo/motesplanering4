# Stage 1: Build Vue frontend
FROM node:20-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: PHP + Apache
FROM php:8.2-apache

RUN a2enmod rewrite && docker-php-ext-install zip

# Allow .htaccess overrides in /var/www/html
RUN sed -i '/<Directory \/var\/www\/html>/,/<\/Directory>/s/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf

WORKDIR /var/www/html

# Copy PHP backend
COPY php/.htaccess .
COPY php/VERSION .
COPY php/api/ api/
COPY php/data/.htaccess data/.htaccess

# Copy entire built frontend on top
COPY --from=frontend /build/dist/ .

# Writable directories
RUN mkdir -p data uploads backups \
    && chown -R www-data:www-data data uploads backups

EXPOSE 80

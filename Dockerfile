# Build stage
FROM node:20-alpine AS build

ARG UID=1000
ARG GID=1000

# node:20-alpine already ships a 'node' user with uid/gid 1000.
# Only create a custom user when the host UID/GID differ.
RUN if [ "${UID}" != "1000" ] || [ "${GID}" != "1000" ]; then \
      addgroup -g ${GID} appgroup \
      && adduser -D -u ${UID} -G appgroup appuser; \
    fi

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

# Serve stage
FROM nginx:alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

# Development stage (Moved to end to ensure it's a a valid target in all environments)
FROM node:20-alpine AS dev

ARG UID=1000
ARG GID=1000

RUN if [ "${UID}" != "1000" ] || [ "${GID}" != "1000" ]; then \
      addgroup -g ${GID} appgroup \
      && adduser -D -u ${UID} -G appgroup appuser; \
    fi

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Ensure the working dir is owned by the user we run as so bind-mounted
# volumes (node_modules, dist) are not written as root on the host.
RUN if [ "${UID}" != "1000" ] || [ "${GID}" != "1000" ]; then \
      chown -R appuser:appgroup /app; \
    else \
      chown -R node:node /app; \
    fi

USER ${UID}

EXPOSE 5173

ENV CHOKIDAR_USEPOLLING=true
ENV WATCHPACK_POLLING=true

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

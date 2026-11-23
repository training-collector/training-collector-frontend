FROM node:22-alpine AS build
WORKDIR /src
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:stable-alpine
ENV BACKEND_URL=http://platform:8080 FRONTEND_PORT=5173
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /src/dist/ /usr/share/nginx/html/
EXPOSE 5173

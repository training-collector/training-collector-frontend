# Base images are pinned by digest. To take their updates, replace the digests:
#   docker buildx imagetools inspect <image:tag>
FROM node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS build
WORKDIR /src
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:stable-alpine@sha256:caf4e1e032a20f9c3c5e28fc7f25ffd768ad8677b4975c54193075997b3a97e3
ENV BACKEND_URL=http://platform:8080 FRONTEND_PORT=5173
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /src/dist/ /usr/share/nginx/html/
EXPOSE 5173

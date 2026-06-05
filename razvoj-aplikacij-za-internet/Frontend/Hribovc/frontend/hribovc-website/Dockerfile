FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ARG VITE_ORV_DEFAULT_CAMERA_MODE=pc
ENV VITE_ORV_DEFAULT_CAMERA_MODE=$VITE_ORV_DEFAULT_CAMERA_MODE
RUN npm run build

FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

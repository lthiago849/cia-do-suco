FROM node:22 AS build

ARG BASEPATH
ARG VITE_API_URL
ENV VITE_BASEPATH=${BASEPATH}
ENV VITE_API_URL=${VITE_API_URL}

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install

COPY . .
RUN rm -f .env \
 && NODE_ENV=production npm run build

FROM nginx:alpine

WORKDIR /usr/share/nginx/html
COPY --from=build /usr/src/app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Sistema interno: não deve ser indexado
RUN printf "User-agent: *\nDisallow: /\n" > /usr/share/nginx/html/robots.txt

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

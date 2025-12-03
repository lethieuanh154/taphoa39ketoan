FROM ghcr.io/cirruslabs/flutter:3.27.1 AS builder

WORKDIR /app
COPY . .

RUN flutter config --enable-web
RUN flutter pub get
RUN flutter build web --release --base-href=/

FROM nginx:alpine
COPY --from=builder /app/build/web /usr/share/nginx/html

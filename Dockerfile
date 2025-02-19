FROM node:22

RUN apt update && apt install -y \
  vim \
  apt-transport-https \
  ca-certificates \
  gnupg \
  curl \
  lsb-release

COPY src /app
WORKDIR /app

RUN npm install

CMD ["node", "server.js"]

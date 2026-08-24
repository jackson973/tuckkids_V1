FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
# data/ guarda conteúdo editado, uploads, senha e segredo — monte um volume:
#   docker run -p 3000:3000 -v tuckkids-data:/app/data -e ADMIN_PASSWORD=... tuckkids
VOLUME /app/data
CMD ["node", "server/server.js"]

FROM node:22
ENV NODE_ENV=production

WORKDIR /usr/src/app
COPY . .

# Install packages and build server
RUN corepack enable yarn \
 && yarn install \
 && yarn build \
 && chown -R node /usr/src/app

EXPOSE 3000
EXPOSE 4000

USER node
CMD ["yarn", "start"]

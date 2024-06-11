FROM node:20.0.0
ENV NODE_ENV=production
WORKDIR /usr/src/app
# COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
# RUN npm install -g yarn
         
COPY . .

ENV YARN_VERSION 4.0.0
RUN yarn policies set-version $YARN_VERSION

RUN corepack enable yarn
RUN yarn install
# COPY . .

RUN yarn build
RUN yarn install:demo
RUN yarn build:demo

EXPOSE 3000
EXPOSE 4000
EXPOSE 4444
EXPOSE 5001
EXPOSE 5002
EXPOSE 5003
EXPOSE 5123

RUN chown -R node /usr/src/app
USER node
CMD ["yarn", "start:demo"]

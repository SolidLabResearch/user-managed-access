FROM node:22
ENV NODE_ENV=production

# Install EYE reasoner
RUN apt-get update  \
 && apt-get install swi-prolog -y \
 && git clone https://github.com/eyereasoner/eye.git \
 && /eye/install.sh --prefix=/usr/local \
 && rm -r /eye

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

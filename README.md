# Pacsoi POC 

This repository contains a demonstrator for the [SolidLab project](https://solidlab.be/) on managing trust-flows in decentralized data storage systems such as Solid.


## Cloning the repository

To run the demonstrator, you will have to clone the repository.
```
git clone -b project/pacsoi-poc1 git@github.com:SolidLabResearch/user-managed-access.git

cd user-managed-access/
```

## Getting started

### Setting up the Authorization Server 

Before starting, make sure you are on the correct branch (pacsoi-poc1).
See the above command to clone only the relevant branch for the demonstrator.

In order to run the demonstrator you need to perform the following steps. 

1. Ensure that you are using Node.js 20 or higher, e.g. by running `nvm use`. (see [.nvmrc](./.nvmrc))
2. Enable Node.js Corepack with `corepack enable`.
3. Run `yarn install` in the project root to install the requirements.
4. Run `yarn build` in the project root to build.
5. Run `yarn run start:demo` in the project root to start all services.


### Docker

The docker is not working atm. 
I am trying to get it working, but there seem to be some problems with the internal networking.


# SolidLab's User Managed Access 

This repository contains SolidLab research artefacts on use of UMA in the Solid ecosystem.


## Packages

- [`@solidlab/uma`](packages/uma): Experimental and opinionated implementation of [UMA Grants](https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-grant-2.0.html) and [UMA Federation](https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-federated-authz-2.0.html). 

- [`@solidlab/uma-css`](packages/css): UMA modules for the [Community Solid Server](https://github.com/CommunitySolidServer/CommunitySolidServer/). 


## Getting started

In order to run this project you need to perform the following steps. 

1. Ensure that you are using Node.js 18.18 or higher with Yarn 4.0 or higher.
1. Run `yarn install` in the project root (this will automatically call `yarn build:all`).
1. Run `yarn start:all`.

This will boot up a UMA server and compatible Community Solid Server instance.

You can then execute the happy UMA flow by executing `yarn script:flow` in a parallel terminal.


## Next steps

- [Wout Slabbinck](https://github.com/woutslabbinck) will try to hack an Authorizer in the UMA AS (such as the current [AllAuthorizer](packages/uma/src/authz/AllAuthorizer.ts)) and include Koreografeye there for the research on Usage Control Patterns.
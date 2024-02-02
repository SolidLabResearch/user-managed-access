
# SolidLab's User Managed Access 

This repository contains SolidLab research artefacts on use of UMA in the Solid ecosystem.


## Packages

- [`@solidlab/uma`](packages/uma): Experimental and opinionated implementation of [UMA Grants](https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-grant-2.0.html) and [UMA Federation](https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-federated-authz-2.0.html). 

- [`@solidlab/uma-css`](packages/css): UMA modules for the [Community Solid Server](https://github.com/CommunitySolidServer/CommunitySolidServer/). 

- [`@solidlab/uma-enforcement`](packages/ucp-enforcement): Usage Control Policy decision/enforcement component.

## Getting started

In order to run this project you need to perform the following steps. 

1. Ensure that you are using Node.js 18.18 or higher with Yarn 4.0 or higher.
1. Run `yarn install` in the project root (this will automatically call `yarn build:all`).
1. Run `yarn start:all`.

This will boot up a UMA server and compatible Community Solid Server instance. 

You can then execute the following flows:

- `yarn script:public`: `GET` the public `/alice/profile/card` without redirection to the UMA server;
- `yarn script:private`: `PUT` some text to the private `/alice/private/resource.txt`, with redirection to the UMA server;
- `yarn script:registration`: `POST`, `GET` and `DELETE` some text `/alice/public/resource.txt` without redirection to the UMA server, to test the correct creation and deletion of resource registrations on the UNA server.

`yarn script:flow` runs all flows in sequence.

## Implemented features

The packages in this project currently only support a fixed UMA AS per CSS RS, and contain only the trivial [AllAuthorizer](packages/uma/src/models/AllAuthorizer.ts) that allows all access. More useful features are coming soon ...

### Usage control policy enforcement

Used for creating a modular engine that calculates which access modes are granted based on:

- Usage Control Rules
- Interpretation of those rules
- The request of the Requested Party together with all its claims

For more information, you can check out its [own repository](https://github.com/woutslabbinck/ucp-enforcement) which has three engines that use [ODRL rules](https://www.w3.org/TR/odrl-model/).

A test script is provided for a CRUD ODRL engine: `yarn script:ucp-enforcement`.
In the [script](./scripts/test-ucp-enforcement.ts) a read Usage Control Rule (in ODRL) is present together with N3 interpretation rules. 
Then a read request is performed using the engine, which results in a list of grants. This list is then printed to the console.


## Next steps

- [Wout Slabbinck](https://github.com/woutslabbinck) will look into custom [Authorizers](packages/uma/src/models/Authorizer.ts), in particular an integratation with Koreografeye for the research on Usage Control Patterns.

- [Wouter Termont](https://github.com/termontwouter) will implement UMA Resource Registration (as specified in UMA 2.0 Federation), and integrate UMA AS coupling into the onboarding flow of the CSS.

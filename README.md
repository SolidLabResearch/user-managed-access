# SolidLab's User Managed Access

This repository contains SolidLab research artefacts on use of UMA in the Solid ecosystem.


## Packages

- [`@solidlab/uma`](packages/uma): Experimental and opinionated implementation of [UMA Grants](https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-grant-2.0.html) and [UMA Federation](https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-federated-authz-2.0.html).

- [`@solidlab/uma-css`](packages/css): UMA modules for the [Community Solid Server](https://github.com/CommunitySolidServer/CommunitySolidServer/).

- [`@solidlab/ucp`](packages/ucp): Usage Control Policy utility component.

## Getting started

In order to run this project you need to perform the following steps.

1. Ensure that you are using Node.js 20 or higher, e.g. by running `nvm use`. (see [.nvmrc](./.nvmrc))
2. Enable Node.js Corepack with `corepack enable`.
3. Run `yarn install` in the project root (this will automatically call `yarn build`).
4. Run `yarn start`.

This will boot up a UMA server and compatible Community Solid Server instance.

You can then execute the following flows:

- `yarn script:public`: `GET` the public `/alice/profile/card` without redirection to the UMA server;
- `yarn script:private`: `PUT` some text to the private `/alice/private/resource.txt`, protected by a simple WebID check;
- `yarn script:uma-ucp`: `PUT` some text to the private `/alice/other/resource.txt`, protected by a UCP enforcer checking WebIDs according to policies in `packages/uma/config/rules/policy/`.
- `yarn script:collection`: `POST`, `GET` and `DELETE` some text to/from `/alice/public/resource.txt` to test the correct creation and deletion of resource registrations on the UMA server.
                            An AssetCollection policy is used to create `/alice/public/`.
                            More information on the collection implementation can be found in [documentation/collections.md](documentation/collections.md).

`yarn script:flow` runs all flows in sequence.

As we are still in the progress of documenting everything,
the above scripts are the best way to learn about how everything works.

A more extensive getting started guide can be found
in [documentation/getting-started.md](documentation/getting-started.md).

## Demonstration

Instead of running `yarn start`, you can run `yarn start:demo` to start the server with an alternative configuration.
With this configuration you can run the `script:demo`,
which runs with experimental contracts.

## Implemented features

The packages in this project currently only support a fixed UMA AS per CSS RS.
Authorization can be done with a simple, unverified, WebID embedded in the ticket
using the [WebIdAuthorizer](packages/uma/src/policies/authorizers/WebIdAuthorizer.ts)
or the [OdrlAuthorizer](packages/uma/src/policies/authorizers/OdrlAuthorizer.ts)
which supports simple ODRL policies.
A [NamespacedAuthorizer](packages/uma/src/policies/authorizers/NamespacedAuthorizer.ts)
is used to apply different authorizers to different containers.

## ODRL

A variant of the server that only uses ODRL for authorization can be started with `yarn start:odrl`.
A corresponding script can then be executed with `yarn script:uma-odrl`.
The test policies can be found in [packages/uma/config/rules/odrl](packages/uma/config/rules/odrl).


# SolidLab's User Managed Access 

This repository contains a demonstrator for the [SolidLab project](https://solidlab.be/) on managing trust-flows in decentralized data storage systems such as Solid.


## Cloning the repository

To run the demonstrator, you will have to clone the repository.
```
git clone -b e2e/setup git@github.com:SolidLabResearch/user-managed-access.git

cd user-managed-access/
```

## Getting started

### Setting up the project yourself

**Before starting, make sure you are on the correct branch (e2e/setup).**
**See the above command to clone only the relevant branch for the demonstrator.**

In order to run the demonstrator you need to perform the following steps. 

1. Ensure that you are using Node.js 20 or higher, e.g. by running `nvm use`. (see [.nvmrc](./.nvmrc))
2. Enable Node.js Corepack with `corepack enable`.
3. Run `yarn install` in the project root to install the requirements for the Solid server .
4. Run `yarn build` in the project root to build the Solid server.
5. Run `yarn install:demo` in the project root to install the requirements for the demonstrator sites and services .
6. Run `yarn build:demo` in the project root to build the demonstrator sites and services .
7. Run `yarn start:demo` to start both the Solid server and all demonstrator sites and services.

This will boot up a UMA server and compatible Community Solid Server instance, as well as all sites and services for the demonstrator. 


### Using docker
There is also a `docker` setup available, for which you need to have docker installed:
```
docker pull raddecke/solidlab-trust-flows-demo
docker run -p 3000:3000 -p 4000:4000 -p 4444:4444 -p 5123:5123 -p 8201:8201 -p 8202:8202 -p 8203:8203 --net=host raddecke/solidlab-trust-flows-demo
```

This will start up the same services as the above system installation.


## Screencast

A screencast of the demonstrator can be found here: https://pod.rubendedecker.be/scholar/screencasts/trust-flows-demo.mp4 
or the video file can be found in the [github repository](https://github.com/SolidLabResearch/user-managed-access/tree/e2e/setup/screencast)



# Demonstrator

## The user data space with CSS and UMA

- Ruben V., a.k.a. `<http://localhost:3000/ruben/profile/card#me>`, has retrieved a credential containing their birth date from a government service at `<http://localhost:4444/credential?webid=http://localhost:3000/ruben/profile/card#me>`, and this credential has been stored at `<http://localhost:3000/ruben/credentials/age-credential>` as a private resource.
- Additionally, an accompanying policy was also retrieved and stored in the policy directory at `<http://localhost:3000/ruben/settings/policies/generic/age-policy>`. This ODRL policy governs the access and usage requirements for the age credential resource.
- This can be checked on the companion app at `<http://localhost:8201/>`.
- Using the login email `ruben@example.org` with the password `abc123`, the companion app shows an overview of the available credentials (the birth date credential) en policies in the data space (one policy managing read access for the user, and another one providing access to the age credential for the purpose of age-verification).

- Access to Ruben's data is based on policies, which he manages through his Authz Companion app, and which are stored in `<http://localhost:3000/ruben/settings/policies/>`. (This is, of course, not publicly known.) To request access to Ruben's data, an agent will need to negotiate with Ruben's UMA Authorization Server, which his WebID document identifies as `<http://localhost:4000/>`. Via the Well-Known endpoint `<http://localhost:4000/.well-known/uma2-configuration>`, we can discover the Token Endpoint `<http://localhost:4000/token>`.

- Having discovered both the location of the UMA server and of the desired data, an agent can request the former for access to the latter. We get different results depending on the situation:

  - Without a policy allowing the access, the access is denied. 
  
    However, the UMA server enables multiple flows in which such a policy can be added, for example by notifying the resource owner. (This is out-of-scope for this demo.) Having been notified in some way of the access request, Ruben could go to his Authz Companion app, and add a policy allowing the requested access.`
  
  - If a policy has been set (and perhaps the agent has been notified in some way to retry the access request), the UMA server will request the following claims from the agent, based on that policy: `http://www.w3.org/ns/odrl/2/purpose` and `urn:solidlab:uma:claims:types:webid`.

  - When the agent has gathered the necessary claims (the manner in which is out-of-scope for this demo), it can send them to the UMA server as a JWT:

    ```
    {
      "http://www.w3.org/ns/odrl/2/purpose": "urn:solidlab:uma:claims:purpose:age-verification",
      "urn:solidlab:uma:claims:types:webid": "http://localhost:5123/id"
    }
    ```

- Only when a policy is in place and the agent provides the UMA server with the relevant claims, an access token is produced, with which the agent can access the desired data at the Resource Server.

## The web store 

- The store use-case starts out with the user navigating to a webshop 'The Drinks Center' located at `http://localhost:8202`.
- In here, the user decides to buy a mix of alcoholic and non-alcoholic drinks.
- Before checkout, the user has to first verify their age when alcoholic drinks were added to the cart.
- The list of options here is currently limited to only WebID.
- Upon continuing, we can provide a new WebID, or continue with Ruben's WebID that was stored from some previous interaction. Note that this does not authenticate the user, but only links their WebID to allow the store to negotiate with their system.
- Here, the web store calls their backend service with the WebID value to try and negotiate with the WebID system to find a valid age-credential.
  
- In the store backend, a negotiation is setup with the UMA authorization server indicated by the WebID at `<http://localhost:4000>`.
- The location of the target resource `<http://localhost:3000/credentials/age-credential>` is assumed to be known as an agreed well known path.
- Having discovered both the location of the UMA server and the target resource, the store agent requests access to the latter.
  
- As an policy is set for the credential, the UMA server will request the following claims from the agent, based on that policy: `http://www.w3.org/ns/odrl/2/purpose` and `urn:solidlab:uma:claims:types:webid`.
- The store now re-sends the request, passing the following claims as a JWT:
  ```
  {
    "http://www.w3.org/ns/odrl/2/purpose": "urn:solidlab:uma:claims:purpose:age-verification",
    "urn:solidlab:uma:claims:types:webid": "http://localhost:5123/id"
  }
  ```
- The UMA server responds on this request by providing an signed JWT containing both an access token that the store agent can use to go retrieve the age credential resource, as well as a usage agreement for what can be done with the data in the following format: 
  ```
  {     
    "permissions": [     
      {     
        "resource_id": "http://localhost:3000/ruben/credentials/age-credential",     
        "resource_scopes": [ "read", "use" ]     
      }     
    ],     
    "contract": {     
      "@context": [     
        "http://www.w3.org/ns/odrl.jsonld",     
        {     
          "prov": "http://www.w3.org/ns/prov#"     
        }     
      ],     
      "@type": "Agreement",     
      "target": "http://localhost:3000/ruben/credentials/age-credential",     
      "uid": "urn:solidlab:uma:contract:55cfc913-24a3-4134-9895-2fa969a07181",     
      "assigner": "http://localhost:3000/ruben/profile/card#me",     
      "assignee": "http://localhost:5123/id",     
      "permission": [     
        {     
          "action": [ "read", "use" ],     
          "constraint": [     
            {     
              "leftOperand": "dateTime",     
              "operator": "gt",     
              "rightOperand": "2024-05-22T13:42:45.397Z"     
            },     
            {     
              "leftOperand": "dateTime",     
              "operator": "lt",     
              "rightOperand": "2024-05-28T22:00:00.000Z"     
            },     
            {     
              "leftOperand": "purpose",     
              "operator": "eq",     
              "rightOperand": "urn:solidlab:uma:claims:purpose:age-verification"     
            }     
          ]     
        }     
      ]     
    }     
  }
  ```

- Using the provided token, the store can now retrieve the age credential using this token, after which the age is verified to be over 18, and both the data and contract are stored for auditing purposes. (this storage for auditing purposes is currently not yet negotiated)
- Based on the OK from the back-end, the store allows the user to go forward to the payment screen, where the transaction can be completed.

## The auditing platform
To complete our trust interaction, we now need a way to check how the web store uses our data in their back-end.
Here, the auditing process can make use of the usage agreement that was obtained by the store backend during the negotiation for the age credential resource.

- The auditor navigates to the auditing platform located at `<http://localhost:8203>`
- Here, 'The Drinks Central' is registered as a store audited by the platform.
- The platform retrieves all auditing information from the store from the store backend via `<http://localhost:5123/audit>`.
- For each entry, the auditing platform can automatically verify:
  - the signature of the token containing the usage agreement coming from the user data space.
  - the signature of the age credential coming form a trusted government instance.
  - the provided age in the credential being over 18 years old.
- For each entry, both the retrieved resource and the usage agreement are displayed on the interface.


## Implemented features
The demonstrator contains a demonstration that partially or fully includes the following features.

### The Solid Server
The demonstrator uses the [Community Solid Server](https://github.com/CommunitySolidServer/CommunitySolidServer) to represent a user data storage location and to host the user WebID.

### UMA Redirects for Solid

This codebase makes use of a Solid Server that can redirect to an Authorization server based on an adaptation of the [UMA protocol](https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-grant-2.0.html).

### Usage control policy enforcement

Used for creating a modular engine that calculates which access modes are granted based on:

- Usage Control Rules
- Interpretation of those rules
- The request of the Requested Party together with all its claims

For more information, you can check out its [own repository](https://github.com/woutslabbinck/ucp-enforcement) which has three engines that use [ODRL rules](https://www.w3.org/TR/odrl-model/).

A test script is provided for a CRUD ODRL engine: `yarn script:ucp-enforcement`.
In the [script](./scripts/test-ucp-enforcement.ts) a read Usage Control Rule (in ODRL) is present together with N3 interpretation rules. 
Then a read request is performed using the engine, which results in a list of grants.
These are then used as the basis of an agreement that is exchanged with the access token, that represents the usage agreement for the data exchange.

### Verifiable Credential issuing and verification

The demonstrator provides a mock government service that can issue a credential (currently manually copied in place), and allows the verification of this credential using their WebID.

### Auditing

The demonstrator presents an auditing platform, that can read and automatically partially verify the grounds of data exchanges happening in the network.

## Next steps

The next step for the demonstrator is going in the direction of [Europe's Digital Identity Wallets](https://ec.europa.eu/digital-building-blocks/sites/display/EUDIGITALIDENTITYWALLET/EU+Digital+Identity+Wallet+Home)
where we will try to demonstrate how decentralized storage such as Solid can form a strong basis for the storage and sharing of digital crendentials.


# Demonstration

Using the UMA server implemented in this repository, we set up an extensive demonstration of a real life use case: age verification for online shops selling age-restricted goods, such as alcoholic beverages.

To experiment with the demo, first build the necessary extra code with `build:demo`, then start the demo by running `start:demo`. This starts the CSS and UMA servers with the right configurations, and spins up two websites: an online shop on `http://localhost:5001`, and a policy manager on `http://localhost:5002`.

The context "story" of the demonstration is the following. This "story" can be either run through via the graphical interfaces of the websites, or by running the script `yarn script:demo`.

- Ruben V., a.k.a. `<http://localhost:3000/ruben/profile/card#me>`, has some private data in `<http://localhost:3000/ruben/private/data>`. Of course, he does not want everyone to be able to see all of his private data when they need just one aspect of it. Therefore, Ruben has installed two **Views** on his data, based on SPARQL filters from a public **Catalog**. (When and how this is done is out-of-scope for now.)

- Discovery of views is currently a very crude mechanism based on a public index in the WebID document. (A cleaner mechanism using the UMA server as central hub is underway.) Using this discovery mechanism, we can find the following views on Ruben's private data:

  1. `<http://localhost:3000/ruben/private/derived/bday>` filters out his birth date, according to the `<http://localhost:3000/catalog/public/filters/bday>` filter;
  2. `<http://localhost:3000/ruben/private/derived/age>` derives his age, according to the `<http://localhost:3000/catalog/public/filters/age>` filter.

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

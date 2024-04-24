# TODOs for end-to-end requirements:

## Assignment minimum requirements
- [X] The system needs to facilitate the exchange of the data (date of birth).
  - [X] A date of birth must be available at some location in the dataspace
- [X] The system needs to provide the store with the trust that the data is correct.
  - [X] The stored DOB must be a verifiable credential
  - [X] The stored credential must be verifiable on the store backend
- [X] The system needs to provide the person with the trust that their data will only be used for age checking.
  - [X] The policy system must be able to handle a purpose
- [ ] The system allows the person to specify in advance the generic policy that “all Belgian stores are allowed to read my date of birth”.
  - [X] The system needs to be able to store a generic policy
  - [X] An interface needs to be available to store this policy
  - [ ] The policy must be modeled in an appropriate way
- [X] The system automatically instantiates the above generic policy into the concrete case that “MyBelgianWineStore is allowed to use my date of birth from 2024-03-01 to 2024-03-15 for the purpose of age verification for purchases”
  - [ ] MOCKED -> double check though
- [X] The system allows the above interaction to take place without the person having to click on any dialogs.
  - [X] The interaction is automatic after a WebID button is clicked to show what is happening.
- [ ] The system allows the store to prove that they were allowed to perform the age verification.
  - [X] A backend storage must be in place for the store
  - [ ] The store website must forward data storage and checks to the backend
- [ ] The system allows the person to check that their data was used correctly.
  - [X] An auditing routine must be built in the store backend
  - [ ] An auditing routine must be built as a frontend interface
- [ ] The Government VC Service
  - [X] Must be able to create a VC 
  - [X] VC must be transfered to demo pod storage -> Not required for Demo because of fixed keypair seed
  - [ ] VCs can be validated on the backend of the store




## Demonstrator requirements
- [ ] Protocol message modelling
  - [ ] claim request messages
  - [ ] claim provision messages
- [ ] Logging system (no hard requirement)
  - [X] Create logging interface
  - [ ] Log Instantiated Policies
  - [ ] Log Access Grants
  - [ ] Log Operations
- [ ] Authorization system
  - [ ] include logging endpoint
  - [ ] include authorization endpoint 
  - [ ] include policy management endpoint
- [X] Mock Policy instantiation
  - [ ] Write out policy model that works for demo
  - [X] ??? Discover existing policies to instantly grant some access
  - [ ] Link generic - instantiated - grant - operation
- [x] Negotiation implementations
  - [X] Return instantiated policy requirements from ticket resolving function to create a signed instantiated policy to return
- [ ] Signatures
  - [ ] Create a VC form an instantiated policy - I use the return JWT as a free signature
  - [ ] Create verification endpoint for issued VCs 
- [ ] Government mockup
   - [ ] Create verification endpoint for issued VCs (can be mocked)
- [ ] Client
  - [ ] Make some mock-up of how storage could be handled in a way that allows for auditing
  - [ ] Recurring requests make use of the same grant?
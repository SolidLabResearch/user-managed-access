# TODOs for end-to-end requirements:

## Final sprint

### To Fix By Demo

- [ ] Add Policy Screen update
- [ ] Final fixes generic policy
- [ ] Change trust display on auditing screen
  - [ ] Change contract to "Instantiated Policy"
  - [ ] Instantiated Policy -> Trusted instead of verified, age  keep verified
- [ ] Auth app -> My pod app
  - [ ] My Data
  - [ ] My Policies
  - [ ] Relevant linking?
- [X] Login information on every App: 
  - [X] Green -> You are logged in\
  - [X] Red -> You are not logged in
  - [X] Blue -> Auditer 3 is logged in
- [ ] Store login buttons:
  - [ ] Remove its'me option
  - [ ] Continue as Ruben -> Share WebID link (with profile avatar) (This is not a Login!)





### HAS TO HAPPEN
- [X] VC and token validation on the auditing frontend
  - [X] Represent this with green checkmarks in the frontend
- [ ] Check policy models

### If there is time
- [ ] Check policy evaluation system
  - [ ] Do time related policies work?
  - [ ] Can we include wrong purposes that fail?
  - [ ] Can we do a check on store registration
- [ ] Store decision to give purchase access or not in the audit entry?

### If there is a lot of time
- [ ] Pod-based logging (not super necessary atm?)
- [ ] Can we model accesses by 2 different people?

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
  - [X] The store website must forward data storage and checks to the backend
- [X] The system allows the person to check that their data was used correctly.
  - [X] An auditing routine must be built in the store backend
  - [X] An auditing routine must be built as a frontend interface
- [ ] The Government VC Service
  - [X] Must be able to create a VC 
  - [X] VC must be transfered to demo pod storage -> Not required for Demo because of fixed keypair seed
  - [ ] VCs can be validated on the backend of the store
- [ ] The Auditing use-case
  - [X] The store backend provides the option to retrieve all required data to audit
  - [ ] This can be represented in an auditing browser app that shows colors when verified (token + VC)


Small note with using the UMA server token signature as the contract signature.
We can only trace this back to the UMA Server, and cannot reliably check the connection between the WebID and the UMA Server

Another idea: preemptive auditing:
- The store has to advertise who is auditing them
- The contract has to be signed both ways
- upon agreement, the data is sent to the store AND to the auditing service.
- on auditing, the service can check if the store is withholding information
  


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
# TODOs for end-to-end requirements:

## List-based requirements
- [ ] Handle identity claim in policy engine (MOCK)
- [ ] Policy Retrieval
- [ ] Policy Execution
- [ ] Policy Instantiation
- [ ] Instantiated Policy storage and retrieval
- [ ] Signing policy 
- [X] Create access grant
- [ ] *Log Policy Instantiation and Access Grant
- [ ] Store data storage (graph store?)
- [X] Retrieve age
- [ ] *Log data retrieval



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
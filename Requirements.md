

# TODOs for end-to-end requirements:


- [ ] Protocol message modelling
  - [ ] claim request messages
  - [ ] claim provision messages
- [ ] Logging system (no hard requirement)
  - [X] Create logging interface
  - [ ] Log Instantiated Policies
  - [ ] Log Access Grants
  - [ ] Log Operations
- [ ] Authorization system
  - [ ] Include authorization endpoint operations
  - [ ] Include log access operations (others are internal)
- [ ] Mock Policy instantiation
  - [ ] Write out policy model that works for demo
  - [ ] Discover existing policies to instantly grant some access
  - [ ] Link generic - instantiated - grant - operation
- [ ] Negotiation implementations
  - [ ] Return instantiated policy requirements from ticket resolving function to create a signed instantiated policy to return
- [ ] Signatures
  - [ ] Sign and return agreement (either separately or together with grant)
- [ ] Client
  - [ ] Make some mock-up of how storage could be handled in a way that allows for auditing
  - [ ] Recurring requests make use of the same grant?

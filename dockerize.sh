#!/bin/bash
docker image build --pull --file './Dockerfile' --tag 'solidlab-trust-flows-demo:latest' --network=host .

#!/bin/bash
docker image build --pull --file './Dockerfile' --tag 'solidlab-trust-flows-demo:latest' --label 'com.microsoft.created-by=visual-studio-code' --network=host ./ 

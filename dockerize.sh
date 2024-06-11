#!/bin/bash
docker image build --pull --file './Dockerfile' --tag 'solidtrustflows:latest' --label 'com.microsoft.created-by=visual-studio-code' --network=host ./ 

#!/bin/bash
docker image build --pull --file './Dockerfile' --tag 'css-uma-main:latest' --label 'com.microsoft.created-by=visual-studio-code' --network=host ./ 
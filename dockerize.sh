#!/bin/bash
docker image build --pull --file '/home/dexa/Ugent/doctorate/UMA/user-managed-access/Dockerfile' --tag 'solidtrustflows:latest' --label 'com.microsoft.created-by=visual-studio-code' '/home/dexa/Ugent/doctorate/UMA/user-managed-access'

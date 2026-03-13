#!/bin/bash
cd /home/ubuntu/threadsbot-saas

while true; do
    echo "$(date): Starting ThreadsBot SaaS..."
    node server.js
    echo "$(date): ThreadsBot SaaS crashed, restarting in 5 seconds..."
    sleep 5
done

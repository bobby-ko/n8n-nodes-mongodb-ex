#!/bin/bash

# Start n8n with MongoDB Ex module loaded
export N8N_CUSTOM_EXTENSIONS=/workspaces/n8n-nodes-mongodb-ex
# Allow selected external libs in Function/Code nodes
export NODE_FUNCTION_ALLOW_EXTERNAL=lodash,lodash-ex,date-fns


echo "Starting n8n with MongoDB Ex module..."
echo "Module path: $N8N_CUSTOM_EXTENSIONS"
echo ""
echo "Your MongoDB Ex node should be available in the Database category"
echo "Press Ctrl+C to stop n8n"
echo ""

n8n start

#!/bin/bash
set -e

echo "=== Starting Supabase Self-Hosted Installation ==="

# 1. Install Docker
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    sudo apt-get update
    sudo apt-get install -y curl git
    curl -fsSL https://get.docker.com | sh
    sudo systemctl enable --now docker
else
    echo "Docker is already installed."
fi

# 2. Setup Supabase
if [ ! -d "supabase" ]; then
    echo "Cloning Supabase repository..."
    git clone --depth 1 https://github.com/supabase/supabase
fi

cd supabase/docker
cp .env.example .env

# Generate secure random postgres password and JWT secret
echo "Generating secure credentials..."
POSTGRES_PASS=$(openssl rand -hex 16)
JWT_SEC=$(openssl rand -hex 32)

# Use Docker to run a quick node container to generate JWT tokens safely
KEYS=$(docker run --rm node:18-alpine node -e "
const crypto = require('crypto');
const secret = '$JWT_SEC';
function sign(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret)
    .update(encodedHeader + '.' + encodedPayload)
    .digest('base64url');
  return encodedHeader + '.' + encodedPayload + '.' + signature;
}
const anon = sign({ role: 'anon', iss: 'supabase', iat: 1718228000, exp: 2033784000 });
const service = sign({ role: 'service_role', iss: 'supabase', iat: 1718228000, exp: 2033784000 });
console.log(anon + ' ' + service);
")

ANON_KEY=$(echo $KEYS | cut -d' ' -f1)
SERVICE_ROLE_KEY=$(echo $KEYS | cut -d' ' -f2)

# Save these credentials into the .env file
sed -i "s/POSTGRES_PASSWORD=postgres/POSTGRES_PASSWORD=$POSTGRES_PASS/g" .env
sed -i "s/JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long/JWT_SECRET=$JWT_SEC/g" .env
sed -i "s/ANON_KEY=.*$/ANON_KEY=$ANON_KEY/g" .env
sed -i "s/SERVICE_ROLE_KEY=.*$/SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY/g" .env

echo "Starting Supabase containers..."
sudo docker compose up -d

echo "=== Supabase Installed Successfully! ==="

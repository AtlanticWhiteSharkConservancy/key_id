#!/bin/bash

export AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY

if [[ -z "$AWS_ACCESS_KEY_ID" || -z "$AWS_SECRET_ACCESS_KEY" || -z "$S3_BUCKET" ]]; then
  echo "ERROR: Required params missing.  Need: URL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET"
  exit 1
fi

sed -i "s|API_URL|$URL|; s|AWS_BUCKET|$S3_BUCKET|; s|AWS_ACCESS_KEY|$AWS_ACCESS_KEY_ID|; \
        s|AWS_SECRET|$AWS_SECRET_ACCESS_KEY|" /client/src/environments/environment.prod.ts

#chown -R www-data:www-data /client

echo "Checking for GPU"
nvidia-smi &> /dev/null
if [ "$?" -ne 0 ]; then
  echo "ERROR: GPU requirement not met.  GPU not found.  Quitting."
  exit 1
else
  echo "GPU found!"
fi

/usr/bin/redis-server &
REDIS_PID=$!
sleep 1

cd /key-curve
echo "=====> Starting background job queue worker."
rq worker &
RQ_PID=$!

echo "=====> Starting KeyCurve web client service. This might take a minute."
cd /client && npm install && npm run build-prod && npm start &

echo "=====> Starting NGINX web service."
nginx

echo "=====> Starting Flask API"
python3 /key-curve/keycurve-api.py &

sleep inf

## System Requirements

A GPU-enabled server with docker and the [nvidia docker runtime](https://github.com/NVIDIA/nvidia-docker) installed.
The following command should work before proceeding:

`docker run --rm --gpus all nvidia/cuda nvidia-smi`

# Installation Instructions

Clone this repository to the target system.

1. cd into the directory and run
``` docker build -t keycurve:latest .```

2. Set the following environment variables in bash.  For example `export AWS_ACCESS_KEY=xxxxx`
   
   - __AWS_ACCESS_KEY__: Set to the AWS access key for an account that can read and write to the S3 bucket with the videos.
   - __AWS_SECRET_ACCESS_KEY__: Secret AWS key.
   - __S3_BUCKET__: The bucket with the videos. (e.g., `my-aws-bucket`)
    
3. Create a directory on the server that will host the database used to track sharks.  For example: 
   
   `mkdir -p /data/sharkdb`
4. Launch the KeyCurve container.

`docker run --runtime nvidia -d -v /data/vol:/data  -e AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY -e AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID -e S3_BUCKET=$S3_BUCKET -p 80:80 key-curve:latest`

5. Browse to the URL of the server and add `/keycurve` For example: http://my-server.somewhere.com/keycurve

For documentation on using the UI please see [this README.](./client/README.md)
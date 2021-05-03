FROM nvidia/cuda:11.0-runtime

RUN ln -fs /usr/share/zoneinfo/America/New_York /etc/localtime

RUN apt-get update && apt-get install python3 python3-pip redis-server libgl1 libglib2.0-0 ffmpeg wget npm nginx -y

RUN pip3 install fastai==1.0.61 numpy==1.18.1 IPTCInfo3==2.1.4 opencv-python==4.4.0.42 rq==1.5.1 boto3==1.14.52 \
            tqdm==4.48.2 flask flask-cors botocore==1.16.26

RUN mkdir -p /models /data && wget -qP /models "https://raw.githubusercontent.com/EminentCodfish/White-Shark-CNN-Classifier/master/Multi-Label%20CNN%20Model/WS_Multi_RESNET_50.pkl"

# Specify where the backend API lives.
ENV URL /keycurveApi

# Disable docker layer caching for everything below
ARG CACHEBUST

COPY key_curve/ /key-curve/
COPY client/ /client/
COPY nginx-default /etc/nginx/sites-enabled/default
COPY nginx.conf /etc/nginx/

COPY docker-entrypoint.sh /

RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT /docker-entrypoint.sh
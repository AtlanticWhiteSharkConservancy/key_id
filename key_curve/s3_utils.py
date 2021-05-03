import boto3
import logging
import os
import sys
import tempfile
import traceback

from botocore.config import Config

logger = logging.getLogger(__name__)
console = logging.StreamHandler()
console.setLevel('INFO')
logger.addHandler(console)
logger.setLevel('INFO')

AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID", None)
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY", None)


if not AWS_ACCESS_KEY_ID or not AWS_SECRET_ACCESS_KEY:
    raise RuntimeError("Could not find AWS keys in environment.  Quitting.")



s3 = boto3.client('s3')
#s3 = boto3.client('s3', aws_access_key_id=AWS_ACCESS_KEY, aws_secret_access_key=AWS_SECRET_KEY)



def split_s3_url(s3_url):
    """
    Breaks up s3 URL into
    bucket
    path under bucked
    tail (file or folder)
    :param s3URL:
    :return: 3 tuple (bucket, folder, tail)
    """
    s3_url_arr = s3_url.rsplit('/')[2:]
    if len(s3_url_arr) > 1:
        return s3_url_arr[0], '/'.join(s3_url_arr[1:-1]), s3_url_arr[-1]
    elif len(s3_url_arr) == 1:
        return s3_url_arr[0], "", ""
    else:
        raise ValueError("'{}' not a valid S3 URL".format(s3_url))


# s3://awsc-vyasa-demo/video1/GOPR0046.MP4
def download_from_s3(s3_url):
    bucket, path, tail = split_s3_url(s3_url)
    tempdir = tempfile.mkdtemp()
    local_file = os.path.join(tempdir, tail)
    logger.info(f"Starting download of {s3_url}.")
    try:
        s3.download_file(bucket, os.path.join(path, tail), local_file)
    except Exception as e:
        logger.warning(f"Error downloading {s3_url}.  Exception follows.")
        traceback.print_exc()
        return False
    logger.info(f"{s3_url} downloaded to {local_file}.")
    return os.path.join(tempdir, tail)


def upload_frames(s3_source, frames_dir):
    frames_list = os.listdir(frames_dir)
    num_frames = len(frames_list)
    bucket, path, tail = split_s3_url(s3_source)
    s3_path = os.path.join(path, tail[:-4])
    logger.info(f"Uploading {num_frames} frames to s3://{os.path.join(bucket, s3_path)}")
    for file in frames_list:
        if not file.endswith('jpg'):
            continue
        file_to_upload = os.path.join(frames_dir, file)
        s3.upload_file(file_to_upload, bucket, os.path.join(s3_path, file))
        logger.debug(f"Uploading {file_to_upload} to s3://{os.path.join(bucket, s3_path, file)}")
    logger.info("All files uploaded.")
    return num_frames

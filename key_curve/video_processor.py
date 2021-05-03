import logging
import os

import frame_labeler
import s3_utils

# logging.basicConfig()
logger = logging.getLogger(__name__)
console = logging.StreamHandler()
console.setLevel('INFO')
logger.addHandler(console)
logger.setLevel('INFO')


def run_frame_extractor(video_file):
    frame_labeler.extract_and_label_frames(video_file)
    frames_dir = video_file[:-4]
    frames_found = len(os.listdir(frames_dir))
    if frames_found > 0:
        logger.info(f"Found {frames_found} frames in {video_file}.")
        return True
    else:
        logger.warning(f"No usable frames found when processing {video_file}.")
        return False


def process_video(s3_url):
    local_video_file = s3_utils.download_from_s3(s3_url)
    run_frame_extractor(local_video_file)
    s3_utils.upload_frames(s3_url, local_video_file[:-4])
    logger.info(f"{s3_url} successfully processed.")


def extract_curve(s3_url, thresh, rect):
    local_image_file = s3_utils.download_from_s3(s3_url)

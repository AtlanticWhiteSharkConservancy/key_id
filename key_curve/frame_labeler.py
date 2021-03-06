# -*- coding: utf-8 -*-
"""
White Shark CNN labeling script

Last updated: 7/14/2020
Author: Chris Rillahan

Dependent packages:

OpenCV version 3.4.2
FastAI version 1.0.57
iptcinfo3
tqdm
"""

# Import packages
import os, cv2, logging, re, sys
import fastai.vision as ai  # CNN
# from fastai.vision import *
from iptcinfo3 import IPTCInfo  # Reading/writing jpeg metadata
from tqdm import trange  # Status bar
import subprocess as sp
import numpy as np

ai.defaults.device = ai.torch.device('cuda')  # Default to running the CNN on the GPU
# cnn_path = 'C:/Users/Deep Thought/Desktop/White Shark CNN/Multi-Label CNN Model/' #path to CNN weights
cnn_path = '/models'  # path to CNN weights
learn = ai.load_learner(cnn_path, 'WS_Multi_RESNET_50.pkl')  # Load the CNN weights


def extract_and_label_frames(video_name):
    f = os.path.basename(video_name)
    root = os.path.dirname(video_name)
    if f[-4:] == '.MP4':
        print('Starting to label: ' + str(root) + '/' + str(f))
        video_name = str(root) + '/' + str(f)

        # Set-up the export path and export folder
        export_path = root + '/' + f[:-4]
        if not os.path.exists(export_path):
            os.makedirs(export_path)

        # Open the GoPro video
        video = cv2.VideoCapture(video_name)

        # Get the videos specs.
        total_frames = video.get(cv2.CAP_PROP_FRAME_COUNT)
        FPS = video.get(cv2.CAP_PROP_FPS)
        width = video.get(cv2.CAP_PROP_FRAME_WIDTH)
        height = video.get(cv2.CAP_PROP_FRAME_HEIGHT)
        size = (int(width), int(height))
        # print(total_frames, FPS, size)

        # Set frame counter and check if the video file opened correctly.
        current_frame = 0
        status = video.isOpened()
        if status == True:

            # Label for exported labled video
            file_label = video_name[:-4] + '_labeled.mp4'
            print(f"File label is {file_label}")
            # print(file_label)

            # Video export is done by pipe the images through FFMpeg
            # Command to send via the command prompt which specifies the pipe parameters
            command = ['ffmpeg',
                       '-loglevel', 'error',
                       # '-nostdin',
                       '-y',  # (optional) overwrite output file if it exists
                       '-f', 'rawvideo',  # Input is raw video
                       # '-f', 'image2pipe',
                       '-pix_fmt', 'bgr24',  # Raw video format
                       '-s', str(int(width)) + 'x' + str(int(height)),  # size of one frame
                       '-r', str(FPS),  # frames per second
                       '-i', '-',  # The input comes from a pipe
                       '-an',  # Tells FFMPEG not to expect any audio
                       '-vcodec', 'h264',  # Sets the output codec format
                       '-b:v', '25000k',  # Sets a maximum bit rate
                       file_label]

            # Open the pipe
            pipe = sp.Popen(command, stdin=sp.PIPE, stderr=sp.PIPE, bufsize=10 ** 8)

            # List of accepted classification labels
            classes = ['', 'Caudal', 'Dorsal', 'Gill', 'No_shark', 'Pelvic', 'Shark']
            class_thres = 0.8  # Threshold for accepting the classification
            shark_thres = 0.8  # Required confidence in accepting shark vs. no_shark

            # Set thresholds for saving the files into their designated folders
            dorsal_thres = 0.99

            # Loop through the video frames
            while current_frame < (total_frames - 1):
                for i in trange(int(total_frames - 1)):  # Status bar
                    success, image = video.read()  # Read the frame
                    if success == True:
                        # cv2.imwrite(path + 'frame.jpg', image)
                        # img = open_image(path + 'frame.jpg')

                        # Process the image into the correct format expected by FastAI
                        t = ai.torch.tensor(
                            np.ascontiguousarray(np.flip(image, 2)).transpose(2, 0, 1)).float() / 255
                        img = ai.Image(t)  # fastai.vision.Image, not PIL.Image

                        # Run the image through the CNN classifier
                        pred_class, pred_idx, outputs = learn.predict(img)
                        # print(pred_class, pred_idx, outputs) #Look at the outputs

                        # Zip the classes and outputs together into a dictionary
                        outs = dict(zip(classes, outputs))

                        # Filter based on classification threshold
                        filtered_out = {label: prob for label, prob in outs.items() if prob > class_thres}
                        del filtered_out['']  # remove the '' class

                        # Add classification labels to the image
                        class_list = list(filtered_out.keys())

                        # Check to see if the model has the accepted tolerance to classify as a "shark".
                        # Otherwise change to "No_shark".
                        if 'Shark' in class_list:
                            if filtered_out['Shark'] < shark_thres:
                                class_list = ['No_shark']

                        for j in range(len(class_list)):
                            # Add the label and probability to the image
                            text_out = class_list[j] + ': ' + str(round(float(outs[class_list[j]]), 2))
                            # print(text_out)
                            cv2.putText(img=image, text=text_out, org=(50, ((j + 1) * 50)),
                                        fontFace=cv2.FONT_HERSHEY_PLAIN,
                                        fontScale=2, color=(255, 255, 255))

                        # Save labeled image - this is required by the package which writes the metadata.
                        cv2.imwrite(root + 'frame.jpg', image)

                        # Add metadata and save the image
                        logging.basicConfig(level=logging.CRITICAL)  # Turn off output; it's annoying
                        info = IPTCInfo(root + 'frame.jpg', force=True)  # Open frame to add the metadata
                        info['keywords'] = class_list  # Add the metadata

                        # Save the image in the appropriate folder
                        if 'Shark' in class_list:

                            if 'Dorsal' in class_list:
                                if outs['Dorsal'] >= dorsal_thres:
                                    # Save the frame with the ms i video it came from
                                    info.save_as(export_path + '/' + f[:-4] + '_' + str(
                                        int(current_frame / FPS * 1000)) + '.jpg')


                        logging.basicConfig(
                            level=logging.INFO)  # Turn the output back on.

                        # Write the image to the labeled video file
                        pipe.stdin.write(image.tostring())

                        # Show the image
                        # cv2.imshow('Video', image)

                        # Update the current
                        current_frame = video.get(cv2.CAP_PROP_POS_FRAMES)

                        k = cv2.waitKey(1)
                        if k == 27:
                            current_frame = total_frames
                    pass

            video.release()
            pipe.stdin.close()
            pipe.stderr.close()
            cv2.destroyAllWindows()
        else:
            print("Error: Video could not be loaded.")
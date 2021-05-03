# Key Curve Client

<p>
<img src="https://github.com/vyasa-analytics/key-curve/blob/master/client/example_images/video_list.png?raw=true" width="33%" />
<img src="https://github.com/vyasa-analytics/key-curve/blob/master/client/example_images/video_detail.png?raw=true" width="33%" />
<img src="https://github.com/vyasa-analytics/key-curve/blob/master/client/example_images/dorsal_fin_selection.png?raw=true" width="33%" />
</p>

This web application, built with Angular, is designed to run alongside the key curve server-side application and a dedicated AWS S3 bucket.  

The main goals of this application include:

- Scan the S3 bucket for video files.
- Initiate video processing on a video file. (resulting in a collection of video frames)
- Aid the user in identifying a dorsal fin curve from a video frame.
- Identify and persist a new named dorsal fin curve.
- Match a new curve to an existing named dorsal fin curve.

## Installation

First, follow the instructions to install and host the server-side component.

Fill in environment details in [environment.ts](src/environments/environment.ts).  

You'll need to fill in:

- The URL of the hosted API (server-side component).
- The name of the AWS S3 bucket and credentials to properly access that bucket.

At this point, you can use `npm` to install dependencies and start the application.  Once the application has launched, navigate to [localhost:4200](http://localhost:4200) to view the demo application.
```
npm install
npm start
```

import logging

import frame_processor
import video_processor
import sharkdb

from datetime import datetime
from rq.job import Job
from rq.registry import StartedJobRegistry
from rq import Queue

from flask import Flask, jsonify, request, make_response, send_file
from flask.logging import default_handler
from flask_cors import CORS

from redis import Redis


app = Flask(__name__)
CORS(app)

class RequestFormatter(logging.Formatter):
    def format(self, record):
        record.path = request.path
        return super().format(record)

app.logger.removeHandler(default_handler)
app.logger.setLevel('INFO')
vyasaLogHandler = logging.StreamHandler()
formatter = RequestFormatter('%(asctime)s | %(path)s | %(levelname)s | %(message)s')
vyasaLogHandler.setFormatter(formatter)
app.logger.addHandler(vyasaLogHandler)

redis_conn = Redis()
queue = Queue(connection=redis_conn)



@app.route('/health', methods=['GET'])
def health():
    return "OK"

@app.route('/processVideo', methods=['POST'])
def process_video():
    ''' Process video located in AWS
    Args:
        'video': String s3:// URL of video to processed.  Extracted frames are stored back to the same path minus
                 the '.MP4' extension.  s3://foo/video/myvid.MP4 -> s3://foo/video/myvid/frame_142.jpg.  The last
                 integer befor the .jpg extension is the millisecond of the video from where it was extracted.
    '''
    request_data = request.get_json(force=True)
    app.logger.info("Request received: " + str(request.get_json(request_data)))
    now = datetime.now()
    now_readable = now.strftime("%B %d, %H:%M:%S")
    s3_url = request_data['video']
    job_id = s3_url + " " + now_readable
    queue.enqueue(video_processor.process_video, args=(s3_url,), job_id=job_id, job_timeout=14400, failure_ttl=260000, result_ttl=26000)
    response = make_response("OK", 200)
    response.headers.set('Content-Type', 'text/plain')
    return response


@app.route('/previewCurve', methods=['POST'])
def preview_curve():
    ''' Returns a transparent PNG with a plot of the identified curve.
    Args:
        'image_url': String s3:// URL to jpg
        'thresh': Int on cv2 scale for threshold
        'rect': List of ints in [X1,Y1,X2,Y2] format for rectangle of object to be processed
        'flip': Bool to indicate if the image should be flipped horizontally.  Fin edges should face right.
    Response:
        PNG
    '''
    request_data = request.get_json(force=True)
    image_url = request_data['image_url']
    thresh = int(request_data['thresh'])
    rect = request_data['rect']
    flip = request_data['flip']
    preview = frame_processor.get_fin_contour_png(image_url, rect, thresh, flip)
    # response = make_response(preview)
    # response.headers.set('Content-Type', 'image/png')
    return send_file(
        "/tmp/foo.png",
        # mimetype='image/png',
        as_attachment=False)
    # return responsek


@app.route('/matchCurve', methods=['POST'])
def match_curve():
    ''' Attempts to match the curve vector highlighted in the selection with an existing curve in the database.
    Args:
        'image_url': String s3:// URL to jpg
        'thresh': Int on cv2 scale for threshold
        'rect': List of ints in [X1,Y1,X2,Y2] format for rectangle of object to be processed
        'flip': Bool to indicate if the image should be flipped horizontally.  Fin edges should face right.
    Response:
        A dict with keys for:
            curve: List (vector) generated from submitted image
            matches: List of lists ordered by closest match.  Eech sub-list is of format [name, source_image] where
            source image is the image that generated the vector that was matched against.
    '''
    curve_db = sharkdb.SharkDB()
    request_data = request.get_json(force=True)
    image_url = request_data['image_url']
    thresh = int(request_data['thresh'])
    rect = request_data['rect']
    flip = request_data['flip']
    curve = frame_processor.get_fin_vector(image_url, rect, thresh, flip)
    matches = curve_db.match_curve(curve)
    response = {}
    response['curve'] = [ int(x) for x in list(curve) ]
    response['sourceimage'] = image_url
    response['matches'] = matches
    return jsonify(response)


@app.route('/storeCurve', methods=['POST'])
def store_curve():
    ''' Stores a new key-curve entry in the database.
    Args:
        'name': String of animal name ("Bob", "Wanda"...)
        'source_image':  String s3:// URL to image from which vector was generated.
        'curve': List (vector) of ints representing key-curve vector.
        'sex': Optional string abbreviation for sex of animal.  M/F.  Defaults to None.
    Response:
        'OK'
    '''
    curve_db = sharkdb.SharkDB()
    request_data = request.get_json(force=True)
    name = request_data['name']
    sex = request_data.get('sex', None)
    curve = request_data.get('curve')
    sourceimage = request_data.get('sourceimage')
    curve_db.store_key_curve(name, curve, sourceimage, sex=sex)
    return 'OK'


@app.route('/jobStatus', methods=['GET'])
def job_status():
    ''' Show current jobs in queue.
    Args:
        None
    Response:
        "results": dict with key of job id and value of current status.  The job_id is in the format of
                   s3_url + " " + human_readable_timestamp
    '''
    results = {}
    registry = StartedJobRegistry('default', connection=redis_conn)
    registry_jobs = registry.get_job_ids()
    for job_id in registry_jobs:
        results[job_id] = "running"
    job_ids = queue.job_ids
    for job_id in job_ids:
        job = Job.fetch(job_id, connection=redis_conn)
        results[job_id] = job.get_status()
    return jsonify(results)


@app.route('/allRecords', methods=['GET'])
def all_records():
    ''' Show all records in the database without the curve vector.
    Args:
        None
    Response:
        "results": list of lists with sub-list containing [name, sex, sourceImage]
    '''
    curve_db = sharkdb.SharkDB()
    results = curve_db.get_all_records()
    return jsonify(results)


@app.route('/clearVideoLabels', methods=['POST'])
def clear_video_labels():
    ''' Delete all labels associated with any frame from the posted video URL
    Args:
        's3_url': String of s3 video location ("s3://somewhere/videos/vid1.mp4")
    Response:
        "results": int with number of records deleted
    '''
    request_data = request.get_json(force=True)
    s3_url = request_data['s3_url']
    curve_db = sharkdb.SharkDB()
    results = curve_db.clear_video_labels(s3_url)
    return jsonify(results)



app.run(host="0.0.0.0", port=4080)

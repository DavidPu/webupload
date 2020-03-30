import os
from app import app
from flask import request, redirect, make_response
import logging
from logging.handlers import RotatingFileHandler

ALLOWED_EXTENSIONS = set(
    ['txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'mp3', 'mp4', 'zip'])


def allowed_file(filename):
    return '.' in filename and filename.rsplit(
        '.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/upload')
def u_upload_form():
    return app.send_static_file('upload.html')


@app.route('/upload/<filename>', methods=['POST'])
def upload_stream(filename):
    if not allowed_file(filename):
        return make_response('Invalid file!', 400)

    # werkzeug.util.secure_filename can't handle non-ASCII name.
    # add our naive check.
    outfile = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if not (os.path.dirname(
            os.path.abspath(outfile)) == app.config['UPLOAD_FOLDER']):
        app.logger.warning("Invalid filename!")
        return make_response('Invalid filename!', 400)

    # chunk sequence number in hex format.
    chunk_seq = request.args.get('chunk', '0')
    try:
        chunk_seq = int(chunk_seq, 16)
    except:
        return make_response('Invalid chunk parameter', 400)

    bytes_left = int(request.headers.get('content-length'))
    mode = "ab" if chunk_seq > 0 else "w+b"

    with open(outfile, mode) as fd:
        chunk_size = 4096  # page size
        while bytes_left > 0:
            chunk = request.stream.read(chunk_size)
            fd.write(chunk)
            bytes_left -= len(chunk)

    if bytes_left != 0:
        return make_response('Failed to save file', 404)
    else:
        return make_response('Upload Complete', 200)


@app.route('/')
def index():
    return redirect(request.url + 'upload')


if __name__ == "__main__":
    handler = RotatingFileHandler('web.log',
                                  maxBytes=1024 * 1024 * 4,
                                  backupCount=1)
    handler.setLevel(logging.INFO)
    app.logger.addHandler(handler)
    app.run(host="0.0.0.0", debug=True)

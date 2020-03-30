from flask import Flask

UPLOAD_FOLDER = '/home/pulq/upload'

app = Flask(__name__, static_url_path='/static')
app.secret_key = "secret key"
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024
